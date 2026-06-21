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
    if (secret && signature) {
      const hmac = crypto.createHmac('sha1', secret);
      hmac.update(rawBody);
      const computedSignature = hmac.digest('base64');
      
      if (computedSignature !== signature) {
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
      }
    } else if (secret && !signature) {
      // If we expect a secret but loyverse didn't send signature (e.g. not OAuth)
      console.warn('Webhook recibido sin firma X-Loyverse-Signature. Configuración manual detectada.');
      // Opcional: Podrías rechazarlo aquí con 401 si exiges estricta seguridad
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
