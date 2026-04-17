import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube MP3 다운로더",
  description: "YouTube 영상에서 MP3 오디오를 추출하고 다운로드하세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
