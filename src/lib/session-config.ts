// ============================================================
// Cấu hình session — tách riêng khỏi src/lib/auth.ts vì file đó có
// import Prisma (không chạy được trong Edge runtime của middleware.ts).
// File này KHÔNG được import next/headers hay @/lib/db.
// ============================================================
export interface SessionData {
  userId?: number;
}

const sessionPassword = process.env.SESSION_SECRET;
if (!sessionPassword || sessionPassword.length < 32) {
  throw new Error(
    "Thiếu SESSION_SECRET hợp lệ (>= 32 ký tự) trong .env — xem .env.example để biết cách tạo."
  );
}

export const sessionOptions = {
  cookieName: "product_scrap_session",
  password: sessionPassword,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true as const,
    sameSite: "lax" as const,
  },
};
