// ============================================================
// LƯU TRỮ ẢNH & DỮ LIỆU (mindmap: Cài đặt > Lưu trữ)
//   - Local: LUÔN lưu vào public/uploads/ ngay lúc cào — nhanh, luôn có
//     bản dự phòng tại máy, không phụ thuộc mạng/Drive OAuth.
//   - Cloud: Google Drive... đồng bộ NGẦM sau đó (xem runDriveSyncSweep
//     bên dưới), không chặn response lúc cào.
//
// CHẶNG 6: đổi từ "chọn 1 trong 2 nơi lưu" sang "luôn lưu local + đồng bộ
// Drive ở nền nếu có bật" — vừa nhanh (không chờ upload Drive lúc cào),
// vừa có 2 bản sao (local + cloud), tránh rủi ro mất ảnh nếu Drive của
// người cào gốc bị xóa/thu hồi quyền sau này (ảnh hưởng tới mọi máy đã
// đồng bộ dữ liệu từ họ — xem src/lib/sync/).
//
// Nối vào 2 luồng ảnh thật của app —
//   1. Cào dữ liệu (src/app/api/scrape, rescrape) -> saveScrapedImages()
//   2. Tải ảnh tay/dán clipboard (src/app/api/uploads) -> saveBuffer()
// 1 ảnh lỗi (mạng...) KHÔNG được làm hỏng cả listing — rơi về giữ nguyên
// URL gốc, không có localPath (không được sweep đồng bộ Drive sau này,
// chấp nhận được — người dùng có thể "Cào lại" để thử lưu lại).
// ============================================================
import crypto from "node:crypto";
import { mkdir, writeFile, stat, readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/db";

// Chỉ còn Google Drive (hoặc provider cloud tương lai) dùng interface này —
// local giờ LUÔN chạy trực tiếp qua saveLocalImage/saveLocalBuffer bên
// dưới (không còn qua lớp "chọn provider" như trước), xem lý do ở đầu file.
export interface StorageProvider {
  id: string; // "google-drive" | "lark"
  name: string; // phải khớp CHÍNH XÁC với ApiProvider.name trong database
  saveBuffer: (buffer: Buffer, fileName: string, mimeType: string) => Promise<string>;
}

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const DEFAULT_MAX_DIMENSION = 1600; // px — ảnh sản phẩm chính, xem đủ nét
// Ảnh đánh giá khách mua: số lượng có thể nhiều hơn ảnh sản phẩm chính rất
// nhiều (10-100 lần) — resize nhỏ hơn để đỡ tốn dung lượng local + Drive,
// vẫn đủ để AI đối chiếu màu sắc/tình trạng/đóng gói (xem
// src/app/api/scrape/route.ts, src/lib/llm/index.ts).
export const REVIEW_IMAGE_MAX_DIMENSION = 1000;

// Dùng chung cho cả lưu local (file này) lẫn upload Drive
// (providers/google-drive.ts) — thu nhỏ ảnh quá khổ trước khi lưu, giữ
// nguyên nếu đã đủ nhỏ. Nhận maxDimension riêng để ảnh đánh giá (số lượng
// có thể rất nhiều) resize nhỏ hơn ảnh sản phẩm chính, đỡ tốn dung lượng.
export async function resizeIfNeeded(buffer: Buffer, maxDimension: number): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  if ((meta.width ?? 0) <= maxDimension && (meta.height ?? 0) <= maxDimension) {
    return buffer;
  }
  return sharp(buffer)
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .toBuffer();
}

function extFromMime(mimeType: string): string {
  return mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
}

// Ghi file vào public/uploads/ — tên file = hash NỘI DUNG ảnh (sau khi đã
// resize) nên tự dedupe: cào lại nhiều lần ra cùng 1 ảnh không ghi trùng
// file trên đĩa, giống cách google-drive.ts dedupe theo hash.
async function writeUploadFile(buffer: Buffer, fileName: string): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const filePath = path.join(UPLOADS_DIR, fileName);
  const alreadyExists = await stat(filePath)
    .then(() => true)
    .catch(() => false);
  if (!alreadyExists) await writeFile(filePath, buffer);
}

// Tải ảnh từ URL gốc, resize, ghi vào public/uploads/ — dùng cho ảnh cào
// được (sản phẩm + đánh giá). Trả về url public + tên file local (dùng
// cho sweep đồng bộ Drive ở nền).
export async function saveLocalImage(
  url: string,
  maxDimension: number = DEFAULT_MAX_DIMENSION
): Promise<{ url: string; localPath: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ảnh gốc: HTTP ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const rawBuffer = Buffer.from(await res.arrayBuffer());
  const buffer = await resizeIfNeeded(rawBuffer, maxDimension);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const fileName = `${hash}.${extFromMime(mimeType)}`;
  await writeUploadFile(buffer, fileName);
  return { url: `/uploads/${fileName}`, localPath: fileName };
}

