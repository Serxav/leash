import { NextResponse, type NextRequest } from "next/server";
import { isVisitorId, VISITOR_COOKIE, visitorCookieOptions } from "@/account/visitor-cookie";

/**
 * Gives every visitor an anonymous demo user (D-040): a random ID in an
 * httpOnly cookie, renewed on each visit. A new ID is also added to this
 * request, so the very first page already sees it. No database work here:
 * pages create the demo user when they first read it (`currentUserId`).
 */
export function proxy(request: NextRequest) {
  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitorId)) {
    visitorId = crypto.randomUUID();
    request.cookies.set(VISITOR_COOKIE, visitorId);
  }
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(VISITOR_COOKIE, visitorId, visitorCookieOptions());
  return response;
}

export const config = {
  // Pages and server actions only: not the health check, build files or images.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
