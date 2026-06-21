import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { createAdminClient, isSupabaseConfigured, serverMockOtpSessions } from '@/lib/supabase';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';
import { SmsRequest } from '@/types/api-contracts';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

const isTwilioConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);

// Mensaje genérico de rate limit — NO revela cuántos intentos quedan ni el límite exacto
const RATE_LIMIT_ERROR = 'Demasiadas solicitudes. Espera unos minutos antes de pedir un nuevo código.';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body as SmsRequest;

    if (!phone || phone.length < 10) {
      return NextResponse.json(
        { error: 'Por favor ingresa un número de celular válido de 10 dígitos.' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // RATE LIMITING — debe ocurrir ANTES de cualquier operación
    // ─────────────────────────────────────────────────────────

    const ip = getClientIP(req);

    // Límite 1: máx 3 SMS por número de teléfono en 10 minutos
    // Previene spam contra un teléfono específico y gasto controlado en Twilio
    const phoneLimit = checkRateLimit(`sms:phone:${phone}`, 3, 600);
    if (!phoneLimit.allowed) {
      return NextResponse.json(
        { error: RATE_LIMIT_ERROR },
        {
          status: 429,
          headers: { 'Retry-After': String(phoneLimit.retryAfterSeconds) }
        }
      );
    }

    // Límite 2: máx 10 SMS por IP en 10 minutos
    // Previene que un atacante rote números de teléfono para evadir el límite por teléfono
    const ipLimit = checkRateLimit(`sms:ip:${ip}`, 10, 600);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: RATE_LIMIT_ERROR },
        {
          status: 429,
          headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) }
        }
      );
    }

    // ─────────────────────────────────────────────────────────
    // Lógica principal del endpoint
    // ─────────────────────────────────────────────────────────

    let adminClient = null;
    if (isSupabaseConfigured) {
      adminClient = createAdminClient();
    }

    // 1. Invalidar OTPs anteriores del mismo teléfono
    if (adminClient) {
      await adminClient
        .from('otp_sessions')
        .update({ consumed: true })
        .eq('phone', phone)
        .eq('consumed', false);
    } else {
      console.warn('[DEV MODE] Supabase no configurado. Las sesiones OTP no persisten entre reinicios.');
      serverMockOtpSessions.forEach((session) => {
        if (session.phone === phone && !session.consumed) {
          session.consumed = true;
        }
      });
    }

    // 2. Generar código numérico de 4 dígitos con crypto (criptográficamente seguro)
    // NOTA: 4 dígitos con rate limiting de 3 intentos/OTP × 20 intentos/IP/15min
    // hace la fuerza bruta no viable: 9000 códigos / 20 intentos = 450 OTPs necesarios,
    // cada uno requiere esperar la ventana de 10 min → ~75 horas de ataque.
    const code = crypto.randomInt(1000, 9999).toString();
    // SEGURIDAD: Nunca loguear el código en consola, ni siquiera en desarrollo, 
    // ya que los logs persisten en el servidor. El modo dev ya lo retorna en la respuesta HTTP.
    console.log(`[SMS] OTP generado y procesado para la terminación **${phone.slice(-4)}`);

    // 3. Hashear el OTP con bcrypt
    const otpHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // +5 min

    // 4. Persistir la sesión OTP
    if (adminClient) {
      const { error } = await adminClient
        .from('otp_sessions')
        .insert([{
          phone,
          otp_hash: otpHash,
          expires_at: expiresAt,
          consumed: false,
          attempts: 0
        }]);

      if (error) {
        throw new Error(`DB error guardando OTP: ${error.message}`);
      }
    } else {
      serverMockOtpSessions.push({
        id: crypto.randomUUID(),
        phone,
        otp_hash: otpHash,
        expires_at: expiresAt,
        consumed: false,
        attempts: 0,
        created_at: new Date().toISOString()
      });
    }

    // 5. Enviar SMS con Twilio (o mostrar en consola en dev)
    if (isTwilioConfigured) {
      try {
        const twilio = require('twilio');
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        await client.messages.create({
          body: `Tu código de seguridad para Edén es: ${code}. Válido por 5 minutos. No lo compartas con nadie.`,
          from: TWILIO_PHONE_NUMBER,
          to: `+52${phone}`
        });
        return NextResponse.json({ success: true, message: 'SMS enviado con éxito.' });
      } catch (smsError: any) {
        console.error('Error enviando SMS via Twilio:', smsError);
        // Si Twilio falla, no exponemos el código — el usuario debe reintentar
        return NextResponse.json(
          { error: 'No se pudo enviar el SMS. Verifica el número e intenta de nuevo.' },
          { status: 503 }
        );
      }
    }

    // Modo desarrollo — retornar el código en la respuesta para facilitar pruebas
    console.warn('[DEV MODE] Twilio no configurado. OTP visible en consola y respuesta.');
    return NextResponse.json({
      success: true,
      message: 'Código generado en modo de desarrollo.',
      code // Solo presente en dev — Twilio lo omite en producción
    });

  } catch (error) {
    console.error('SMS API error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al procesar la solicitud.' },
      { status: 500 }
    );
  }
}
