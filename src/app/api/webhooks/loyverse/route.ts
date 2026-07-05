import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Helper: Process the event asynchronously to avoid holding the Loyverse connection
async function processWebhookAsync(payload: any, logId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) return;

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
  
  try {
    // Determine event type from payload or Loyverse structure
    // Some Loyverse webhooks send the event type in a wrapper, others directly
    const eventType = payload?.type || 'unknown'; 
    let affectedVariantIds: string[] = [];
    let isAvailableMap: Record<string, boolean> = {};

    if (eventType === 'inventory_levels.update') {
      const inventoryLevels = payload.inventory_levels || [];
      for (const level of inventoryLevels) {
        if (level.variant_id) {
          affectedVariantIds.push(level.variant_id);
          // If in_stock is > 0, it's available
          isAvailableMap[level.variant_id] = level.in_stock > 0;
        }
      }
    } else if (eventType === 'items.update') {
      const items = payload.items || [];
      for (const item of items) {
        if (item.variants && item.variants.length > 0) {
          for (const variant of item.variants) {
            affectedVariantIds.push(variant.variant_id);
            // By default, if the item exists, assume available unless we track stock 
            // from inventory levels. For items.update, we might just assume true or check tracking.
            isAvailableMap[variant.variant_id] = true; 
          }
        }
      }
    } else if (eventType.startsWith('receipts.')) {
      const receipts = payload.receipts || (payload.receipt ? [payload.receipt] : []);
      for (const receipt of receipts) {
        // Verificar si el recibo fue anulado en Loyverse POS o es una devolución/nota de crédito
        const isCancelled = !!receipt.cancelled_at || receipt.receipt_type === 'CANCELLED' || receipt.receipt_type === 'REFUND';
        
        if (isCancelled) {
          // Buscar qué ID de recibo de Loyverse estamos anulando
          const targetReceiptId = receipt.refund_for || receipt.id;
          const targetReceiptNum = receipt.receipt_number;

          // Buscar la orden correspondiente en nuestra base de datos por ID o por número de recibo (robusto ante cambios de formato)
          let query = adminSupabase.from('orders').select('*');
          const conditions = [];
          if (targetReceiptId) {
            conditions.push(`loyverse_receipt_id.eq.${targetReceiptId}`);
          }
          if (targetReceiptNum) {
            conditions.push(`loyverse_receipt_id.eq.${targetReceiptNum}`);
            conditions.push(`loyverse_receipt_number.eq.${targetReceiptNum}`);
          }

          if (conditions.length > 0) {
            query = query.or(conditions.join(','));
          }

          const { data: matchingOrders } = await query;
          if (matchingOrders && matchingOrders.length > 0) {
            for (const order of matchingOrders) {
              if (order.status !== 'cancelled') {
                const updatePayload: any = {
                  status: 'cancelled',
                  cancel_reason: 'Anulado directamente desde caja (Loyverse POS)'
                };
                if (order.payment_status === 'payment_approved') {
                  updatePayload.refund_status = 'pending';
                }
                await adminSupabase.from('orders').update(updatePayload).eq('id', order.id);
                console.log(`[LOYVERSE WEBHOOK] Orden ${order.id} cancelada automáticamente por anulación en POS.`);
              }
            }
          }
        }
      }
    }

    if (affectedVariantIds.length > 0) {
      // Fetch matching products from DB
      const { data: products } = await adminSupabase
        .from('products')
        .select('id, loyverse_item_id')
        .in('loyverse_item_id', affectedVariantIds);

      if (products && products.length > 0) {
        // Update availability
        for (const prod of products) {
          if (prod.loyverse_item_id && isAvailableMap[prod.loyverse_item_id] !== undefined) {
            await adminSupabase.from('products')
              .update({ available: isAvailableMap[prod.loyverse_item_id] })
              .eq('id', prod.id);
          }
        }
      }
    }

    // Mark log as processed
    await adminSupabase.from('webhook_logs').update({
      status: 'processed',
      processed_at: new Date().toISOString()
    }).eq('id', logId);

  } catch (error: any) {
    console.error('Error processing webhook async:', error);
    await adminSupabase.from('webhook_logs').update({
      status: 'error',
      processed_at: new Date().toISOString(),
      error_details: error.message
    }).eq('id', logId);
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('X-Loyverse-Signature');
    const secret = process.env.LOYVERSE_WEBHOOK_SECRET;

    // 1. Verify HMAC if configured
    if (secret) {
      if (!signature) {
        // Si el secreto está configurado en el servidor, la firma es OBLIGATORIA.
        // Rechazar silenciosamente con 401 para no revelar información al atacante.
        console.warn('[SECURITY] Webhook rechazado: LOYVERSE_WEBHOOK_SECRET configurado pero X-Loyverse-Signature ausente.');
        return NextResponse.json({ error: 'Firma requerida' }, { status: 401 });
      }

      const hmac = crypto.createHmac('sha1', secret);
      hmac.update(rawBody);
      const computedSignature = hmac.digest('base64');

      if (computedSignature !== signature) {
        console.warn('[SECURITY] Webhook rechazado: firma HMAC inválida.');
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
      }
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch(e) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Log incoming webhook synchronously
    const { data: logEntry, error: logErr } = await adminSupabase
      .from('webhook_logs')
      .insert([{
        event_type: payload?.type || 'unknown',
        payload: payload,
        status: 'pending'
      }])
      .select('id')
      .single();

    if (logErr) throw logErr;

    // 3. Process asynchronously (Fire and Forget)
    if (logEntry) {
      processWebhookAsync(payload, logEntry.id).catch(console.error);
    }

    // 4. Acknowledge fast
    return NextResponse.json({ success: true, message: 'Webhook recibido y encolado.' }, { status: 200 });

  } catch (error: any) {
    console.error('Webhook endpoint error:', error);
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 });
  }
}
