// API: POST /api/taobao-login/resolve-link — dùng phiên Taobao đã đăng
// nhập để "mở khóa" link rút gọn (vd https://e.tb.cn/h.xxxx) ra URL đầy
// đủ có id sản phẩm thật, phục vụ việc dán link cào dữ liệu bình thường.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveShortLink } from "@/lib/taobao-login";
import { logActivity } from "@/lib/log";

const schema = z.object({ url: z.string().url() });

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
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
