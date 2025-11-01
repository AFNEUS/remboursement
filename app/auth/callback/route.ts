import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  
  // Rediriger vers une page qui gère le hash fragment côté client
  return NextResponse.redirect(new URL('/auth/callback-handler', requestUrl.origin));
}
