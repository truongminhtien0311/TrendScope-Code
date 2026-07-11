// ============================================================
// ĐĂNG NHẬP TAOBAO QUA QR — để giải mã link rút gọn từ mobile.
//
// VẤN ĐỀ THỰC TẾ: khi tìm sản phẩm bằng điện thoại, Taobao thường cho
// link rút gọn dạng "https://e.tb.cn/h.xxxxx?tk=..." — link này KHÔNG
// chứa id sản phẩm, chỉ redirect ra id thật khi trình duyệt đang ở
// trạng thái ĐÃ ĐĂNG NHẬP tài khoản Taobao. Vì vậy cần:
//   1. Đăng nhập 1 lần bằng cách quét mã QR đăng nhập CỦA CHÍNH TAOBAO
//      (không phải quét QR sản phẩm) bằng app Taobao trên điện thoại.
//   2. Giữ lại "phiên đăng nhập" (cookie) để lần sau resolve link rút
//      gọn không cần đăng nhập lại.
//
// Dùng Playwright (Chromium headless) để:
//   - Mở trang login.taobao.com, chụp ảnh mã QR hiển thị ra cho người
//     dùng quét bằng app Taobao trên điện thoại.
//   - Theo dõi tới khi trang tự chuyển hướng sau khi quét+xác nhận
//     thành công trên điện thoại.
//   - Lưu lại storageState (cookie + localStorage) vào bảng Setting
//     (key "taobao_login_session") để dùng lại cho các lần sau.
//
// LƯU Ý RỦI RO: đây là tài khoản Taobao THẬT của người dùng — dùng để
// resolve link vừa phải (không cào dồn dập hàng trăm link/phút) để
// tránh bị Taobao coi là hành vi bất thường và tạm khóa/yêu cầu xác
// minh tài khoản.
//
// LƯU Ý KỸ THUẬT: phiên browser đang chờ quét QR (giữa "start" và
// "poll") lưu tạm trong bộ nhớ (Map ở module này) — sẽ MẤT nếu server
// dev restart giữa chừng lúc đang chờ quét. Không ảnh hưởng session ĐÃ
// lưu (nằm trong DB), chỉ ảnh hưởng nếu restart đúng lúc đang quét dở.
// ============================================================
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { prisma } from "@/lib/db";

// Bản đóng gói (Electron) KHÔNG kèm sẵn Chromium của Playwright (đỡ
// nặng bộ cài, xem docs/04-lo-trinh.md) — tải về đúng lúc đầu tiên ai
// đó dùng tính năng đăng nhập Taobao, thay vì bắt buộc tải sẵn cho tất
// cả mọi người kể cả không dùng tới. Có thể mất vài phút lần đầu (cần
// mạng) — các lần sau đã có sẵn, không tải lại.
let ensureChromiumPromise: Promise<void> | null = null;

