// ============================================================
// GOOGLE DRIVE — lưu trữ ảnh (thay cho phụ thuộc link ảnh gốc trên sàn
// TQ, có thể chết/bị chặn truy cập từ VN). Dùng REST API Google Drive
// v3 trực tiếp qua fetch (không cài thêm thư viện googleapis cho nhẹ).
//
// Luồng kết nối (OAuth 2.0, "Authorization Code"):
//   1. Người dùng tự tạo OAuth Client ID trên Google Cloud Console
//      (Web application, redirect URI = {APP_URL}/api/storage/google/callback),
//      nhập Client ID + Client Secret vào Cài đặt > Lưu trữ.
//   2. Bấm "Kết nối với Google" -> GET /api/storage/google/auth-url ->
//      chuyển hướng sang trang xin quyền của Google.
//   3. Google chuyển hướng lại /api/storage/google/callback?code=...
//      -> đổi code lấy access_token + refresh_token -> lưu refresh_token
//      vào ApiProvider.configJson (bảng Cài đặt > API, kind "STORAGE").
//   4. Mỗi lần cần upload: dùng refresh_token đổi lấy access_token mới
//      (access_token chỉ sống ~1 giờ, refresh_token sống lâu dài).
//
// Scope dùng: "drive.file" — CHỈ truy cập được file do CHÍNH APP này
// tạo ra, không đụng tới các file khác sẵn có trong Drive của người
// dùng (an toàn hơn, và không cần Google duyệt app kỹ như scope rộng).
//
// TỔ CHỨC FILE + TỐI ƯU DUNG LƯỢNG (theo yêu cầu: đủ dữ liệu nhưng tối
// ưu dung lượng):
//   - Toàn bộ dữ liệu nằm trong 1 folder gốc cố định "ProductHunt-DoNotDelete"
//     (đặt tên tiếng Anh, chèn "DoNotDelete" để tránh xóa nhầm), bên
//     trong có 2 folder con: "images" (ảnh sản phẩm) và "backups" (bản
//     sao lưu database — xem src/lib/backup). ID các folder cache lại
//     trong configJson để không tạo trùng mỗi lần dùng.
//   - Ảnh: DEDUPE (đặt tên = hash SHA-256 của URL gốc, có rồi thì dùng
//     lại, không upload lại) + RESIZE (ảnh quá khổ >1600px thu nhỏ
//     bằng sharp trước khi upload) — xem hàm saveImage() bên dưới.
//
// Các hàm helper thao tác Drive (ensureFolder/uploadBuffer/makePublic/...)
// được export ra để src/lib/backup dùng chung, tránh viết lại y hệt
// logic gọi REST API Drive ở 2 nơi.
// ============================================================
import crypto from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import type { StorageProvider } from "../index";

export const GOOGLE_SCOPE = "openid email profile https://www.googleapis.com/auth/drive.file";
export const GOOGLE_REDIRECT_PATH = "/api/storage/google/callback";

// KHÔNG dùng request.nextUrl.origin để suy ra redirect_uri — server
// standalone (electron/main.js) không set HOSTNAME nên Next tự nhận origin
// là "http://0.0.0.0:<port>" (theo địa chỉ server đang lắng nghe) thay vì
// "http://localhost:<port>" (địa chỉ trình duyệt thật sự gọi tới), khiến
// Google từ chối redirect_uri với "Error 400: invalid_request". App luôn
// chạy 1 máy, cổng cố định theo electron/main.js (PORT env) nên hardcode
// thẳng localhost là đủ và ổn định hơn.
export function getRedirectUri(): string {
  return `http://localhost:${process.env.PORT ?? 3000}${GOOGLE_REDIRECT_PATH}`;
}

const ROOT_FOLDER_NAME = "ProductHunt-DoNotDelete";
const IMAGES_FOLDER_NAME = "images";
const MAX_IMAGE_DIMENSION = 1600; // px — cạnh dài tối đa sau khi resize

export interface GoogleDriveConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  connectedEmail?: string;
  rootFolderId?: string;
  imagesFolderId?: string;
  backupsFolderId?: string;
  syncExportsFolderId?: string;
}

async function getConfigRow(): Promise<{ id: number; config: GoogleDriveConfig } | null> {
  const row = await prisma.apiProvider.findFirst({
    where: { kind: "STORAGE", name: "Google Drive" },
  });
  if (!row) return null;
  let config: GoogleDriveConfig = {};
  try {
    config = row.configJson ? JSON.parse(row.configJson) : {};
  } catch {
    config = {};
  }
  return { id: row.id, config };
}

async function saveConfig(providerId: number, config: GoogleDriveConfig): Promise<void> {
  await prisma.apiProvider.update({ where: { id: providerId }, data: { configJson: JSON.stringify(config) } });
}

