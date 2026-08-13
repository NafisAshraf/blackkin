import { redirect } from "next/navigation";

// Registration is no longer separate; phone-only login creates users as needed.
// from the global auth dialog. Redirect to home.
export default function RegisterPage() {
  redirect("/");
}
