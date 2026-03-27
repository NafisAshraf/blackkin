"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";

export default function AdminPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const currentUser = useQuery(
    api.users.getCurrentUserWithRole,
    session ? {} : "skip"
  );

  useEffect(() => {
    if (sessionPending) return;

    // Not logged in → send to login page with ?next=/admin
    if (!session) {
      router.replace("/login?next=/admin");
      return;
    }

    // Logged in but role still loading
    if (currentUser === undefined) return;

    // Logged in but not an admin
    if (currentUser?.role !== "admin") {
      router.replace("/");
    }
  }, [sessionPending, session, currentUser, router]);

  // Show nothing while determining access
  if (sessionPending || !session || currentUser === undefined) return null;

  // Definitively not an admin — useEffect handles redirect
  if (currentUser?.role !== "admin") return null;

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-2">Admin Panel</h1>
        <p className="text-muted-foreground text-sm">
          Admin features coming soon. Use the Convex dashboard to manage data.
        </p>
      </main>
    </>
  );
}
