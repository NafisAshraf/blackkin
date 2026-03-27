"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const currentUser = useQuery(
    api.users.getCurrentUserWithRole,
    session ? {} : "skip"
  );

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  // Build the login URL with a ?next= param so we return here after sign in
  const loginHref =
    pathname && pathname !== "/login" && pathname !== "/register"
      ? `/login?next=${encodeURIComponent(pathname)}`
      : "/login";

  return (
    <header className="border-b">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-sm">
          Blackkin
        </Link>

        <nav className="flex items-center gap-2">
          {isPending ? null : session ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:block">
                {session.user.name || session.user.email?.split("@")[0]}
              </span>
              {currentUser?.role === "admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/admin")}
                >
                  Admin Panel
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/account")}
              >
                My Account
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link href={loginHref}>Sign In</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

