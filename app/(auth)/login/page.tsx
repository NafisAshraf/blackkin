import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const isUserAuthenticated = await isAuthenticated();
  
  if (isUserAuthenticated) {
    redirect("/account");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center py-20 px-4">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Welcome Back</h1>
      </div>
      <LoginForm />
    </div>
  );
}
