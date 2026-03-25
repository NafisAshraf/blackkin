import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isUserAuthenticated = await isAuthenticated();
  
  if (!isUserAuthenticated) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {children}
    </div>
  );
}
