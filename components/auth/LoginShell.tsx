"use client";

import { useEffect } from "react";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useState } from "react";

/**
 * Thin client shell rendered by the /login server page.
 * Immediately opens the AuthDialog in non-closeable mode so the user must
 * authenticate. After success the dialog navigates to `next` or home.
 */
export function LoginShell({ next }: { next?: string }) {
  const [open, setOpen] = useState(false);

  // Open on mount (avoids hydration mismatch)
  useEffect(() => {
    setOpen(true);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Logo visible behind the dialog */}
      <img
        src="/assets/blackkin_logo_text_black_trimmed.svg"
        alt="Blackkin"
        className="h-20 w-auto opacity-20"
      />
      <AuthDialog
        open={open}
        onOpenChange={setOpen}
        defaultNext={next || "/"}
        required
      />
    </div>
  );
}
