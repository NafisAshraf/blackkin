"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      router.push("/account");
    }
  }, [session, router]);

  if (isPending) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-sm text-slate-500">Loading authentication...</div>
      </div>
    );
  }

  // If already logged in (but waiting for redirect), return null
  if (session) {
    return null;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      setError(signInError.message || "Failed to sign in. Please try again.");
    } else {
      router.push("/account");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({ 
      email, 
      password, 
      name: email.split("@")[0] 
    });
    if (signUpError) {
      setError(signUpError.message || "Failed to sign up. Please try again.");
    } else {
      router.push("/account");
    }
  };

  return (
    <div className="max-w-md w-full mx-auto p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Sign in to your account</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Enter your email and password below to continue</p>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-6 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-4 py-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-4 py-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            required
          />
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={handleSignIn}
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium py-3 rounded-lg shadow-md transition-colors"
          >
            Sign In
          </button>
          
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-medium">Or new user</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>

          <button
            onClick={handleSignUp}
            type="button"
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium py-3 rounded-lg shadow-sm border border-slate-300 dark:border-slate-600 transition-colors"
          >
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}
