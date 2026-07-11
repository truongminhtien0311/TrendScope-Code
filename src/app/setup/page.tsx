// Trang "Thiết lập lần đầu" — chỉ hiện được khi database CHƯA CÓ tài
// khoản nào (máy mới cài app lần đầu, xem electron/main.js). Tạo xong
// tài khoản đầu tiên (role admin, isOwner) thì route này tự khóa lại
// (redirect sang /login) — không dùng lại được nữa sau khi đã có ai đó.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import SetupForm from "@/components/SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <SetupForm />
    </div>
  );
}
