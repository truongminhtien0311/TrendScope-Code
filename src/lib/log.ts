// Helper ghi log hoạt động — theo mindmap: "Log ghi lại TOÀN BỘ
// lịch sử hoạt động của app". Gọi hàm này trong mọi API route
// mỗi khi có thao tác thêm/sửa/xóa/cào dữ liệu.
import { prisma } from "./db";

export async function logActivity(action: string, detail?: string, userId?: number) {
  try {
    await prisma.activityLog.create({ data: { action, detail, userId } });
  } catch (err) {
    // Ghi log thất bại không được làm hỏng thao tác chính
    console.error("Không ghi được log:", err);
  }
}
