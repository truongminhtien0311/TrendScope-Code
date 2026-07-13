import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { headers } from "next/headers";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import UpdateNotifier from "@/components/UpdateNotifier";
import ConfirmDialogProvider from "@/components/ConfirmDialogProvider";
import { getCurrentUser } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Product Scrap",
  description: "Quản lý và nghiên cứu sản phẩm nguồn Trung Quốc",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Có thể null (vd đang ở trang /login, chưa đăng nhập) — Sidebar tự
  // ẩn phần email/đăng xuất khi đó.
  const user = await getCurrentUser().catch(() => null);
  // /report là tài liệu trình bày/PDF (xem src/app/report/page.tsx) —
  // không nên có khung Sidebar/padding. Đọc pathname qua header do
  // src/middleware.ts gắn vào (layout Server Component không có cách
  // nào khác biết được đường dẫn hiện tại).
  const pathname = (await headers()).get("x-pathname") ?? "";
  const hideChrome = pathname.startsWith("/report");
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Áp theme đã lưu TRƯỚC khi trang hiện ra để không bị chớp trắng/đen */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.theme==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <Toaster richColors position="top-right" />
        <UpdateNotifier />
        <ConfirmDialogProvider>
          {user && !hideChrome ? (
            <div className="flex min-h-screen">
              <Sidebar userEmail={user.email} />
              <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">{children}</main>
            </div>
          ) : (
            // Chưa đăng nhập (trang /login), hoặc trang trình bày/PDF (/report)
            // — không hiện khung sidebar/nav
            children
          )}
        </ConfirmDialogProvider>
      </body>
    </html>
  );
}
