import { NextResponse } from 'next/server';
import { verifyAccessToken, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    // Rate limiting: máx 3 intentos por IP cada 30 minutos para prevenir fuerza bruta
    const ip = getClientIP(req);
    const rlResult = checkRateLimit(`upgrade-role:ip:${ip}`, 3, 1800);
    if (!rlResult.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos fallidos. Espera antes de intentarlo de nuevo.' },
        { status: 429, headers: { 'Retry-After': String(rlResult.retryAfterSeconds) } }
      );
    }

    const { secretCode } = await req.json();

    if (!secretCode) {
      return NextResponse.json({ error: 'Código secreto requerido' }, { status: 400 });
    }

    if (secretCode !== process.env.OWNER_SECRET_CODE) {
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 403 });
    }

    let targetUserId: string;

    try {
      const userPayload = await verifyAccessToken(req);
      targetUserId = userPayload.user_id;

      if (isSupabaseConfigured) {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.from('users').update({ role: 'owner' }).eq('id', targetUserId);
      }
    } catch (e: any) {
      if (isSupabaseConfigured) {
        const supabaseAdmin = createAdminClient();
        const { data: ownerUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('phone', '0000000000')
          .single();

        if (ownerUser) {
          targetUserId = ownerUser.id;
        } else {
          const { data: newOwner } = await supabaseAdmin
            .from('users')
            .insert([{ phone: '0000000000', name: 'Dueño Maestro', role: 'owner', active: true }])
            .select('id')
            .single();
          targetUserId = newOwner?.id || 'master-owner-id';
        }
      } else {
        targetUserId = 'master-owner-mock';
      }
    }

    // Emitir nuevos tokens con el rol actualizado
    const newAccessToken = generateAccessToken({ user_id: targetUserId, role: 'owner' });
    const newRefreshToken = generateRefreshToken({ user_id: targetUserId });

    const response = NextResponse.json({ message: 'Rol actualizado a Owner exitosamente' }, { status: 200 });

    // Configurar cookies de forma segura
    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 // 15 minutos
    });

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 días
    });

    return response;

  } catch (error) {
    console.error('Error en upgrade-role:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
