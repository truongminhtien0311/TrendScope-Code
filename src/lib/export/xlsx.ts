// Xuất file Excel (.xlsx) thật bằng exceljs. Chế độ "sinh động" (tùy
// chọn) chèn thêm 1 cột ảnh thumbnail + tô màu nền theo ngành hàng đầu
// tiên của sản phẩm — dữ liệu chữ/số các cột khác vẫn copy được bình
// thường, chỉ thêm phần trực quan.
import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";

// Bảng màu pastel (ARGB) tô nền theo ngành hàng — lặp lại nếu nhiều
// ngành hàng hơn số màu có sẵn.
const CATEGORY_COLORS = ["FFFDE68A", "FFBFDBFE", "FFBBF7D0", "FFFBCFE8", "FFDDD6FE", "FFFED7AA", "FFA7F3D0", "FFFCA5A5"];

// Trả base64 (không phải Buffer) — kiểu Buffer của exceljs lệch với
// @types/node phiên bản dự án đang dùng, base64 tránh được xung đột kiểu.
async function fetchImageBase64(url: string): Promise<{ base64: string; extension: "jpeg" | "png" | "gif" } | null> {
  try {
    let buffer: Buffer;
    if (url.startsWith("/uploads/")) {
      buffer = await fs.readFile(path.join(process.cwd(), "public", url));
    } else {
      const res = await fetch(url);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
    }
    const lower = url.toLowerCase();
    const extension = lower.includes(".png") ? "png" : lower.includes(".gif") ? "gif" : "jpeg";
    return { base64: buffer.toString("base64"), extension };
  } catch {
    return null; // ảnh lỗi/không tải được thì bỏ qua, không làm hỏng cả file
  }
}

export interface RichRowInfo {
  imageUrl: string | null;
  categoryName: string | null;
}

export async function toXlsx(headers: string[], rows: string[][], richInfo?: RichRowInfo[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sản phẩm");
  const hasImages = !!richInfo?.some((r) => r.imageUrl);

  sheet.addRow(hasImages ? ["Ảnh", ...headers] : headers).font = { bold: true };

  const categoryColorMap = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const info = richInfo?.[i];
    const excelRow = sheet.addRow(hasImages ? ["", ...rows[i]] : rows[i]);

    if (info?.categoryName) {
      if (!categoryColorMap.has(info.categoryName)) {
        categoryColorMap.set(info.categoryName, CATEGORY_COLORS[categoryColorMap.size % CATEGORY_COLORS.length]);
      }
      const argb = categoryColorMap.get(info.categoryName)!;
      excelRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      });
    }

    if (hasImages) {
      excelRow.height = 48;
      if (info?.imageUrl) {
        const img = await fetchImageBase64(info.imageUrl);
        if (img) {
          const imageId = workbook.addImage({ base64: `data:image/${img.extension};base64,${img.base64}`, extension: img.extension });
          sheet.addImage(imageId, { tl: { col: 0, row: excelRow.number - 1 }, ext: { width: 60, height: 60 } });
        }
      }
    }
  }

  sheet.columns.forEach((col, idx) => {
    col.width = hasImages && idx === 0 ? 10 : 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
