import { NextResponse } from 'next/server';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { createAdminClient, isSupabaseConfigured, serverMockUsers } from '@/lib/supabase';
import { parse, serialize } from 'cookie';

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = parse(cookieHeader);
    const refreshToken = cookies.refresh_token;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No autorizado. Se requiere refresh token.' }, { status: 401 });
    }

    const payload = verifyRefreshToken(refreshToken);
    const userId = payload.user_id;

    let user: any = null;

    if (isSupabaseConfigured) {
      let adminSupabase;
      try {
        adminSupabase = createAdminClient();
      } catch (configErr: any) {
        console.error('Refresh token: falta SUPABASE_SERVICE_ROLE_KEY:', configErr.message);
        return NextResponse.json({ error: 'Error de configuración del servidor.' }, { status: 500 });
      }

      const { data, error } = await adminSupabase
        .from('users')
        .select('id, name, phone, role, active')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Refresh token: error al consultar usuario en DB:', error.message);
        return NextResponse.json({ error: 'Error al verificar la sesión. Intenta de nuevo.' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ error: 'Usuario no encontrado. La sesión ya no es válida.' }, { status: 401 });
      }

      user = data;
    } else {
      user = serverMockUsers.find(u => u.id === userId);
    }

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Cuenta desactivada. Contacta al administrador.' }, { status: 401 });
    }

    // Emitir nuevo access_token con datos actualizados del usuario
    const accessToken = generateAccessToken({ user_id: user.id, phone: user.phone, role: user.role });
    const newRefreshToken = generateRefreshToken({ user_id: user.id });

    const isProduction = process.env.NODE_ENV === 'production';
    const ACCESS_MAX_AGE = 2 * 60 * 60;         // 2 horas
    const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;  // 30 días

    // Setear el nuevo access_token como cookie httpOnly — no retornar en body
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, role: user.role, name: user.name, phone: user.phone }
      // NOTA INTENCIONAL: access_token NO va en el body, viaja solo en cookie httpOnly
    });

    response.headers.set('Set-Cookie', serialize('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: ACCESS_MAX_AGE,
      path: '/'
    }));

    response.headers.append('Set-Cookie', serialize('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: REFRESH_MAX_AGE,
      path: '/'
    }));

    return response;

  } catch (error: any) {
    console.error('Refresh token error:', error.message);
    return NextResponse.json(
      { error: 'Refresh token inválido o expirado. Vuelve a iniciar sesión.' },
      { status: 401 }
    );
  }
}
