"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function AccountPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  
  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  if (isPending) {
    return <div className="p-10 text-center">Loading account details...</div>;
  }

  if (!session) {
    return null; // Layout will handle redirect, but we safeguard here just in case
  }

  return (
    <>
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/convex.svg" alt="Convex Logo" width={24} height={24} />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Storefront</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Hello, {session.user.name || "User"}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 py-1.5 px-3 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto p-6 mt-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-8">Your Account</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Profile Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex border-b border-slate-100 dark:border-slate-700 pb-2">
                <span className="capitalize text-slate-500 w-24">Email</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{session.user.email}</span>
              </div>
              <div className="flex border-b border-slate-100 dark:border-slate-700 pb-2">
                <span className="capitalize text-slate-500 w-24">Name</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{session.user.name || "Not provided"}</span>
              </div>
              <div className="flex pb-2">
                <span className="capitalize text-slate-500 w-24">Status</span>
                <span className="font-medium inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                  Active
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
             <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200">Security</h2>
             <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">You authenticated using your email and password. In the future you can manage OAuth connections here.</p>
             <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
               Return to Landing Page &rarr;
             </Link>
          </div>
        </div>
      </main>
    </>
  );
}
