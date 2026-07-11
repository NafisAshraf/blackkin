import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storageId: string[] }> },
) {
  const { storageId } = await params;
  const key = storageId.map(decodeURIComponent).join("/");
  const signedUrl = await fetchQuery(api.files.getUrl, { storageId: key });

  if (!signedUrl) {
    return new Response("Media not found", { status: 404 });
  }

  return Response.redirect(signedUrl, 307);
}