export function buildAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline", // bắt buộc để Google trả về refresh_token
    prompt: "consent", // bắt buộc lấy lại refresh_token nếu kết nối lại lần 2
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google từ chối đổi mã: ${JSON.stringify(data)}`);
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google từ chối làm mới access token: ${JSON.stringify(data)}`);
  return data.access_token;
}

// Lấy email tài khoản Google vừa kết nối — chỉ để hiển thị cho người
// dùng biết đang dùng đúng tài khoản Drive nào.
export async function fetchGoogleProfile(accessToken: string): Promise<{ id: string; email: string; name: string } | undefined> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  return { id: data.id, email: data.email, name: data.name };
}

// Đổi refresh_token đã lưu -> access_token mới dùng ngay + thông tin
// provider/config gốc — dùng chung cho cả saveImage() và src/lib/backup.
export async function getAccessToken(): Promise<{
  accessToken: string;
  providerId: number;
  config: GoogleDriveConfig;
}> {
  const result = await getConfigRow();
  const { refreshToken, clientId: dbClientId, clientSecret: dbClientSecret } = result?.config ?? {};
  
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const clientId = envClientId && envClientId !== "xxx" ? envClientId : dbClientId;
  const clientSecret = envClientSecret && envClientSecret !== "xxx" ? envClientSecret : dbClientSecret;

  if (!result || !refreshToken) {
    throw new Error("Chưa kết nối Google Drive — vào Cài đặt > Lưu trữ để kết nối trước.");
  }
  if (!clientId || !clientSecret) {
    throw new Error("Chưa cấu hình Google Client ID/Secret.");
  }

  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
  return { accessToken, providerId: result.id, config: result.config };
}

