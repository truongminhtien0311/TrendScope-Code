// Trang đăng nhập — Server Component để kiểm tra được: nếu database
// CHƯA CÓ tài khoản nào (máy mới cài lần đầu), chuyển sang /setup để
// người dùng tự tạo tài khoản Chủ tài khoản của họ thay vì hiện form
// đăng nhập vào 1 tài khoản chưa tồn tại. Form thật nằm ở
// src/components/LoginForm.tsx (client, cần useState/useSearchParams).
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const userCount = await prisma.user.count();
  if (userCount === 0) redirect("/setup");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <LoginForm />
    </div>
  );
}
