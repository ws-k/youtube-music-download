# YouTube MP3 다운로더

YouTube URL을 입력하면 MP3를 추출해주는 풀스택 웹 앱입니다.

## 사전 요구사항

- Python 3.10+
- Node.js 18+
- ffmpeg (`brew install ffmpeg`)

## 실행 방법

### 백엔드

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 구조

```
youtube_music_download/
├── backend/
│   ├── main.py           # FastAPI 앱
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── globals.css
    ├── package.json
    ├── next.config.ts
    └── tailwind.config.ts
```

## API

- `GET /api/info?url=<youtube_url>` — 영상 제목, 썸네일, 재생시간, 업로더 반환
- `GET /api/download?url=<youtube_url>` — MP3 파일 스트리밍 다운로드
