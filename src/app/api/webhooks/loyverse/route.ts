import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { processReceiptsEvent, PosReceiptHint } from '@/lib/loyverseWebhook';

// Webhook de Loyverse.
//
// Autenticación (basta UNA de las dos):
//   a) Clave en la URL registrada en Loyverse:  /api/webhooks/loyverse?k=<LOYVERSE_WEBHOOK_SECRET>
//   b) Firma HMAC-SHA1 (base64) del cuerpo en X-Loyverse-Signature / X-Loyverse-Webhook-Signature.
// Además, para recibos NUNCA se confía en el contenido: se vuelve a consultar el recibo a la API de
// Loyverse antes de cambiar un pedido (ver src/lib/loyverseWebhook.ts).
// Todo se procesa ANTES de responder: en Vercel (serverless) el trabajo "en segundo plano" se corta.

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function checkAuth(req: Request, rawBody: string): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.LOYVERSE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] LOYVERSE_WEBHOOK_SECRET no está configurado: webhook rechazado.');
      return { ok: false, status: 503, error: 'Webhook no configurado' };
    }
    return { ok: true }; // desarrollo local sin secreto
  }

  const urlKey = new URL(req.url).searchParams.get('k');
  if (urlKey && safeEqual(urlKey, secret)) return { ok: true };

  const signature = req.headers.get('x-loyverse-signature') || req.headers.get('x-loyverse-webhook-signature');
  if (signature) {
    const computed = crypto.createHmac('sha1', secret).update(rawBody).digest('base64');
    if (safeEqual(computed, signature)) return { ok: true };
  }

  console.warn('[SECURITY] Webhook rechazado: sin clave válida ni firma válida.');
  return { ok: false, status: 401, error: 'No autorizado' };
}

// Disponibilidad de productos por inventario/artículos de Loyverse (hoy inerte: ningún producto
// tiene loyverse_item_id). Se conserva tal cual estaba.
async function processInventoryEvent(admin: SupabaseClient, payload: any) {
  const eventType = payload?.type || 'unknown';
  const affectedVariantIds: string[] = [];
  const isAvailableMap: Record<string, boolean> = {};

  if (eventType === 'inventory_levels.update') {
    for (const level of payload.inventory_levels || []) {
      if (level.variant_id) {
        affectedVariantIds.push(level.variant_id);
        isAvailableMap[level.variant_id] = level.in_stock > 0;
      }
    }
  } else if (eventType === 'items.update') {
    for (const item of payload.items || []) {
      for (const variant of item.variants || []) {
        affectedVariantIds.push(variant.variant_id);
        isAvailableMap[variant.variant_id] = true;
      }
    }
  }

  if (affectedVariantIds.length === 0) return 0;
  const { data: products } = await admin.from('products').select('id, loyverse_item_id').in('loyverse_item_id', affectedVariantIds);
  let updated = 0;
  for (const prod of products || []) {
    if (prod.loyverse_item_id && isAvailableMap[prod.loyverse_item_id] !== undefined) {
      await admin.from('products').update({ available: isAvailableMap[prod.loyverse_item_id] }).eq('id', prod.id);
      updated++;
    }
  }
  return updated;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const auth = checkAuth(req, rawBody);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Registrar el evento (auditoría)
    const eventType: string = payload?.type || 'unknown';
    const { data: logEntry, error: logErr } = await admin
      .from('webhook_logs')
      .insert([{ event_type: eventType, payload, status: 'pending' }])
      .select('id')
      .single();
    if (logErr) console.error('[WEBHOOK] No se pudo registrar el evento en webhook_logs:', logErr.message);

    const finish = async (status: 'processed' | 'error', details?: string) => {
      if (!logEntry) return;
      await admin.from('webhook_logs').update({
        status,
        processed_at: new Date().toISOString(),
        error_details: details ?? null,
      }).eq('id', logEntry.id);
    };

    try {
      let summary: unknown = null;

      if (eventType.startsWith('receipts.')) {
        const hints: PosReceiptHint[] = payload.receipts || (payload.receipt ? [payload.receipt] : []);
        const outcomes = await processReceiptsEvent(admin, hints);
        summary = outcomes;
        for (const o of outcomes) {
          if (o.result === 'cancelled' || o.result === 'marked_refunded') {
            console.log(`[LOYVERSE WEBHOOK] Pedido ${o.order_id}: ${o.result} (recibo ${o.receipt_number}).`);
          }
        }
      } else if (eventType === 'inventory_levels.update' || eventType === 'items.update') {
        summary = { products_updated: await processInventoryEvent(admin, payload) };
      }

      await finish('processed', summary ? JSON.stringify(summary).slice(0, 1500) : undefined);
      return NextResponse.json({ success: true, processed: true });
    } catch (processErr) {
      const message = processErr instanceof Error ? processErr.message : String(processErr);
      console.error('[LOYVERSE WEBHOOK] Error procesando evento:', message);
      await finish('error', message.slice(0, 1500));
      // 5xx: fallo temporal (p. ej. la API de Loyverse) → Loyverse puede reintentar el evento
      return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 });
    }

  } catch (error) {
    console.error('Webhook endpoint error:', error);
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 });
  }
}
