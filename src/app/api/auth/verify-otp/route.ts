import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createAdminClient, isSupabaseConfigured, serverMockOtpSessions, serverMockUsers } from '@/lib/supabase';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { serialize } from 'cookie';
import { createLoyverseCustomer } from '@/lib/loyverse';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';
import { VerifyOtpRequest } from '@/types/api-contracts';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

async function backgroundLoyverseSync(userId: string, name: string, phone: string) {
  if (!isSupabaseConfigured) return;
  try {
    const adminClient = createAdminClient();
    const loyverseId = await createLoyverseCustomer(name, phone);
    await adminClient.from('users').update({ loyverse_customer_id: loyverseId }).eq('id', userId);
  } catch (error: any) {
    console.error('Background Loyverse Sync Failed, queuing retry:', error);
    try {
      const adminClient = createAdminClient();
      await adminClient.from('loyverse_sync_queue').insert([{
        entity_type: 'customer_create',
        entity_id: userId,
        payload: { name, phone },
        status: 'pending',
        next_retry_at: new Date(Date.now() + 60000).toISOString()
      }]);
    } catch (queueErr: any) {
      console.error('Failed to queue Loyverse retry:', queueErr);
    }
  }
}

/**
 * Genera y serializa una cookie httpOnly para un token de autenticación.
 */
function makeAuthCookie(name: string, value: string, maxAgeSeconds: number, isProduction: boolean): string {
  return serialize(name, value, {
    httpOnly: true,                       // no accesible desde JS del cliente
    secure: isProduction,                 // solo HTTPS en producción
    sameSite: 'strict',                   // protección contra CSRF
    maxAge: maxAgeSeconds,
    path: '/'
  });
}

// ─────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, code, name } = body as VerifyOtpRequest;

    if (!phone || !code) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────
    // RATE LIMITING POR IP — antes de cualquier operación de DB
    // ─────────────────────────────────────────────────────────
    // Máximo 20 intentos de verificación por IP en 15 minutos.
    // Esto cierra el hueco donde un atacante pide un OTP nuevo cada 5 intentos
    // y reinicia el contador por sesión — sin este check global por IP,
    // la fuerza bruta sobre códigos de 4 dígitos sería viable.
    const ip = getClientIP(req);
    const ipLimit = checkRateLimit(`otp:verify:ip:${ip}`, 20, 900); // 15 minutos
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera unos minutos antes de continuar.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) }
        }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    let session: any = null;

    // 1. Buscar el OTP más reciente válido
    if (isSupabaseConfigured) {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient
        .from('otp_sessions')
        .select('*')
        .eq('phone', phone)
        .eq('consumed', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        session = data;
      }
    } else {
      // Dev mode: buscar en mock en memoria
      console.warn('[DEV MODE] OTP sessions no persisten entre reinicios del servidor.');
      const validSessions = serverMockOtpSessions
        .filter(s => s.phone === phone && !s.consumed && new Date(s.expires_at) > new Date())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (validSessions.length > 0) {
        session = validSessions[0];
      }
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Código expirado o no encontrado, solicita uno nuevo' },
        { status: 400 }
      );
    }

    // 2. Verificar intentos máximos
    if (session.attempts >= 5) {
      if (isSupabaseConfigured) {
        const adminClient = createAdminClient();
        await adminClient.from('otp_sessions').update({ consumed: true }).eq('id', session.id);
      } else {
        session.consumed = true;
      }
      return NextResponse.json(
        { error: 'Demasiados intentos, solicita un nuevo código' },
        { status: 429 }
      );
    }

    // 3. Comparar el hash del código
    const isValid = await bcrypt.compare(code, session.otp_hash);

    if (!isValid) {
      const newAttempts = session.attempts + 1;
      if (isSupabaseConfigured) {
        const adminClient = createAdminClient();
        await adminClient.from('otp_sessions').update({ attempts: newAttempts }).eq('id', session.id);
      } else {
        session.attempts = newAttempts;
      }
      return NextResponse.json(
        { error: 'El código ingresado es incorrecto.' },
        { status: 400 }
      );
    }

    // 4. Marcar OTP como consumido
    if (isSupabaseConfigured) {
      const adminClient = createAdminClient();
      await adminClient.from('otp_sessions').update({ consumed: true }).eq('id', session.id);
    } else {
      session.consumed = true;
    }

    // 5. Buscar o crear usuario
    let user: any = null;

    if (isSupabaseConfigured) {
      const adminClient = createAdminClient();
      const { data: existingUser } = await adminClient
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (existingUser) {
        user = existingUser;
      } else {
        const { data: newUser, error: createError } = await adminClient
          .from('users')
          .insert([{ phone, name: name || null, role: 'customer' }])
          .select()
          .single();

        if (createError) throw createError;
        user = newUser;

        // Sincronización asíncrona con Loyverse (no bloquea el login)
        const customerName = name || `Cliente ${phone}`;
        backgroundLoyverseSync(user.id, customerName, phone).catch(console.error);
      }
    } else {
      // Mock sin Supabase
      let existingUser = serverMockUsers.find(u => u.phone === phone);
      if (existingUser) {
        user = existingUser;
      } else {
        user = {
          id: crypto.randomUUID(),
          phone,
          name: name || null,
          role: 'customer',
          active: true,
          created_at: new Date().toISOString()
        };
        serverMockUsers.push(user);
      }
    }

    // 6. Emitir tokens JWT
    const accessToken = generateAccessToken({ user_id: user.id, phone: user.phone, role: user.role });
    const refreshToken = generateRefreshToken({ user_id: user.id });

    // 7. Setear AMBOS tokens como cookies httpOnly — ningún token toca el JS del cliente
    const ACCESS_MAX_AGE  = 15 * 60;         // 15 minutos
    const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 días

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role
      }
      // NOTA INTENCIONAL: access_token NO se retorna en el body.
      // El navegador lo leerá automáticamente de la cookie httpOnly.
    });

    response.headers.append('Set-Cookie', makeAuthCookie('access_token', accessToken, ACCESS_MAX_AGE, isProduction));
    response.headers.append('Set-Cookie', makeAuthCookie('refresh_token', refreshToken, REFRESH_MAX_AGE, isProduction));

    return response;

  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
