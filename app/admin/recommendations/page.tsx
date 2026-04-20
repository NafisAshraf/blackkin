import { redirect } from "next/navigation";

export default function RecommendationsPage() {
  redirect("/admin/products?tab=recommendations");
}
import { Id } from "@/convex/_generated/dataModel";
