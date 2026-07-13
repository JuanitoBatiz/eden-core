import { NextResponse } from 'next/server';
import { serialize } from 'cookie';

/**
 * POST /api/auth/logout
 * Limpia las cookies de sesión (access_token y refresh_token) seteando maxAge=0.
 * El navegador elimina inmediatamente las cookies expiradas.
 */
export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente.' });

  const expiredCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,  // Expiración inmediata — el navegador borrará la cookie
    path: '/'
  };

  response.headers.append('Set-Cookie', serialize('access_token', '', expiredCookieOptions));
  response.headers.append('Set-Cookie', serialize('refresh_token', '', expiredCookieOptions));

  return response;
}