// Ghi buffer ảnh có sẵn (tải tay/dán clipboard, xem POST /api/uploads) —
// cùng quy ước dedupe/resize với saveLocalImage.
export async function saveLocalBuffer(
  rawBuffer: Buffer,
  mimeType: string,
  maxDimension: number = DEFAULT_MAX_DIMENSION
): Promise<{ url: string; localPath: string }> {
  const buffer = await resizeIfNeeded(rawBuffer, maxDimension);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const fileName = `${hash}.${extFromMime(mimeType)}`;
  await writeUploadFile(buffer, fileName);
  return { url: `/uploads/${fileName}`, localPath: fileName };
}

// Lưu ảnh THẬT ngay lúc cào (trước khi ghi DB) — LUÔN lưu local trước
// (nhanh, luôn có bản dự phòng tại máy cào), Google Drive (nếu bật) được
// đồng bộ ngầm SAU đó bởi runDriveSyncSweep(), không chặn response lúc cào.
// Generic theo T để dùng chung được cho cả ảnh sản phẩm (ScrapedImage, có
// kind/sortOrder) lẫn ảnh đánh giá (chỉ có url) — trả thêm `localPath` cho
// ảnh nào lưu local thành công, để sweep sau này tìm ra nó.
export async function saveScrapedImages<T extends { url: string }>(
  images: T[],
  opts: { maxDimension?: number } = {}
): Promise<(T & { localPath?: string })[]> {
  const maxDimension = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  return Promise.all(
    images.map(async (img) => {
      try {
        const { url, localPath } = await saveLocalImage(img.url, maxDimension);
        return { ...img, url, localPath };
      } catch (err) {
        console.error("Lưu ảnh local thất bại, giữ link gốc:", img.url, err);
        return img;
      }
    })
  );
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Chưa xử lý xong lượt trước thì bỏ qua lượt gọi mới — tránh 2 lượt sweep
// chồng lấp đọc/ghi cùng dữ liệu nếu 1 lượt chạy lâu hơn chu kỳ gọi.
let isSweeping = false;
const SWEEP_BATCH_SIZE = 10; // mỗi bảng (ListingImage/ReviewImage) tối đa từng này ảnh/lượt
const SWEEP_CONCURRENCY = 3; // upload Drive song song tối đa từng này ảnh 1 lúc

// Quét ảnh đã lưu local (url còn "/uploads/...") nhưng CHƯA lên Drive, tải
// lên ở nền rồi ghi đè url thành link Drive thật — xem trigger định kỳ ở
// src/instrumentation.ts. Tự query lại DB mỗi lần chạy (không giữ hàng đợi
// trong RAM) nên tự "nhặt lại" luôn cả ảnh còn sót từ lượt trước bị crash/
// tắt app giữa chừng, không cần cơ chế dọn dẹp riêng.
export async function runDriveSyncSweep(): Promise<void> {
  if (isSweeping) return;
  isSweeping = true;
  try {
    const driveEnabled = await prisma.apiProvider.findFirst({
      where: { kind: "STORAGE", name: "Google Drive", enabled: true },
    });
    if (!driveEnabled) return; // Drive chưa bật -> local-only vẫn hợp lệ, không làm gì cả

    const { googleDriveProvider } = await import("./providers/google-drive");
    const pendingWhere = { url: { startsWith: "/uploads/" }, localPath: { not: null } } as const;

    const [pendingListingImages, pendingReviewImages] = await Promise.all([
      prisma.listingImage.findMany({ where: pendingWhere, take: SWEEP_BATCH_SIZE, orderBy: { id: "asc" } }),
      prisma.reviewImage.findMany({ where: pendingWhere, take: SWEEP_BATCH_SIZE, orderBy: { id: "asc" } }),
    ]);

    await runInChunks(pendingListingImages, SWEEP_CONCURRENCY, (row) =>
      syncOneImageToDrive(row.localPath, googleDriveProvider, (driveUrl) =>
        prisma.listingImage.update({ where: { id: row.id }, data: { url: driveUrl } })
      )
    );
    await runInChunks(pendingReviewImages, SWEEP_CONCURRENCY, (row) =>
      syncOneImageToDrive(row.localPath, googleDriveProvider, (driveUrl) =>
        prisma.reviewImage.update({ where: { id: row.id }, data: { url: driveUrl } })
      )
    );
  } finally {
    isSweeping = false;
  }
}

// Đọc thẳng byte ảnh từ đĩa (KHÔNG fetch lại từ link gốc trên sàn lần 2 —
// link TQ có thể đã bị chặn/hết hạn) rồi upload lên Drive. 1 ảnh lỗi không
// chặn các ảnh khác trong lô — tự thử lại ở lượt sweep sau.
async function syncOneImageToDrive(
  localPath: string | null,
  provider: StorageProvider,
  updateUrl: (driveUrl: string) => Promise<unknown>
): Promise<void> {
  if (!localPath) return;
  try {
    const buffer = await readFile(path.join(UPLOADS_DIR, localPath));
    const ext = localPath.split(".").pop() ?? "jpg";
    const mimeType = EXT_TO_MIME[ext] ?? "image/jpeg";
    const driveUrl = await provider.saveBuffer(buffer, localPath, mimeType);
    await updateUrl(driveUrl);
  } catch (err) {
    console.error("Đồng bộ ảnh lên Drive thất bại, thử lại ở lượt sweep sau:", localPath, err);
  }
}

async function runInChunks<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}
