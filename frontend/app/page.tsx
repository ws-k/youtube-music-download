"use client";

import Image from "next/image";
import { useState } from "react";

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  uploader: string;
}

type AppStatus = "idle" | "fetching-info" | "ready" | "downloading" | "done" | "error";

export default function HomePage() {
  const [url, setUrl] = useState<string>("");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [quality, setQuality] = useState<string>("192");

  const handleFetchInfo = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setErrorMessage("YouTube URL을 입력해주세요.");
      setStatus("error");
      return;
    }

    setStatus("fetching-info");
    setInfo(null);
    setErrorMessage("");

    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(trimmedUrl)}`);
      if (!res.ok) {
        const data: { detail?: string } = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "영상 정보를 가져오는 데 실패했습니다.");
      }
      const data: VideoInfo = await res.json();
      setInfo(data);
      setStatus("ready");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  const handleDownload = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setStatus("downloading");
    setErrorMessage("");

    try {
      const titleParam = info?.title ? `&title=${encodeURIComponent(info.title)}` : "";
      const uploaderParam = info?.uploader ? `&uploader=${encodeURIComponent(info.uploader)}` : "";
      const res = await fetch(`/api/download?url=${encodeURIComponent(trimmedUrl)}&quality=${quality}${titleParam}${uploaderParam}`);
      if (!res.ok) {
        const data: { detail?: string } = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "다운로드에 실패했습니다.");
      }

      const cleanTitle = info?.title ?? "audio";
      const cleanUploader = info?.uploader ? ` - ${info.uploader}` : "";
      const filename = `${cleanTitle}${cleanUploader} (${quality}k).mp3`;

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);

      setStatus("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleFetchInfo();
    }
  };

  const isLoading = status === "fetching-info" || status === "downloading";

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "60px 16px",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="var(--accent)"
            aria-hidden="true"
          >
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            YouTube MP3 다운로더
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px", margin: 0 }}>
          YouTube 영상 URL을 입력하면 MP3 파일로 다운로드해드립니다
        </p>
      </div>

      {/* Input card */}
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          borderRadius: "16px",
          padding: "32px",
          width: "100%",
          maxWidth: "640px",
          border: "1px solid var(--border)",
          marginBottom: "24px",
        }}
      >
        <label
          htmlFor="youtube-url"
          style={{
            display: "block",
            color: "var(--text-secondary)",
            fontSize: "13px",
            fontWeight: 500,
            marginBottom: "10px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          YouTube URL
        </label>
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              id="youtube-url"
              type="url"
              autoComplete="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="YouTube URL을 입력하세요..."
              disabled={isLoading}
              style={{
                width: "100%",
                boxSizing: "border-box",
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: url ? "12px 40px 12px 16px" : "12px 16px",
                color: "var(--text-primary)",
                fontSize: "15px",
                minHeight: "44px",
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? "not-allowed" : "text",
              }}
            />
            {url && !isLoading && (
              <button
                onClick={() => { setUrl(""); setInfo(null); setStatus("idle"); setErrorMessage(""); }}
                aria-label="입력 지우기"
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleFetchInfo}
            disabled={isLoading}
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "12px 20px",
              color: "var(--text-primary)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              minHeight: "44px",
              opacity: isLoading ? 0.6 : 1,
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#2a2a2a";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-secondary)";
            }}
          >
            정보 가져오기
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label
            htmlFor="quality-select"
            style={{ color: "var(--text-secondary)", fontSize: "13px", whiteSpace: "nowrap" }}
          >
            음질
          </label>
          <select
            id="quality-select"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            disabled={isLoading}
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "var(--text-primary)",
              fontSize: "14px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <option value="128">128 kbps</option>
            <option value="192">192 kbps (기본)</option>
            <option value="256">256 kbps</option>
            <option value="320">320 kbps (최고)</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {status === "fetching-info" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "var(--text-secondary)",
            fontSize: "15px",
            marginBottom: "24px",
          }}
        >
          <Spinner />
          <span>영상 정보를 가져오는 중...</span>
        </div>
      )}

      {/* Error state */}
      {status === "error" && errorMessage && (
        <div
          style={{
            backgroundColor: "#2a1515",
            border: "1px solid #5a2020",
            borderRadius: "12px",
            padding: "16px 20px",
            width: "100%",
            maxWidth: "640px",
            color: "var(--error)",
            fontSize: "14px",
            marginBottom: "24px",
          }}
        >
          {errorMessage}
        </div>
      )}


      {/* Video info card */}
      {info && (status === "ready" || status === "downloading" || status === "done") && (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            borderRadius: "16px",
            padding: "24px",
            width: "100%",
            maxWidth: "640px",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: "20px", marginBottom: "24px" }}>
            {info.thumbnail && (
              <div
                style={{
                  flexShrink: 0,
                  borderRadius: "10px",
                  overflow: "hidden",
                  width: "140px",
                  height: "79px",
                  position: "relative",
                  backgroundColor: "var(--bg-secondary)",
                }}
              >
                <Image
                  src={info.thumbnail}
                  alt={info.title}
                  fill
                  style={{ objectFit: "cover" }}
                  unoptimized
                />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  color: "var(--text-primary)",
                  fontSize: "16px",
                  fontWeight: 600,
                  margin: "0 0 8px 0",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  lineHeight: "1.4",
                }}
              >
                {info.title}
              </h2>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  color: "var(--text-secondary)",
                  fontSize: "13px",
                }}
              >
                <span>
                  <span style={{ marginRight: "4px" }}>채널</span>
                  <span style={{ color: "var(--text-primary)" }}>{info.uploader}</span>
                </span>
                <span>
                  <span style={{ marginRight: "4px" }}>재생시간</span>
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {info.duration}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={isLoading}
            style={{
              width: "100%",
              backgroundColor: isLoading ? "#881111" : "var(--accent)",
              border: "none",
              borderRadius: "10px",
              padding: "14px 24px",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent)";
              }
            }}
          >
            {status === "downloading" ? (
              <>
                <Spinner size={18} color="#ffffff" />
                <span>변환 중...</span>
              </>
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>MP3 다운로드</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Footer */}
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "12px",
          marginTop: "48px",
          textAlign: "center",
        }}
      >
        ffmpeg가 설치되어 있어야 MP3 변환이 가능합니다. 개인적인 용도로만 사용하세요.
      </p>
    </main>
  );
}

function Spinner({ size = 20, color = "var(--text-secondary)" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      style={{
        animation: "spin 0.75s linear infinite",
        flexShrink: 0,
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
