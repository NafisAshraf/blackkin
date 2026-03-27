import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default async function RegisterPage({
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
      <h1 className="text-2xl font-semibold mb-8">Blackkin</h1>
      <RegisterForm />
    </div>
  );
}
