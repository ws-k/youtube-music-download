import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import yt_dlp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

DOWNLOAD_DIR = os.getenv("DOWNLOAD_DIR", "/tmp/yt_downloads")
BGUTIL_SERVER = os.getenv("BGUTIL_SERVER", os.path.expanduser("~/bgutil-ytdlp-pot-provider/server/build/main.js"))
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

_bgutil_proc: subprocess.Popen | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _bgutil_proc
    if os.path.exists(BGUTIL_SERVER):
        _bgutil_proc = subprocess.Popen(
            ["node", BGUTIL_SERVER],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        logger.info("bgutil PO Token server started (PID: %s)", _bgutil_proc.pid)
    else:
        logger.warning("bgutil server not found at %s — PO Token 기능 비활성화", BGUTIL_SERVER)

    yield

    if _bgutil_proc:
        _bgutil_proc.terminate()
        logger.info("bgutil PO Token server stopped")


app = FastAPI(title="YouTube MP3 Downloader API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def sanitize_filename(name: str) -> str:
    """Remove characters that are invalid in filenames, preserving everything else."""
    return re.sub(r'[\\/*?:"<>|\x00-\x1f]', "", name).strip()


def check_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


@app.get("/api/info")
async def get_info(url: str = Query(..., description="YouTube URL")):
    if not url:
        raise HTTPException(status_code=400, detail="URL을 입력해주세요.")

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        logger.error("yt-dlp DownloadError (info): %s", error_msg)
        if "age-restricted" in error_msg.lower() or "age restricted" in error_msg.lower():
            raise HTTPException(status_code=403, detail="나이 제한으로 인해 영상 정보를 가져올 수 없습니다.")
        if "geo" in error_msg.lower() or "country" in error_msg.lower() or "region" in error_msg.lower():
            raise HTTPException(status_code=403, detail="지역 제한으로 인해 영상 정보를 가져올 수 없습니다.")
        if "private" in error_msg.lower():
            raise HTTPException(status_code=403, detail="비공개 영상입니다.")
        raise HTTPException(status_code=400, detail=f"영상 정보를 가져오지 못했습니다: {error_msg}")
    except Exception as e:
        logger.error("Unexpected error (info): %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="영상 정보를 가져오는 중 오류가 발생했습니다.")

    duration_seconds: int = info.get("duration") or 0
    minutes, seconds = divmod(duration_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours > 0:
        duration_str = f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        duration_str = f"{minutes}:{seconds:02d}"

    thumbnail = info.get("thumbnail") or ""
    thumbnails = info.get("thumbnails")
    if thumbnails and isinstance(thumbnails, list):
        hq = [t for t in thumbnails if t.get("url")]
        if hq:
            thumbnail = hq[-1]["url"]

    return {
        "title": info.get("title", "제목 없음"),
        "thumbnail": thumbnail,
        "duration": duration_str,
        "uploader": info.get("uploader") or info.get("channel") or "알 수 없음",
    }


VALID_QUALITIES = {"128", "192", "256", "320"}


@app.get("/api/download")
async def download_mp3(
    url: str = Query(..., description="YouTube URL"),
    quality: str = Query("192", description="MP3 bitrate (128/192/256/320)"),
    title: str = Query("", description="Video title for filename"),
    uploader: str = Query("", description="Channel/uploader name for filename"),
):
    if not url:
        raise HTTPException(status_code=400, detail="URL을 입력해주세요.")

    if quality not in VALID_QUALITIES:
        quality = "192"

    if not check_ffmpeg():
        raise HTTPException(
            status_code=500,
            detail="ffmpeg가 설치되어 있지 않습니다. MP3 변환을 위해 ffmpeg를 설치해주세요. (brew install ffmpeg)",
        )

    tmp_dir = tempfile.mkdtemp(dir=DOWNLOAD_DIR)
    outtmpl = os.path.join(tmp_dir, "%(id)s.%(ext)s")

    yt_dlp_bin = os.path.join(os.path.dirname(sys.executable), "yt-dlp")
    cmd = [
        yt_dlp_bin,
        "--no-playlist",
        "-x", "--audio-format", "mp3",
        "--audio-quality", quality,
        "-o", outtmpl,
        url,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            error_msg = result.stderr.strip() or result.stdout.strip()
            logger.error("yt-dlp CLI error (stdout): %s", result.stdout.strip())
            logger.error("yt-dlp CLI error (stderr): %s", result.stderr.strip())
            if "age-restricted" in error_msg.lower() or "age restricted" in error_msg.lower():
                raise HTTPException(status_code=403, detail="나이 제한으로 인해 다운로드할 수 없습니다.")
            if "private" in error_msg.lower():
                raise HTTPException(status_code=403, detail="비공개 영상은 다운로드할 수 없습니다.")
            raise HTTPException(status_code=400, detail=f"다운로드 오류: {error_msg}")
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="다운로드 시간이 초과되었습니다.")
    except HTTPException:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.error("Unexpected error (download): %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"알 수 없는 오류: {e}")

    mp3_files = list(Path(tmp_dir).glob("*.mp3"))
    if not mp3_files:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="MP3 파일 변환에 실패했습니다.")

    mp3_path = mp3_files[0]
    clean_title = sanitize_filename(title) if title else mp3_path.stem
    if uploader:
        clean_uploader = sanitize_filename(uploader)
        download_filename = f"{clean_title} - {clean_uploader} ({quality}k).mp3"
    else:
        download_filename = f"{clean_title} ({quality}k).mp3"

    from starlette.background import BackgroundTask

    response = FileResponse(
        path=str(mp3_path),
        media_type="audio/mpeg",
        filename=download_filename,
        background=BackgroundTask(shutil.rmtree, tmp_dir, True),
    )

    return response
