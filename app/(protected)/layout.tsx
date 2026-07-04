import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAuthenticated } from "@/lib/auth-server";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isUserAuthenticated = await isAuthenticated();

  if (!isUserAuthenticated) {
    // x-pathname is injected by proxy.ts so we can send the user back
    // to the exact page they were trying to reach after login.
    const pathname = (await headers()).get("x-pathname") ?? "/";
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  return <>{children}</>;
}
