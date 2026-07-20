// ============================================================
// Trích URL thuần từ đoạn text người dùng dán vào — xử lý trường hợp
// copy "淘口令" (lệnh chia sẻ) từ app Taobao/Tmall mobile: bấm "Chia sẻ"
// trên điện thoại thường copy CẢ khối text quảng cáo kèm link, không
// phải link thuần, vd:
//   "3¥ CZ0512 「Nike Air...」点击链接 https://e.tb.cn/h.xxxxx，或复制这段话..."
// Trước đây dán thẳng khối này vào ô link sẽ bị chặn ngay ở bước validate
// URL (zod .url()) với thông báo "Link không hợp lệ" — không gợi ý được
// nguyên nhân thật, người dùng tưởng gõ sai link.
// ============================================================

// Bộ ký tự hợp lệ trong URL (theo RFC 3986 phần path/query/fragment) —
// KHÔNG dùng \S+ (mọi ký tự không phải khoảng trắng) vì text tiếng Trung
// đi kèm thường dán liền link không có khoảng trắng phân cách (vd dấu
// phẩy toàn chiều rộng "，" ngay sau link) — \S+ sẽ nuốt luôn cả đoạn
// text phía sau vào URL, làm hỏng kết quả.
const URL_IN_TEXT_PATTERN = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/;

export function extractUrlFromText(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(URL_IN_TEXT_PATTERN);
  return match ? match[0] : trimmed;
}
