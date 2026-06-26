import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient, isSupabaseConfigured, serverMockUsers } from '@/lib/supabase';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { serialize } from 'cookie';
import { createLoyverseCustomer } from '@/lib/loyverse';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';
import { VerifyOtpRequest } from '@/types/api-contracts';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || '';
const isTwilioConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID);

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
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
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

    // Rate Limiting
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

    // 1. Verificar el código con Twilio Verify V2 (o Dev Mode)
    if (isTwilioConfigured) {
      try {
        const twilio = require('twilio');
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        
        const verificationCheck = await client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
          .verificationChecks
          .create({ to: `+52${phone}`, code });

        if (verificationCheck.status !== 'approved') {
          return NextResponse.json(
            { error: 'El código ingresado es incorrecto o ha expirado.' },
            { status: 400 }
          );
        }
      } catch (verifyError: any) {
        console.error('Twilio Verify check error:', verifyError);
        return NextResponse.json(
          { error: 'Error al verificar el código. Intenta de nuevo.' },
          { status: 400 }
        );
      }
    } else {
      // Dev mode
      if (code !== '123456') { // Fallback 6-digit dev code
        return NextResponse.json(
          { error: 'El código ingresado es incorrecto (Prueba con 123456).' },
          { status: 400 }
        );
      }
    }

    // 2. Buscar o crear usuario
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
        if (!user.loyverse_customer_id) {
          const customerName = user.name || `Cliente ${phone}`;
          backgroundLoyverseSync(user.id, customerName, phone).catch(console.error);
        }
      } else {
        const { data: newUser, error: createError } = await adminClient
          .from('users')
          .insert([{ phone, name: name || null, role: 'customer' }])
          .select()
          .single();

        if (createError) throw createError;
        user = newUser;

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

    // 3. Emitir tokens JWT
    const accessToken = generateAccessToken({ user_id: user.id, phone: user.phone, role: user.role });
    const refreshToken = generateRefreshToken({ user_id: user.id });

    const ACCESS_MAX_AGE  = 15 * 60;          // 15 minutos
    const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30 días

    const response = NextResponse.json({
      success: true,
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
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
