import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';
import { SmsRequest } from '@/types/api-contracts';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || '';

const isTwilioConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID);

// Mensaje genérico de rate limit
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
    // Lógica de Envío de OTP con Twilio Verify V2
    // ─────────────────────────────────────────────────────────
    if (isTwilioConfigured) {
      try {
        const twilio = require('twilio');
        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        
        await client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verifications.create({ 
          to: `+52${phone}`, 
          channel: 'sms' 
        });
        
        console.log(`[SMS] OTP enviado vía Twilio Verify para la terminación **${phone.slice(-4)}`);
        return NextResponse.json({ success: true, message: 'SMS enviado con éxito.' });
      } catch (smsError: any) {
        console.error('Error enviando SMS via Twilio Verify:', smsError);
        return NextResponse.json(
          { error: 'No se pudo enviar el SMS. Verifica el número e intenta de nuevo.' },
          { status: 503 }
        );
      }
    }

    // Modo desarrollo sin Twilio configurado
    console.warn('[DEV MODE] Twilio no configurado. OTP simulado para desarrollo.');
    return NextResponse.json({
      success: true,
      message: 'Código generado en modo de desarrollo.',
      code: '123456' // Código falso de 6 dígitos para pruebas
    });

  } catch (error) {
    console.error('SMS API error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al procesar la solicitud.' },
      { status: 500 }
    );
  }
}
