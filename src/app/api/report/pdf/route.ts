// API: GET /api/report/pdf?ids=1,2,3 — xuất PDF thật của trang báo cáo
// (src/app/report/page.tsx) bằng Playwright (Chromium headless) — dùng
// lại đúng cách gọi chromium.launch() như src/lib/taobao-login, không
// thêm thư viện PDF mới.
//
// Vì /report bị middleware.ts chặn (yêu cầu đăng nhập), trình duyệt ẩn
// mở ra bởi Playwright (context MỚI, chưa có cookie nào) sẽ không vào
// được — phải tự gắn cookie session của người dùng hiện tại vào context
// đó trước khi điều hướng.
//
// PDF xuất ra là 1 TRANG DÀI LIÊN TỤC (không ngắt A4 nhiều trang) — mục
// đích để MỞ RA XEM trên máy tính/điện thoại (đọc như trang web dài),
// không phải để in giấy. Cách làm: đặt viewport cố định bằng đúng bề
// rộng bố cục (khớp max-w-4xl + padding trong report page), load xong
// đo chiều cao thật của nội dung (scrollHeight) rồi truyền lại làm chiều
// cao trang PDF duy nhất, không set "format" (A4/Letter...).
import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { sessionOptions } from "@/lib/session-config";

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const ids = request.nextUrl.searchParams.get("ids");
  const sessionIds = request.nextUrl.searchParams.get("sessionIds");
  if (!ids && !sessionIds) {
    return NextResponse.json({ error: "Thiếu danh sách sản phẩm (ids) hoặc phiên đánh giá (sessionIds)" }, { status: 400 });
  }

  const sessionCookie = request.cookies.get(sessionOptions.cookieName);
  if (!sessionCookie) {
    return NextResponse.json({ error: "Thiếu phiên đăng nhập" }, { status: 401 });
  }

  const origin = request.nextUrl.origin;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: sessionOptions.cookieName,
        value: sessionCookie.value,
        url: origin,
      },
    ]);
    const page = await context.newPage();
    const reportPath = sessionIds
      ? `/report/session?ids=${encodeURIComponent(sessionIds)}`
      : `/report?ids=${encodeURIComponent(ids as string)}`;
    const PAGE_WIDTH_PX = 900; // khớp max-w-4xl (896px) + padding trong report page
    await page.setViewportSize({ width: PAGE_WIDTH_PX, height: 1000 });
    await page.goto(`${origin}${reportPath}`, { waitUntil: "networkidle" });
    const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const pdfBuffer = await page.pdf({
      width: `${PAGE_WIDTH_PX}px`,
      height: `${contentHeight}px`,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
      pageRanges: "1", // luôn đúng 1 trang — chiều cao đã set bằng đúng scrollHeight
    });

    const itemCount = (sessionIds ?? ids ?? "").split(",").filter(Boolean).length;
    const label = sessionIds ? `${itemCount} phiên đánh giá` : `${itemCount} sản phẩm`;
    await logActivity("report.pdf_export", `Xuất PDF báo cáo ${label}`, currentUser.id);

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filenamePrefix = sessionIds ? "bao-cao-phien-danh-gia" : "bao-cao-san-pham";
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenamePrefix}-${dateStamp}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
