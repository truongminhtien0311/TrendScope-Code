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
//   4. Mỗi lần cần upload ảnh: dùng refresh_token đổi lấy access_token
//      mới (access_token chỉ sống ~1 giờ, refresh_token sống lâu dài).
//
// Scope dùng: "drive.file" — CHỈ truy cập được file do CHÍNH APP này
// tạo ra, không đụng tới các file khác sẵn có trong Drive của người
// dùng (an toàn hơn, và không cần Google duyệt app kỹ như scope rộng).
//
// TỔ CHỨC FILE + TỐI ƯU DUNG LƯỢNG (theo yêu cầu: đủ dữ liệu nhưng tối
// ưu dung lượng — xem thêm docs plan chặng 5):
//   - Toàn bộ ảnh nằm trong 1 folder gốc cố định "ProductHunt-DoNotDelete"
//     (đặt tên tiếng Anh, chèn "DoNotDelete" để tránh xóa nhầm), bên
//     trong có folder con "images". ID 2 folder này lưu cache lại trong
//     configJson (rootFolderId/imagesFolderId) để không tạo trùng mỗi
//     lần upload — chỉ tạo 1 lần đầu tiên.
//   - DEDUPE: đặt tên file trên Drive = hash SHA-256 của URL ảnh gốc
//     (không phải tên gốc) -> trước khi upload, tìm trong folder xem
//     đã có file trùng tên chưa, có rồi thì DÙNG LẠI, không tải/upload
//     lại (tránh nhân đôi dung lượng khi "Cào lại" nhiều lần).
//   - RESIZE: ảnh quá khổ (cạnh dài > 1600px) được thu nhỏ trước khi
//     upload bằng sharp — giảm dung lượng đáng kể, gần như không ảnh
//     hưởng khi xem trong app (không phải dùng để in ấn).
// ============================================================
import crypto from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import type { StorageProvider } from "../index";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_REDIRECT_PATH = "/api/storage/google/callback";

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
export async function fetchConnectedEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  return data.email;
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

// Lấy (hoặc tạo mới lần đầu) folder gốc + folder con "images", cache lại
// id vào configJson để các lần sau không tạo trùng.
async function ensureImagesFolder(providerId: number, config: GoogleDriveConfig, accessToken: string): Promise<string> {
  if (config.imagesFolderId) return config.imagesFolderId;

  let rootFolderId = config.rootFolderId;
  if (!rootFolderId) {
    rootFolderId = (await findFolder(ROOT_FOLDER_NAME, undefined, accessToken)) ?? undefined;
    if (!rootFolderId) rootFolderId = await createFolder(ROOT_FOLDER_NAME, undefined, accessToken);
  }

  let imagesFolderId = (await findFolder(IMAGES_FOLDER_NAME, rootFolderId, accessToken)) ?? undefined;
  if (!imagesFolderId) imagesFolderId = await createFolder(IMAGES_FOLDER_NAME, rootFolderId, accessToken);

  await saveConfig(providerId, { ...config, rootFolderId, imagesFolderId });
  return imagesFolderId;
}

// Tên file trên Drive = hash URL gốc -> dùng để dò trùng (dedupe),
// tránh tải/upload lại ảnh đã có sẵn khi cào lại nhiều lần.
function hashedFileName(originalUrl: string, mimeType: string): string {
  const hash = crypto.createHash("sha256").update(originalUrl).digest("hex");
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return `${hash}.${ext}`;
}

async function findExistingFile(name: string, folderId: string, accessToken: string): Promise<string | null> {
  const q = `name='${name}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
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
    const result = await getConfigRow();
    const { clientId, clientSecret, refreshToken } = result?.config ?? {};
    if (!result || !clientId || !clientSecret || !refreshToken) {
      throw new Error("Chưa kết nối Google Drive — vào Cài đặt > Lưu trữ để kết nối trước.");
    }
    const { id: providerId, config } = result;
    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    const imagesFolderId = await ensureImagesFolder(providerId, config, accessToken);

    const imageRes = await fetch(url);
    if (!imageRes.ok) throw new Error(`Không tải được ảnh gốc: HTTP ${imageRes.status}`);
    const mimeType = imageRes.headers.get("content-type") ?? "image/jpeg";
    const fileName = hashedFileName(url, mimeType);

    // Dedupe: đã có file cùng tên (cùng URL gốc) trong folder rồi thì
    // dùng lại luôn, không tải/upload lại.
    const existingId = await findExistingFile(fileName, imagesFolderId, accessToken);
    if (existingId) {
      return `https://drive.google.com/uc?export=view&id=${existingId}`;
    }

    const rawBuffer = Buffer.from(await imageRes.arrayBuffer());
    const buffer = await resizeIfNeeded(rawBuffer);

    // Upload multipart: 1 phần metadata (tên file + folder cha) + 1 phần dữ liệu ảnh
    const boundary = "product_scrap_boundary";
    const metadata = JSON.stringify({ name: fileName, parents: [imagesFolderId] });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    const uploaded = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Google Drive từ chối upload: ${JSON.stringify(uploaded)}`);
    const fileId = uploaded.id as string;

    // Cho phép "ai có link cũng xem được" — cần thiết để hiển thị ảnh
    // trực tiếp trong app (thẻ <img>) mà không cần đăng nhập Google.
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  },
};
