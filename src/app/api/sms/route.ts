import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/rateLimit';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { SmsRequest } from '@/types/api-contracts';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || '';

const isTwilioConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID);

// Mensaje genérico de rate limit
const RATE_LIMIT_ERROR = 'Demasiadas solicitudes. Espera unos minutos antes de pedir un nuevo código.';

// Ventana en la que un segundo pedido al mismo teléfono NO genera otro SMS
const OTP_COOLDOWN_SECONDS = 45;
// Tope global diario de SMS (freno de emergencia). Configurable por env.
const parsedCap = parseInt(process.env.OTP_DAILY_CAP || '150', 10);
const OTP_DAILY_CAP = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 150;
// Los clientes en el local comparten la IP pública del Wi-Fi, así que el límite por IP
// debe ser holgado para no bloquear a clientes legítimos en hora pico.
const OTP_IP_HOUR_MAX = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body as SmsRequest;

    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Por favor ingresa un número de celular válido de 10 dígitos.' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────
    // RATE LIMITING — debe ocurrir ANTES de cualquier operación
    // Cada SMS a México cuesta ~US$0.18 + US$0.05 por verificación exitosa.
    // ─────────────────────────────────────────────────────────
    const ip = getClientIP(req);
    const requestStartedAt = Date.now();

    if (isTwilioConfigured) {
      let decision: string | null = null;

      // Límite persistente y atómico en Supabase (funciona en Vercel serverless)
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await createAdminClient().rpc('otp_register_request', {
            p_phone: phone,
            p_ip: ip,
            p_cooldown_s: OTP_COOLDOWN_SECONDS,
            p_phone_hour_max: 3,
            p_phone_day_max: 5,
            p_ip_hour_max: OTP_IP_HOUR_MAX,
            p_global_day_max: OTP_DAILY_CAP,
          });
          if (error) throw error;
          decision = data as string;
        } catch (rlError) {
          // Falla abierta hacia un límite local para no bloquear a clientes legítimos
          console.error('[SMS] Rate limit persistente no disponible, usando fallback local:', rlError);
        }
      }

      if (decision === null) {
        const local = checkRateLimit(`sms:phone:${phone}`, 3, 3600);
        decision = local.allowed ? 'ok' : 'phone_limit';
      }

      // Ya se envió un código hace instantes: NO se cobra otro SMS y el usuario
      // no ve ningún error, simplemente continúa a capturar el código recibido.
      if (decision === 'dedup') {
        console.log(`[SMS] Reenvío evitado (cooldown) para la terminación **${phone.slice(-4)}`);
        return NextResponse.json({ success: true, deduped: true, message: 'Código ya enviado.' });
      }

      if (decision === 'global_limit') {
        console.error('[SMS][ALERTA] Tope diario global de OTP alcanzado.');
        return NextResponse.json(
          { error: 'El servicio de verificación está temporalmente saturado. Intenta más tarde.' },
          { status: 429, headers: { 'Retry-After': '3600' } }
        );
      }

      if (decision !== 'ok') {
        return NextResponse.json(
          { error: RATE_LIMIT_ERROR },
          { status: 429, headers: { 'Retry-After': '600' } }
        );
      }
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

        // Reembolsar el cupo: si Twilio falló no se envió nada, y dejar el registro haría que
        // un reintento inmediato respondiera 'dedup' ("ya enviado") sin que llegue ningún SMS.
        if (isSupabaseConfigured) {
          try {
            await createAdminClient()
              .from('otp_requests')
              .delete()
              .eq('phone', phone)
              .gte('created_at', new Date(requestStartedAt - 2_000).toISOString());
          } catch (refundErr) {
            console.error('[SMS] No se pudo reembolsar el cupo de OTP:', refundErr);
          }
        }

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
