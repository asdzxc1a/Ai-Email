// email-productivity-tool/middleware.js
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      // Not logged in, redirect to home or a login page
      // For now, redirecting to home. Consider a dedicated login page if you have one.
      const url = req.nextUrl.clone();
      url.pathname = '/'; 
      // Optionally add a callbackUrl: url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }

    if (!token.isAdmin) {
      // Logged in but not an admin, redirect to a 'forbidden' page or home
      const url = req.nextUrl.clone();
      url.pathname = '/403'; // Assuming you'll create a pages/403.js page
      // Or redirect to home: url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Allow the request to proceed
  return NextResponse.next();
}

// Specify which paths this middleware should run on
export const config = {
  matcher: ['/admin/:path*'],
};
