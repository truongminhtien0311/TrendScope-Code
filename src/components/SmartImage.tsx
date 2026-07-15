"use client";

// Ảnh cào từ sàn TQ hay bị lỗi/tải chậm 1-2 lần đầu (CDN chặn hotlink,
// mạng chậm) rồi mới hiện được — trước đây chỉ hiện đúng khi người dùng
// vô tình chuyển trang qua lại (remount lại thẻ <img>). Component này tự
// làm việc đó: hiện khung skeleton khi đang tải, tự thử lại vài lần khi
// lỗi (KHÔNG cần người dùng thao tác gì), hết lượt thử mới báo lỗi thật.
import { useState, useRef, useEffect } from "react";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export default function SmartImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Nếu ảnh đã được load từ cache của trình duyệt trước khi React gắn event
    if (imgRef.current?.complete) {
      setLoading(false);
    }
  }, [attempt, src]);

  function handleError() {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      setTimeout(() => setAttempt((a) => a + 1), delay);
    } else {
      setLoading(false);
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <div
        className={`${className ?? ""} flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 text-xl`}
        title="Không tải được ảnh"
      >
        ⚠️
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      {loading && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-[inherit]" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh từ nhiều nguồn (CDN sàn TQ hoặc /uploads/ local), domain không cố định */}
      <img
        ref={imgRef}
        key={attempt}
        src={attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}__retry=${attempt}`}
        alt={alt}
        className={`${className ?? ""} ${loading ? "opacity-0" : "opacity-100"} transition-opacity`}
        onLoad={() => setLoading(false)}
        onError={handleError}
      />
    </div>
  );
}
