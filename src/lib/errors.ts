// Dịch các lỗi kỹ thuật (mạng, trình duyệt tự động hóa, HTTP...) sang câu
// tiếng Việt dễ hiểu cho người dùng không phải dev — dùng ở các API route
// trả lỗi TRỰC TIẾP ra ngoài ngay trong request (giải mã link, cào dữ
// liệu...). Khác với friendlyGeminiError (lib/llm/index.ts) vốn dịch lỗi
// AI được LƯU LẠI trong DB rồi hiển thị sau qua cơ chế PENDING/poll.
// Trả về nguyên văn gốc nếu không nhận diện được dạng lỗi cụ thể — không
// giấu thông tin, chỉ dịch những dạng lỗi đã biết rõ nguyên nhân.
export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/Timeout \d+ms exceeded/.test(raw)) {
    return "Quá thời gian chờ tải trang (mạng chậm hoặc trang không phản hồi) — thử lại.";
  }
  if (/net::ERR_INTERNET_DISCONNECTED|net::ERR_NAME_NOT_RESOLVED|net::ERR_CONNECTION|net::ERR_/.test(raw)) {
    return "Lỗi kết nối mạng khi tải trang — kiểm tra mạng rồi thử lại.";
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed/i.test(raw)) {
    return "Không kết nối được tới máy chủ — kiểm tra mạng hoặc thử lại sau.";
  }
  if (/Executable doesn'?t exist/i.test(raw)) {
    return "Chưa cài xong trình duyệt ẩn (Chromium) cần thiết cho tính năng này — thử lại sau ít phút, hoặc khởi động lại app.";
  }
  if (/Unexpected token|is not valid JSON/i.test(raw)) {
    return "Dữ liệu phiên đăng nhập bị hỏng — vào Cài đặt > Đăng nhập Taobao để đăng nhập lại.";
  }
  if (/status code 401|status code 403|Unauthorized|Forbidden/i.test(raw)) {
    return "API key/token không hợp lệ hoặc hết hạn — kiểm tra lại trong Cài đặt.";
  }
  if (/status code 429|Too Many Requests/i.test(raw)) {
    return "Bị giới hạn tần suất gọi API (gọi quá nhanh/quá nhiều trong thời gian ngắn) — đợi ít phút rồi thử lại.";
  }
  if (/status code 5\d\d/i.test(raw)) {
    return "Máy chủ phía đối tác đang lỗi/quá tải tạm thời — thử lại sau ít phút.";
  }

  return raw;
}
