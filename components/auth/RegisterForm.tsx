"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { isPhoneNumber, normalizePhone, phoneToSyntheticEmail } from "@/lib/auth-utils";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const { data: session, isPending } = authClient.useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, router, next]);

  if (isPending || session) return null;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    let result;
    if (isPhoneNumber(identifier)) {
      const phone = normalizePhone(identifier);
      result = await authClient.signUp.email({
        email: phoneToSyntheticEmail(identifier),
        password,
        name: phone,
      });
    } else {
      result = await authClient.signUp.email({
        email: identifier,
        password,
        name: identifier.split("@")[0],
      });
    }

    setIsLoading(false);
    if (result.error) {
      setError(result.error.message || "Failed to create account. Please try again.");
    } else {
      router.replace(next);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
    });
    setIsGoogleLoading(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Enter your mobile number or email to get started</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}
        <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identifier">Mobile Number or Email</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="01712345678 or you@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isLoading} className="mt-2">
            {isLoading ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center gap-2"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
        >
          <GoogleIcon />
          {isGoogleLoading ? "Redirecting…" : "Continue with Google"}
        </Button>
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
