"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { normalizePhone, isPhoneNumber } from "@/lib/auth-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, Loader2 } from "lucide-react";
import { trackMetaCustomEvent } from "@/lib/meta-pixel";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL to navigate to after successful login. Defaults to current page. */
  defaultNext?: string;
  /** If true, the dialog cannot be closed (used on the /login page shell). */
  required?: boolean;
}

export function AuthDialog({
  open,
  onOpenChange,
  defaultNext,
  required = false,
}: AuthDialogProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const [phoneInput, setPhoneInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPhoneInput("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (session && open) {
      onOpenChange(false);
      router.push(defaultNext || "/");
    }
  }, [session, open, onOpenChange, defaultNext, router]);

  const handleSignIn = async () => {
    setError(null);

    const cleaned = phoneInput.trim();
    if (!cleaned) {
      setError("Please enter your mobile number.");
      return;
    }

    if (!isPhoneNumber(cleaned)) {
      setError("Please enter a valid mobile number (10-15 digits).");
      return;
    }

    setIsLoading(true);
    try {
      // Phone-only login is intentionally enabled at the client's request.
      // Better Auth still creates the normal user/session and runs Convex user
      // linking triggers; its server-side verifyOTP hook accepts this marker.
      const result = await authClient.phoneNumber.verify({
        phoneNumber: normalizePhone(cleaned),
        code: "phone-only-login",
      });

      if (result.error) {
        setError(result.error.message || "Sign in failed. Please try again.");
      } else {
        // Meta has no standard Login event. Keep this browser-only and
        // fire it only after a user-initiated authentication succeeds.
        trackMetaCustomEvent("Login", { method: "phone" });
      }
      // The session hook above handles closing and navigation on success.
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (required && !value) return;
        onOpenChange(value);
      }}
    >
      {/* Keep the mobile keyboard closed until the customer taps the input. */}
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={
          required ? (event) => event.preventDefault() : undefined
        }
      >
        <DialogHeader className="pt-2 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>Sign in to Blackkin</DialogTitle>
          <DialogDescription>
            Enter your mobile number to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auth-phone">Mobile Number</Label>
              <div className="flex gap-2">
                <span className="inline-flex select-none items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  +88
                </span>
                <Input
                  id="auth-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="01712345678"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSignIn();
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 text-[16px] md:text-sm"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                No account? You&apos;ll be signed up automatically.
              </p>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
