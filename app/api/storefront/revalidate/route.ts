import { revalidatePath, revalidateTag } from "next/cache";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { STOREFRONT_CACHE_TAGS } from "@/lib/storefront-cache";

type RevalidationRequest = {
  scope: "home" | "catalog" | "product" | "all";
  slug?: string;
};

function isSafeSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function expireTags(tags: string[]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }

  const user = await fetchAuthQuery(api.users.getCurrentUserWithRole, {}).catch(
    () => null,
  );
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | RevalidationRequest
    | null;
  if (!body) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.scope === "home") {
    expireTags([STOREFRONT_CACHE_TAGS.home]);
    revalidatePath("/");
  } else if (body.scope === "catalog") {
    expireTags([STOREFRONT_CACHE_TAGS.catalog]);
    revalidatePath("/products");
  } else if (body.scope === "product") {
    if (!body.slug || !isSafeSlug(body.slug)) {
      return Response.json({ error: "Invalid product slug" }, { status: 400 });
    }
    expireTags([
      STOREFRONT_CACHE_TAGS.products,
      STOREFRONT_CACHE_TAGS.slugs,
      STOREFRONT_CACHE_TAGS.catalog,
      STOREFRONT_CACHE_TAGS.home,
      STOREFRONT_CACHE_TAGS.shell,
    ]);
    revalidatePath(`/products/${body.slug}`);
    revalidatePath("/products");
    revalidatePath("/");
    revalidatePath("/", "layout");
  } else if (body.scope === "all") {
    expireTags(Object.values(STOREFRONT_CACHE_TAGS));
    revalidatePath("/", "layout");
  } else {
    return Response.json({ error: "Invalid scope" }, { status: 400 });
  }

  return Response.json({ revalidated: true, scope: body.scope });
}
