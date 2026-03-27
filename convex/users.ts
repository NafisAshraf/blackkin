import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const getCurrentUserWithRole = query({
  args: {},
  handler: async (ctx) => {
    // getAuthUser throws ConvexError("Unauthenticated") during sign-out: the Convex
    // JWT is still technically present but the better-auth session is already
    // invalidated server-side. Catch it and return null gracefully.
    let authUser;
    try {
      authUser = await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
    if (!authUser) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
      .unique();

    return user ?? null;
  },
});

