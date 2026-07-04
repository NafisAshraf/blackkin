import { notFound } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { ChallengeWidget } from "./ChallengeWidget";

// Turnstile is intentionally disabled for the ExonHost migration/test
// deployment. Keep this page for a future re-enable, but do not expose the
// challenge route while TURNSTILE_ENABLED=false.
const TURNSTILE_ENABLED = false;

export const metadata = {
  title: "Blackkin",
  robots: "noindex, nofollow",
};

export default function ChallengePage() {
  if (!TURNSTILE_ENABLED) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 p-6">
      {/* Logo */}
      <Image
        src="/assets/blackkin_logo_white.svg"
        alt="Blackkin"
        width={40}
        height={40}
        priority
        className="opacity-70"
      />

      {/* Brand */}
      <div className="text-center space-y-1.5">
        <p className="text-white/60 text-xs tracking-[0.3em] uppercase font-light">
          Blackkin
        </p>
        <p className="text-white/25 text-[10px] tracking-wider">
          Performing security verification
        </p>
      </div>

      {/* Turnstile: auto-verifies for most visitors without interaction */}
      <Suspense
        fallback={
          <div className="h-16.25 w-75 rounded bg-white/5 animate-pulse" />
        }
      >
        <ChallengeWidget />
      </Suspense>
    </div>
  );
}
