"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ArrowLeft, Phone, Loader2 } from "lucide-react";

type Step = "phone" | "otp";

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

  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Resend countdown
  const [resendCountdown, setResendCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset to phone step when dialog opens
  useEffect(() => {
    if (open) {
      setStep("phone");
      setPhoneInput("");
      setNormalizedPhone("");
      setOtp("");
      setError(null);
    }
  }, [open]);

  // If the user is already signed in, close the dialog and navigate
  useEffect(() => {
    if (session && open) {
      onOpenChange(false);
      const dest = defaultNext || "/";
      router.push(dest);
    }
  }, [session, open, onOpenChange, defaultNext, router]);

  // Countdown timer for OTP resend
  function startCountdown() {
    setResendCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleSendOtp = async () => {
    setError(null);

    if (!phoneInput.trim()) {
      setError("Please enter your mobile number.");
      return;
    }

    const cleaned = phoneInput.trim();
    if (!isPhoneNumber(cleaned)) {
      setError("Please enter a valid mobile number (10–15 digits).");
      return;
    }

    const phone = normalizePhone(cleaned);
    setIsLoading(true);
    try {
      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: phone,
      });
      if (result.error) {
        setError(result.error.message || "Failed to send OTP. Try again.");
        return;
      }
      setNormalizedPhone(phone);
      setStep("otp");
      startCountdown();
    } catch {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);

    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.phoneNumber.verify({
        phoneNumber: normalizedPhone,
        code: otp,
      });
      if (result.error) {
        setError(
          result.error.message || "Invalid or expired OTP. Please try again.",
        );
        setOtp("");
        return;
      }
      // Session will update; the session useEffect above handles navigation.
    } catch {
      setError("Verification failed. Please try again.");
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setOtp("");
    setError(null);
    setIsLoading(true);
    try {
      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: normalizedPhone,
      });
      if (result.error) {
        setError(result.error.message || "Failed to resend OTP.");
        return;
      }
      startCountdown();
    } catch {
      setError("Failed to resend OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-verify when OTP is fully entered
  useEffect(() => {
    if (step === "otp" && otp.length === 6 && !isLoading) {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (required && !v) return; // prevent closing when required
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="max-w-sm"
        // Prevent accidental dismiss on overlay click when required
        onInteractOutside={required ? (e) => e.preventDefault() : undefined}
      >
        {/* Back button when on OTP step */}
        {step === "otp" && (
          <button
            className="absolute left-4 top-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            onClick={() => {
              setStep("phone");
              setOtp("");
              setError(null);
            }}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <DialogHeader className="text-center pt-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>
            {step === "phone" ? "Sign in to Blackkin" : "Enter OTP"}
          </DialogTitle>
          <DialogDescription>
            {step === "phone"
              ? "Enter your mobile number. We'll send you a one-time code."
              : `We sent a 6-digit code to ${normalizedPhone}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {error && (
            <p className="text-sm text-destructive text-center rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          {step === "phone" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="auth-phone">Mobile Number</Label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground select-none">
                    +880
                  </span>
                  <Input
                    id="auth-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="01712345678"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSendOtp();
                      }
                    }}
                    disabled={isLoading}
                    autoFocus
                    className="flex-1"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  No account? You'll be signed up automatically.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleSendOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send OTP"
                )}
              </Button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <Label className="sr-only">One-time code</Label>
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full"
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.length < 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify & Sign In"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Didn&apos;t receive it?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCountdown > 0 || isLoading}
                  className="underline underline-offset-2 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendCountdown > 0
                    ? `Resend in ${resendCountdown}s`
                    : "Resend OTP"}
                </button>
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