async function findFolder(name: string, parentId: string | undefined, accessToken: string): Promise<string | null> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string | undefined, accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Không tạo được folder "${name}" trên Drive: ${JSON.stringify(data)}`);
  return data.id;
}

async function ensureRootFolder(providerId: number, config: GoogleDriveConfig, accessToken: string): Promise<string> {
  if (config.rootFolderId) return config.rootFolderId;
  let rootFolderId = (await findFolder(ROOT_FOLDER_NAME, undefined, accessToken)) ?? undefined;
  if (!rootFolderId) rootFolderId = await createFolder(ROOT_FOLDER_NAME, undefined, accessToken);
  await saveConfig(providerId, { ...config, rootFolderId });
  return rootFolderId;
}

// Lấy (hoặc tạo mới lần đầu) folder gốc + folder con "images", cache lại
// id vào configJson để các lần sau không tạo trùng.
async function ensureImagesFolder(providerId: number, config: GoogleDriveConfig, accessToken: string): Promise<string> {
  if (config.imagesFolderId) return config.imagesFolderId;
  const rootFolderId = await ensureRootFolder(providerId, config, accessToken);
  let imagesFolderId = (await findFolder(IMAGES_FOLDER_NAME, rootFolderId, accessToken)) ?? undefined;
  if (!imagesFolderId) imagesFolderId = await createFolder(IMAGES_FOLDER_NAME, rootFolderId, accessToken);
  await saveConfig(providerId, { ...config, rootFolderId, imagesFolderId });
  return imagesFolderId;
}

// Dùng chung cho src/lib/backup và src/lib/sync — lấy (hoặc tạo mới) 1
// folder con bất kỳ dưới folder gốc "ProductHunt-DoNotDelete", cache
// theo tên field truyền vào.
export async function ensureNamedFolder(
  providerId: number,
  config: GoogleDriveConfig,
  accessToken: string,
  folderName: string,
  cacheField: "backupsFolderId" | "syncExportsFolderId"
): Promise<string> {
  const cached = config[cacheField];
  if (cached) return cached;
  const rootFolderId = await ensureRootFolder(providerId, config, accessToken);
  let folderId = (await findFolder(folderName, rootFolderId, accessToken)) ?? undefined;
  if (!folderId) folderId = await createFolder(folderName, rootFolderId, accessToken);
  await saveConfig(providerId, { ...config, rootFolderId, [cacheField]: folderId });
  return folderId;
}

// Tên file trên Drive = hash URL gốc -> dùng để dò trùng (dedupe),
// tránh tải/upload lại ảnh đã có sẵn khi cào lại nhiều lần.
function hashedFileName(originalUrl: string, mimeType: string): string {
  const hash = crypto.createHash("sha256").update(originalUrl).digest("hex");
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return `${hash}.${ext}`;
}

export async function findExistingFile(name: string, folderId: string, accessToken: string): Promise<string | null> {
  const q = `name='${name}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function listFilesInFolder(
  folderId: string,
  accessToken: string
): Promise<{ id: string; name: string; createdTime: string; size?: string }[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Không lấy được danh sách file: ${JSON.stringify(data)}`);
  return data.files ?? [];
}

export async function deleteFile(fileId: string, accessToken: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Tải nội dung thật của 1 file trên Drive (dùng cho src/lib/sync — đọc
// lại file JSON đồng bộ do máy khác xuất lên).
export async function downloadFile(fileId: string, accessToken: string): Promise<Buffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Không tải được file từ Drive (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// Upload 1 buffer bất kỳ (không riêng ảnh) lên Drive, trả về fileId.
export async function uploadBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
  accessToken: string
): Promise<string> {
  const boundary = "product_scrap_boundary";
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const uploaded = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(`Google Drive từ chối upload: ${JSON.stringify(uploaded)}`);
  return uploaded.id as string;
}

// Cho phép "ai có link cũng xem được" — cần thiết để hiển thị ảnh trực
// tiếp trong app (thẻ <img>) mà không cần đăng nhập Google. Phải kiểm tra
// res.ok — nếu Google từ chối (vd hết quota, sai quyền) mà bỏ qua thì ảnh
// sẽ có link nhưng không xem được (thẻ <img> hiện icon lỗi).
export async function makePublic(fileId: string, accessToken: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(`Không cấp được quyền xem công khai cho ảnh trên Drive: ${JSON.stringify(data)}`);
  }
}

// Link "thumbnail" của Google Drive — dùng thay cho "uc?export=view" vì
// đó là link Google dành cho TẢI VỀ, hay bị chặn/lỗi khi nhúng trực tiếp
// vào thẻ <img> từ web khác (Google coi là truy cập bất thường). Link
// "thumbnail" mới là link Google làm riêng để hiển thị ảnh ổn định trên
// các trang web khác. "sz=w1000" = chiều rộng tối đa 1000px, đủ nét để xem.
function toViewableUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

// Thu nhỏ ảnh quá khổ để giảm dung lượng — giữ nguyên nếu đã đủ nhỏ.
async function resizeIfNeeded(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  if ((meta.width ?? 0) <= MAX_IMAGE_DIMENSION && (meta.height ?? 0) <= MAX_IMAGE_DIMENSION) {
    return buffer;
  }
  return sharp(buffer)
    .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true })
    .toBuffer();
}

export const googleDriveProvider: StorageProvider = {
  id: "google-drive",
  name: "Google Drive",

  async saveImage(url: string): Promise<string> {
    const { accessToken, providerId, config } = await getAccessToken();
    const imagesFolderId = await ensureImagesFolder(providerId, config, accessToken);

    const imageRes = await fetch(url);
    if (!imageRes.ok) throw new Error(`Không tải được ảnh gốc: HTTP ${imageRes.status}`);
    const mimeType = imageRes.headers.get("content-type") ?? "image/jpeg";
    const fileName = hashedFileName(url, mimeType);

    // Dedupe: đã có file cùng tên (cùng URL gốc) trong folder rồi thì
    // dùng lại luôn, không tải/upload lại.
    const existingId = await findExistingFile(fileName, imagesFolderId, accessToken);
    if (existingId) {
      return toViewableUrl(existingId);
    }

    const rawBuffer = Buffer.from(await imageRes.arrayBuffer());
    const buffer = await resizeIfNeeded(rawBuffer);
    const fileId = await uploadBuffer(buffer, fileName, mimeType, imagesFolderId, accessToken);
    await makePublic(fileId, accessToken);

    return toViewableUrl(fileId);
  },

  // Ảnh tải tay/dán clipboard (đã có sẵn buffer, không phải fetch từ URL
  // nguồn) — dùng cho POST /api/uploads. Dedupe theo hash NỘI DUNG buffer
  // (không có URL gốc để hash như saveImage()).
  async saveBuffer(rawBuffer: Buffer, _fileName: string, mimeType: string): Promise<string> {
    const { accessToken, providerId, config } = await getAccessToken();
    const imagesFolderId = await ensureImagesFolder(providerId, config, accessToken);

    const hash = crypto.createHash("sha256").update(rawBuffer).digest("hex");
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const driveFileName = `${hash}.${ext}`;

    const existingId = await findExistingFile(driveFileName, imagesFolderId, accessToken);
    if (existingId) {
      return toViewableUrl(existingId);
    }

    const buffer = await resizeIfNeeded(rawBuffer);
    const fileId = await uploadBuffer(buffer, driveFileName, mimeType, imagesFolderId, accessToken);
    await makePublic(fileId, accessToken);

    return toViewableUrl(fileId);
  },
};
