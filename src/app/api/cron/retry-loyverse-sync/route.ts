import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createLoyverseCustomer } from '@/lib/loyverse';

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

    // 1. Obtener los trabajos pendientes que ya pueden ser reintentados
    const { data: pendingJobs, error: fetchErr } = await adminSupabase
      .from('loyverse_sync_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .limit(10); // Límite por batch para no hacer timeout en serverless

    if (fetchErr) throw new Error(`Error fetching jobs: ${fetchErr.message}`);

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay trabajos pendientes.' });
    }

    const results = [];

    // 2. Procesar cada trabajo
    for (const job of pendingJobs) {
      try {
        // Marcar como processing
        await adminSupabase.from('loyverse_sync_queue').update({ status: 'processing' }).eq('id', job.id);

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
