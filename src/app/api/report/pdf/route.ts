// API: GET /api/report/pdf?ids=1,2,3 — xuất PDF thật của trang báo cáo
// (src/app/report/page.tsx) bằng Playwright (Chromium headless) — dùng
// lại đúng cách gọi chromium.launch() như src/lib/taobao-login, không
// thêm thư viện PDF mới.
//
// Vì /report bị middleware.ts chặn (yêu cầu đăng nhập), trình duyệt ẩn
// mở ra bởi Playwright (context MỚI, chưa có cookie nào) sẽ không vào
// được — phải tự gắn cookie session của người dùng hiện tại vào context
// đó trước khi điều hướng.
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
  if (!ids) {
    return NextResponse.json({ error: "Thiếu danh sách sản phẩm (ids)" }, { status: 400 });
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
    await page.goto(`${origin}/report?ids=${encodeURIComponent(ids)}`, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
    });

    const productCount = ids.split(",").filter(Boolean).length;
    await logActivity("report.pdf_export", `Xuất PDF báo cáo ${productCount} sản phẩm`, currentUser.id);

    const dateStamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bao-cao-san-pham-${dateStamp}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
