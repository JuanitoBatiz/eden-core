import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createLoyverseCustomer, findLoyverseCustomerByPhone, findLoyverseReceiptByOrderId } from '@/lib/loyverse';
import { ensureLoyverseReceipt } from '@/lib/loyverseReceiptSync';

// Un trabajo en 'processing' por más de este tiempo se considera atascado (la ejecución murió) y se reintenta
const STALE_PROCESSING_MS = 10 * 60 * 1000;

// GET: Worker para reintentar sincronizaciones pendientes con Loyverse
export async function GET(req: Request) {
  try {
    const cronSecretHeader = req.headers.get('Authorization');
    const expectedSecret = process.env.CRON_SECRET;

    // Proteger endpoint — solo aceptar el secreto vía cabecera Authorization
    // para evitar que sea registrado en logs de servidores, proxies y navegadores.
    const isAuthorized = expectedSecret && cronSecretHeader === `Bearer ${expectedSecret}`;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración de DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // ?dry_run=1 → solo informa qué haría (enlazar / crear) sin escribir nada ni crear clientes
    const dryRun = new URL(req.url).searchParams.get('dry_run') === '1';
    const nowIso = new Date().toISOString();
    const staleIso = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();

    // 1. Trabajos pendientes listos para reintentar + trabajos atascados en 'processing'
    const { data: pendingJobs, error: fetchErr } = await adminSupabase
      .from('loyverse_sync_queue')
      .select('*')
      .or(`and(status.eq.pending,next_retry_at.lte.${nowIso}),and(status.eq.processing,updated_at.lt.${staleIso})`)
      .limit(10); // Límite por batch para no hacer timeout en serverless

    if (fetchErr) throw new Error(`Error fetching jobs: ${fetchErr.message}`);

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay trabajos pendientes.' });
    }

    const results = [];

    if (dryRun) {
      for (const job of pendingJobs) {
        try {
          if (job.entity_type === 'receipt_create') {
            const { data: o } = await adminSupabase.from('orders').select('created_at, loyverse_receipt_id, status').eq('id', job.entity_id).maybeSingle();
            const found = o && !o.loyverse_receipt_id && o.status !== 'cancelled' ? await findLoyverseReceiptByOrderId(job.entity_id, o.created_at) : null;
            const would = !o ? 'order_missing' : o.loyverse_receipt_id ? 'already_synced' : o.status === 'cancelled' ? 'skip_cancelled' : found ? 'link_existing_receipt' : 'create_receipt';
            results.push({ id: job.id, entity_type: job.entity_type, would });
            continue;
          }
          const existing = job.entity_type === 'customer_create' ? await findLoyverseCustomerByPhone(job.payload?.phone) : null;
          results.push({ id: job.id, entity_type: job.entity_type, would: existing ? 'link_existing' : 'create' });
        } catch (e: any) {
          results.push({ id: job.id, entity_type: job.entity_type, would: 'error', error: e.message });
        }
      }
      return NextResponse.json({ success: true, dry_run: true, jobs: results.length, results });
    }

    // 2. Procesar cada trabajo
    for (const job of pendingJobs) {
      try {
        // Marcar como processing (updated_at explícito: sirve para detectar trabajos atascados)
        await adminSupabase.from('loyverse_sync_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        if (job.entity_type === 'customer_create') {
          const { name, phone } = job.payload;
          
          // Intentar crear cliente
          const loyverseId = await createLoyverseCustomer(name, phone);

          // Éxito: Actualizar usuario y cerrar trabajo
          await adminSupabase.from('users').update({ loyverse_customer_id: loyverseId }).eq('id', job.entity_id);
          await adminSupabase.from('loyverse_sync_queue').update({ 
            status: 'completed',
            last_error: null 
          }).eq('id', job.id);
          
          results.push({ id: job.id, status: 'completed' });
        } else if (job.entity_type === 'receipt_create') {
          const sync = await ensureLoyverseReceipt(adminSupabase, job.entity_id, {
            paymentMethod: job.payload?.payment_method ?? 'efectivo',
            lookupFirst: true,          // antes de crear, comprobar que no exista ya en Loyverse
            enqueueOnFailure: false,    // el reintento lo gestiona este mismo trabajo
          });
          if (!sync.success) throw new Error(sync.error || 'No se pudo crear el recibo');

          await adminSupabase.from('loyverse_sync_queue').update({
            status: 'completed',
            last_error: null
          }).eq('id', job.id);
          results.push({ id: job.id, status: 'completed', receipt_number: sync.receipt_number, skipped: sync.skipped ?? null });
        }
      } catch (error: any) {
        // Fallo: Calcular backoff y actualizar
        const newAttempts = job.attempts + 1;
        
        if (newAttempts >= job.max_attempts) {
          await adminSupabase.from('loyverse_sync_queue').update({ 
            status: 'failed_permanent',
            attempts: newAttempts,
            last_error: error.message || 'Error desconocido'
          }).eq('id', job.id);
          results.push({ id: job.id, status: 'failed_permanent' });
        } else {
          // Backoff exponencial: 2^attempts minutos (2, 4, 8, 16...)
          const delayMinutes = Math.pow(2, newAttempts);
          const nextRetry = new Date(Date.now() + delayMinutes * 60000);
          
          await adminSupabase.from('loyverse_sync_queue').update({ 
            status: 'pending',
            attempts: newAttempts,
            next_retry_at: nextRetry.toISOString(),
            last_error: error.message || 'Error desconocido'
          }).eq('id', job.id);
          results.push({ id: job.id, status: 'pending_retry', delayMinutes });
        }
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });

  } catch (error: any) {
    console.error('Loyverse sync cron error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
