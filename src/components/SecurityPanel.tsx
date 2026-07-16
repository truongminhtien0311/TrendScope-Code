"use client";

// Cài đặt > Bảo mật (Chặng 6): đổi mật khẩu của chính mình, và nếu là
// admin thì thêm/xóa tài khoản đồng nghiệp. Tài khoản mới thêm KHÔNG
// cần đặt mật khẩu ngay — người đó tự đặt ở lần đăng nhập đầu tiên.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialogProvider";

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  isOwner: boolean;
  hasPassword: boolean;
}

export default function SecurityPanel({
  isAdmin,
  isOwner,
  currentUserId,
}: {
  isAdmin: boolean;
  isOwner: boolean;
  currentUserId: number;
}) {
  return (
    <div className="space-y-6">
      {isAdmin && <UserManagement currentUserId={currentUserId} isOwner={isOwner} />}
    </div>
  );
}


function UserManagement({ currentUserId, isOwner }: { currentUserId: number; isOwner: boolean }) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/auth/users");
    setLoading(false);
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải danh sách tài khoản 1 lần lúc mount, không phải vòng lặp render
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    const res = await fetch("/api/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), name: name.trim(), role }),
    });
    setAdding(false);
    if (res.ok) {
      setEmail("");
      setName("");
      setRole("member");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Thêm tài khoản thất bại.");
    }
  }

  async function removeUser(id: number, userEmail: string) {
    if (!(await confirmDialog(`Xóa tài khoản "${userEmail}"?`, { danger: true }))) return;
    const res = await fetch(`/api/auth/users/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error ?? "Xóa thất bại.");
    }
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3 max-w-lg">
      <p className="text-sm font-medium">👥 Quản lý tài khoản (admin)</p>

      {loading ? (
        <p className="text-sm text-slate-400">Đang tải...</p>
      ) : (
        <ul className="text-sm space-y-1">
          {users.map((u) => {
            // Chỉ owner mới xóa được tài khoản admin khác (admin thường
            // không xóa lẫn nhau được) — khớp với chặn ở API, ẩn nút cho
            // gọn giao diện thay vì hiện rồi báo lỗi 403.
            const canDelete = u.id !== currentUserId && (u.role !== "admin" || isOwner);
            return (
              <li key={u.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 py-1">
                <span>
                  {u.name} · {u.email}{" "}
                  <span className="text-xs text-slate-400">
                    ({u.role}
                    {u.isOwner ? " · ⭐ Chủ tài khoản" : ""}
                    {u.hasPassword ? "" : " — chưa đăng nhập lần nào"})
                  </span>
                </span>
                {canDelete && (
                  <button onClick={() => removeUser(u.id, u.email)} className="text-xs text-red-500 hover:underline">
                    Xóa
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={addUser} className="flex flex-wrap gap-2 items-start">
        <input
          type="email"
          placeholder="Email đồng nghiệp"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
        />
        <input
          placeholder="Tên"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "member" | "admin")}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm"
        >
          <option value="member">Nhân viên (member)</option>
          <option value="admin">Admin (toàn quyền)</option>
        </select>
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm whitespace-nowrap"
        >
          + Thêm
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-slate-400">
        💡 Không cần đặt mật khẩu ngay — người được thêm tự đặt mật khẩu ở lần đăng nhập đầu
        tiên bằng email này. Tài khoản "Admin" toàn quyền như bạn, nhưng chỉ ⭐ Chủ tài khoản
        mới xóa được tài khoản admin khác — admin thường không xóa lẫn nhau được.
      </p>
    </div>
  );
}
