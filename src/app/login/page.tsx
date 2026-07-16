import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
