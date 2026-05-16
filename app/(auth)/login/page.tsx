import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { LoginShell } from "@/components/auth/LoginShell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const isUserAuthenticated = await isAuthenticated();
  const { next } = await searchParams;

  if (isUserAuthenticated) {
    redirect(next || "/");
  }

  // Render a shell that auto-opens the AuthDialog. The dialog handles all auth.
  return <LoginShell next={next} />;
}
