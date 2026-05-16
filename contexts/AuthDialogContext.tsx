"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { AuthDialog } from "@/components/auth/AuthDialog";

interface AuthDialogContextValue {
  /** Opens the login/OTP dialog. Optionally pass a URL to navigate to after success. */
  openAuth: (next?: string) => void;
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [nextUrl, setNextUrl] = useState<string | undefined>(undefined);

  const openAuth = useCallback((next?: string) => {
    setNextUrl(next);
    setIsOpen(true);
  }, []);

  return (
    <AuthDialogContext.Provider value={{ openAuth }}>
      {children}
      <AuthDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        defaultNext={nextUrl}
      />
    </AuthDialogContext.Provider>
  );
}

export function useAuthDialog(): AuthDialogContextValue {
  const ctx = useContext(AuthDialogContext);
  if (!ctx) {
    throw new Error("useAuthDialog must be used within AuthDialogProvider");
  }
  return ctx;
}
