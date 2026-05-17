import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient(), phoneNumberClient()],
  sessionOptions: {
    // Do NOT refetch the session on every tab-focus or network reconnect.
    // The session is fetched once on load and stays valid until the user
    // explicitly signs in or out. This eliminates the primary driver of
    // excessive Convex auth function calls.
    refetchOnWindowFocus: false,
    // No background polling — session is event-driven only.
    refetchInterval: 0,
  },
});
