import { redirect } from "next/navigation";

// Registration is no longer a separate step — users log in (or sign up) via OTP
// from the global auth dialog. Redirect to home.
export default function RegisterPage() {
  redirect("/");
}
