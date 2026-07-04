import { handler } from "@/lib/auth-server";

function isLocalTlsCertificateError(error: unknown): boolean {
  let current: unknown = error;

  while (current instanceof Error) {
    const errorWithCode = current as Error & {
      code?: string;
      cause?: unknown;
    };
    if (
      errorWithCode.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      errorWithCode.message.includes("unable to verify the first certificate")
    ) {
      return true;
    }
    current = errorWithCode.cause;
  }

  return false;
}

async function handleAuthRequest(
  request: Request,
  method: "GET" | "POST",
): Promise<Response> {
  try {
    return await handler[method](request);
  } catch (error) {
    const pathname = new URL(request.url).pathname;
    if (
      process.env.NODE_ENV === "development" &&
      pathname.endsWith("/get-session") &&
      isLocalTlsCertificateError(error)
    ) {
      return Response.json(null);
    }

    throw error;
  }
}

export const GET = (request: Request) => handleAuthRequest(request, "GET");
export const POST = (request: Request) => handleAuthRequest(request, "POST");
