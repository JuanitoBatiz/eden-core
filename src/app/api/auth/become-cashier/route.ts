import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured, serverMockUsers } from '@/lib/supabase';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { serialize } from 'cookie';
import crypto from 'crypto';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';

function makeAuthCookie(name: string, value: string, maxAgeSeconds: number, isProduction: boolean): string {
  return serialize(name, value, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
    path: '/'
  });
}

export async function POST(req: Request) {
  try {
    // Rate limiting: máx 3 intentos por IP cada 30 minutos para prevenir fuerza bruta
    const ip = getClientIP(req);
    const rlResult = checkRateLimit(`become-cashier:ip:${ip}`, 3, 1800);
    if (!rlResult.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos fallidos. Espera antes de intentarlo de nuevo.' },
        { status: 429, headers: { 'Retry-After': String(rlResult.retryAfterSeconds) } }
      );
    }

    const { secretCode, name, phone } = await req.json();

    const validCode = process.env.CASHIER_SECRET_CODE;

    if (!validCode) {
      return NextResponse.json({ error: 'El sistema no tiene un código secreto de cajero configurado.' }, { status: 500 });
    }

    if (secretCode !== validCode) {
      return NextResponse.json({ error: 'Código maestro incorrecto.' }, { status: 401 });
    }

    if (!name || !phone) {
      return NextResponse.json({ error: 'El nombre y teléfono son obligatorios.' }, { status: 400 });
    }

    let user: any = null;

    if (isSupabaseConfigured) {
      const adminClient = createAdminClient();
      
      // Buscar usuario existente
      const { data: existingUser } = await adminClient
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (existingUser) {
        // Actualizar rol y nombre
        const { data: updatedUser, error: updateError } = await adminClient
          .from('users')
          .update({ role: 'cashier', name: name })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) throw updateError;
        user = updatedUser;
      } else {
        // Crear nuevo usuario
        const { data: newUser, error: createError } = await adminClient
          .from('users')
          .insert([{ phone, name, role: 'cashier', active: true }])
          .select()
          .single();

        if (createError) throw createError;
        user = newUser;
      }
    } else {
      // Mock logic
      let existingUser = serverMockUsers.find(u => u.phone === phone);
      if (existingUser) {
        existingUser.role = 'cashier';
        existingUser.name = name;
        user = existingUser;
      } else {
        user = {
          id: crypto.randomUUID(),
          phone,
          name,
          role: 'cashier',
          active: true,
          created_at: new Date().toISOString()
        };
        serverMockUsers.push(user);
      }
    }

    // 3. Emitir tokens JWT y crear sesión automáticamente
    const accessToken = generateAccessToken({ user_id: user.id, phone: user.phone, role: user.role });
    const refreshToken = generateRefreshToken({ user_id: user.id });

    const ACCESS_MAX_AGE  = 15 * 60;          // 15 minutos
    const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30 días
    const isProduction = process.env.NODE_ENV === 'production';

    const response = NextResponse.json({
      success: true,
      message: 'Cuenta de cajero creada exitosamente.',
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role
      }
    });

    response.headers.append('Set-Cookie', makeAuthCookie('access_token', accessToken, ACCESS_MAX_AGE, isProduction));
    response.headers.append('Set-Cookie', makeAuthCookie('refresh_token', refreshToken, REFRESH_MAX_AGE, isProduction));

    return response;

  } catch (error: any) {
    console.error('Become cashier error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
