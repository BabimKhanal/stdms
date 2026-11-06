import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "edu_access_token";

export function proxy(request: NextRequest) {
  if (!request.cookies.get(ACCESS_TOKEN_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/v1(?:/|$)|login(?:/|$)|forgot-password(?:/|$)|reset-password(?:/|$)|_next/static|_next/image|favicon.ico).*)",
  ],
};
