"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Turnstile } from "@marsidev/react-turnstile";
import { RefreshCw } from "lucide-react";

// Public site key: safe to hardcode (it is embedded in the HTML by design).
// NEXT_PUBLIC_* vars require a rebuild to take effect; hardcoding avoids that.
// Turnstile is intentionally disabled for the ExonHost migration/test
// deployment. This widget is kept intact for a future re-enable.
const TURNSTILE_SITE_KEY = "0x4AAAAAADYoRGmEfgizC8L1";

export function ChallengeWidget() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  // If the server redirected back with ?error=1, start in error state.
  const hasError = searchParams.get("error") === "1";

  const [status, setStatus] = useState<"idle" | "verifying" | "error">(
    hasError ? "error" : "idle",
  );

  function handleSuccess(token: string) {
    setStatus("verifying");
    // Submit a native hidden form instead of fetch() + window.location.
    // On iOS Chrome, cookies from fetch() responses are not guaranteed to be
    // committed to the cookie jar before window.location fires, causing an
    // infinite /challenge redirect loop. A native form POST + server 303
    // redirect makes the browser commit Set-Cookie atomically before loading
    // the destination. This works correctly on all browsers.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/turnstile";
    form.style.display = "none";

    const addField = (name: string, value: string) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addField("cf-turnstile-response", token);
    addField("next", next);

    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Widget is always rendered in idle/verifying; Turnstile auto-verifies
          most real users silently (managed mode); they never need to click. */}
      {status !== "error" && (
        <Turnstile
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={handleSuccess}
          onError={() => setStatus("error")}
          onExpire={() => setStatus("idle")}
          options={{ theme: "dark", size: "normal" }}
        />
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-white/40 text-xs tracking-wide">
            Security check failed.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs tracking-widest uppercase transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
