import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { LoginForm } from "@/components/auth/LoginForm";

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <img
        src="/assets/blackkin_footer.png"
        alt="Blackkin"
        className="h-7 w-auto brightness-0 mb-8"
      />
      <LoginForm />
    </div>
  );
}
