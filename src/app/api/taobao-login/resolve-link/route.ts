// API: POST /api/taobao-login/resolve-link — dùng phiên Taobao đã đăng
// nhập để "mở khóa" link rút gọn (vd https://e.tb.cn/h.xxxx) ra URL đầy
// đủ có id sản phẩm thật, phục vụ việc dán link cào dữ liệu bình thường.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveShortLink } from "@/lib/taobao-login";
import { logActivity } from "@/lib/log";
import { friendlyError } from "@/lib/errors";
import { extractUrlFromText } from "@/lib/url-text";

// preprocess: lọc link thuần ra khỏi text dán vào trước khi validate —
// xem src/lib/url-text.ts (trường hợp dán nguyên "淘口令" từ app mobile,
// short link thường bị kẹp giữa text quảng cáo).
const schema = z.object({
  url: z.preprocess((val) => (typeof val === "string" ? extractUrlFromText(val) : val), z.string().url()),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "URL không hợp lệ" }, { status: 400 });
  }

  try {
    const resolvedUrl = await resolveShortLink(parsed.data.url);
    await logActivity("taobao_login.resolve_link", `Giải mã link rút gọn: ${parsed.data.url} -> ${resolvedUrl}`);
    return NextResponse.json({ resolvedUrl });
  } catch (err) {
    // Ghi log CẢ lúc lỗi (trước đây chỉ log lúc thành công) — để tra lại
    // được lịch sử thử/lỗi thật trong "Log hoạt động" khi debug, không
    // phải dò DB tay như trước.
    await logActivity("taobao_login.resolve_link_failed", `Giải mã link rút gọn lỗi: ${parsed.data.url} — ${String(err)}`);
    return NextResponse.json({ error: friendlyError(err) }, { status: 502 });
  }
}
