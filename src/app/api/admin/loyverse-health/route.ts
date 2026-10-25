import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

// GET: estado de la sincronización con Loyverse para el panel (cajero/owner).
// Solo lectura. Sirve para avisar cuando hay ventas sin recibo en el POS o reintentos atascados.
export async function GET(req: Request) {
  try {
    try {
      await requireRole(req, 'cashier');
    } catch (authErr) {
      const e = authErr as Error;
      return NextResponse.json({ error: e.message || 'No autorizado' }, { status: e.message?.includes('403') ? 403 : 401 });
    }

    const admin = createAdminClient();
    const staleIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
      const { count: c, error } = await q;
      if (error) throw new Error(error.message);
      return c ?? 0;
    };

    const [receiptsFailed, receiptsStuck, customersFailed, ordersWithoutReceipt] = await Promise.all([
      // Recibos que se rindieron tras todos los reintentos
      count(admin.from('loyverse_sync_queue').select('id', { count: 'exact', head: true })
        .eq('entity_type', 'receipt_create').eq('status', 'failed_permanent')),
      // Recibos pendientes hace más de 30 min (el cron debería haberlos resuelto)
      count(admin.from('loyverse_sync_queue').select('id', { count: 'exact', head: true })
        .eq('entity_type', 'receipt_create').in('status', ['pending', 'processing']).lt('created_at', staleIso)),
      count(admin.from('loyverse_sync_queue').select('id', { count: 'exact', head: true })
        .eq('entity_type', 'customer_create').eq('status', 'failed_permanent')),
      // Pedidos con pago aprobado que ya pasaron a cocina pero siguen sin recibo (últimos 7 días)
      count(admin.from('orders').select('id', { count: 'exact', head: true })
        .in('status', ['in_preparation', 'ready', 'in_transit', 'delivered'])
        .eq('payment_status', 'payment_approved').is('loyverse_receipt_id', null).gte('created_at', sinceIso)),
    ]);

    const attention = receiptsFailed + receiptsStuck + ordersWithoutReceipt > 0;
    return NextResponse.json({
      success: true,
      attention,
      receipts_failed: receiptsFailed,
      receipts_stuck: receiptsStuck,
      customers_failed: customersFailed,
      orders_without_receipt: ordersWithoutReceipt,
    });
  } catch (error) {
    console.error('[LOYVERSE-HEALTH] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