async function ensureChromiumInstalled(): Promise<void> {
  if (existsSync(chromium.executablePath())) return;
  if (!ensureChromiumPromise) {
    ensureChromiumPromise = new Promise((resolve, reject) => {
      const child = spawn("npx", ["playwright", "install", "chromium"], {
        stdio: "inherit",
        shell: true,
      });
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Tải Chromium thất bại (mã lỗi ${code})`));
      });
      child.on("error", reject);
    });
  }
  await ensureChromiumPromise;
}

const SETTING_KEY_SESSION = "taobao_login_session"; // JSON storageState
const SETTING_KEY_SAVED_AT = "taobao_login_saved_at"; // ISO date string

const LOGIN_URL = "https://login.taobao.com/havanaone/login/login.htm?bizName=taobao";
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 phút chưa quét xong thì tự dọn

interface PendingLogin {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: number;
}

// Bộ nhớ tạm giữ các phiên đang chờ quét QR (token -> browser đang mở)
const pending = new Map<string, PendingLogin>();

function cleanupExpired() {
  const now = Date.now();
  for (const [token, p] of pending) {
    if (now - p.createdAt > PENDING_TTL_MS) {
      p.browser.close().catch(() => {});
      pending.delete(token);
    }
  }
}

// Bước 1: mở trình duyệt ẩn, vào trang đăng nhập Taobao, chụp mã QR
export async function startLogin(): Promise<{ token: string; qrImageBase64: string }> {
  cleanupExpired();
  await ensureChromiumInstalled();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    locale: "zh-CN",
  });
  const page = await context.newPage();

  try {
    // KHÔNG dùng waitUntil "networkidle" — trang này polling ngầm liên
    // tục (kiểm tra trạng thái quét QR) nên sẽ không bao giờ đạt trạng
    // thái rảnh mạng, gây timeout giả. Chỉ cần đợi DOM tải xong rồi chờ
    // đúng phần tử mã QR xuất hiện.
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Đã kiểm chứng thật (2026-07-04): mã QR đăng nhập nằm trong 1
    // <canvas> duy nhất trên trang (khối "手机扫码登录" bên trái),
    // KHÔNG phải <img> như đoán ban đầu.
    const qrEl = await page.waitForSelector("canvas", { timeout: 15000 });
    const buffer = await qrEl.screenshot();

    const token = crypto.randomUUID();
    pending.set(token, { browser, context, page, createdAt: Date.now() });
    return { token, qrImageBase64: buffer.toString("base64") };
  } catch (err) {
    await browser.close().catch(() => {});
    throw new Error("Không mở được trang đăng nhập Taobao để lấy mã QR: " + String(err));
  }
}

export type PollResult = "pending" | "success" | "expired";

// Bước 2: gọi liên tục (vd mỗi 2 giây) để kiểm tra người dùng đã quét
// + xác nhận đăng nhập trên điện thoại xong chưa.
export async function pollLogin(token: string): Promise<PollResult> {
  const p = pending.get(token);
  if (!p) return "expired";

  // Đăng nhập thành công thì Taobao tự điều hướng ra khỏi trang login
  const stillOnLoginPage = p.page.url().includes("login.taobao.com");
  if (stillOnLoginPage) {
    if (Date.now() - p.createdAt > PENDING_TTL_MS) {
      await p.browser.close().catch(() => {});
      pending.delete(token);
      return "expired";
    }
    return "pending";
  }

  // Đã điều hướng ra khỏi trang login -> đăng nhập thành công, lưu session
  const storageState = await p.context.storageState();
  await Promise.all([
    prisma.setting.upsert({
      where: { key: SETTING_KEY_SESSION },
      update: { value: JSON.stringify(storageState) },
      create: { key: SETTING_KEY_SESSION, value: JSON.stringify(storageState) },
    }),
    prisma.setting.upsert({
      where: { key: SETTING_KEY_SAVED_AT },
      update: { value: new Date().toISOString() },
      create: { key: SETTING_KEY_SAVED_AT, value: new Date().toISOString() },
    }),
  ]);

  await p.browser.close().catch(() => {});
  pending.delete(token);
  return "success";
}

export async function getLoginStatus(): Promise<{ loggedIn: boolean; savedAt?: string }> {
  const [session, savedAt] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SETTING_KEY_SESSION } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEY_SAVED_AT } }),
  ]);
  return { loggedIn: !!session?.value, savedAt: savedAt?.value };
}

export async function clearLogin(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: { in: [SETTING_KEY_SESSION, SETTING_KEY_SAVED_AT] } } });
}

// Dùng phiên đã đăng nhập để "mở khóa" link rút gọn (e.tb.cn/...) ra
// URL đầy đủ có id sản phẩm thật — các link này thường redirect qua
// JS (không chỉ HTTP 302 đơn thuần) nên cần trình duyệt thật, không
// dùng fetch() thường được.
export async function resolveShortLink(shortUrl: string): Promise<string> {
  const session = await prisma.setting.findUnique({ where: { key: SETTING_KEY_SESSION } });
  if (!session?.value) {
    throw new Error("Chưa đăng nhập Taobao — vào Cài đặt để đăng nhập bằng QR trước.");
  }

  const storageState = JSON.parse(session.value);
  await ensureChromiumInstalled();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    // Link rút gọn thường redirect qua JS sau khi trang tải xong, không
    // chỉ HTTP 302 đơn thuần — đợi thêm chút sau "load" để JS kịp chạy.
    await page.goto(shortUrl, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(3000);
    return page.url();
  } finally {
    await browser.close().catch(() => {});
  }
}
