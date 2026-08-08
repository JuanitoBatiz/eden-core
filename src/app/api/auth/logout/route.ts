import { NextResponse } from 'next/server';


/**
 * POST /api/auth/logout
 * Limpia las cookies de sesión (access_token y refresh_token) seteando maxAge=0.
 * El navegador elimina inmediatamente las cookies expiradas.
 */
export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente.' });

  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');

  return response;
}
