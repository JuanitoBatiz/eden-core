import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createLoyverseReceipt } from '@/lib/loyverse';

// Nombres de cuentas de prueba del dueño — excluidos de la inyección
// Se usa startsWith para 'juan' (captura "Juan", "Juan Jesus", "Juan J", "Juan Curiel", etc.)
// y coincidencia exacta para los demás para no excluir clientes como "Jesús Espinoza"
const TEST_NAME_PATTERNS = [
  { type: 'startswith', value: 'juan' },
  { type: 'exact', value: 'dueño maestro' },
  { type: 'exact', value: 'jesús' },
  { type: 'exact', value: 'jesus' },
  { type: 'exact', value: 'dueño' },
];

function isTestOrder(customerName: string): boolean {
  const name = customerName.toLowerCase().trim();
  return TEST_NAME_PATTERNS.some(p =>
    p.type === 'startswith' ? name.startsWith(p.value) : name === p.value
  );
}

/**
 * POST /api/admin/sync-loyverse
 *
 * Inyección retroactiva a Loyverse de pedidos entregados que nunca se registraron.
 *
 * Criterio de selección:
 *   - status = 'delivered'           → pedidos realmente entregados
 *   - loyverse_receipt_id IS NULL    → nunca llegaron a Loyverse
 *   - Excluye nombres de prueba del dueño
 *
 * Método de pago: 'efectivo' (ninguno tiene comprobante subido, fueron cobrados físicamente)
 *
 * Requiere rol: owner
 */
export async function POST(req: Request) {
  try {
    // 1. Solo owner puede ejecutar esto
    try {
      await requireRole(req, 'owner');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'Se requiere rol owner para esta operación.' }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // 2. Obtener pedidos entregados sin recibo en Loyverse
    const { data: candidates, error: fetchErr } = await adminSupabase
      .from('orders')
      .select('*')
      .is('loyverse_receipt_id', null)
      .eq('status', 'delivered')
      .order('created_at', { ascending: true });

    if (fetchErr) {
      throw new Error(`Error al consultar pedidos: ${fetchErr.message}`);
    }

    // 3. Filtrar pedidos de prueba del lado del servidor
    const affectedOrders = (candidates || []).filter(o => !isTestOrder(o.customer_name));

    if (affectedOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay pedidos pendientes de sincronización. ¡Todo está al día!',
        synced: 0,
        failed: 0,
        total_synced_amount: 0,
        results: []
      });
    }

    // 4. Procesar cada pedido
    const results: Array<{
      order_id: string;
      customer_name: string;
      total: number;
      created_at: string;
      success: boolean;
      receipt_number?: string;
      error?: string;
    }> = [];

    let totalSyncedAmount = 0;
    let syncedCount = 0;
    let failedCount = 0;

    for (const order of affectedOrders) {
      try {
        console.log(`[SYNC-LOYVERSE] Procesando orden ${order.id} (${order.customer_name} - $${order.total})...`);

        // Buscar loyverse_customer_id del usuario si existe
        let loyverseCustomerId: string | undefined;
        if (order.user_id) {
          const { data: dbUser } = await adminSupabase
            .from('users')
            .select('loyverse_customer_id')
            .eq('id', order.user_id)
            .single();
          loyverseCustomerId = dbUser?.loyverse_customer_id || undefined;
        }

        const loyverseResult = await createLoyverseReceipt({
          id: order.id,
          customer_id: loyverseCustomerId,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          items: order.items,
          total: order.total,
          notes: order.notes || '',
          service_type: order.service_type,
          delivery_address: order.delivery_address,
          // Todos sin comprobante → efectivo (cobrados físicamente en entrega/pickup)
          payment_method: 'efectivo',
          payment_status: 'payment_approved',
          delivery_fee: order.delivery_fee,
          delivery_lat: order.delivery_lat,
          delivery_lng: order.delivery_lng,
          delivery_fee_confirmed: order.delivery_fee_confirmed,
        });

        if (loyverseResult?.receipt_id) {
          await adminSupabase
            .from('orders')
            .update({
              loyverse_receipt_id: loyverseResult.receipt_id,
              loyverse_receipt_number: loyverseResult.receipt_number,
              payment_method: 'efectivo',
              payment_status: 'payment_approved'
            })
            .eq('id', order.id);

          totalSyncedAmount += Number(order.total);
          syncedCount++;

          results.push({
            order_id: order.id,
            customer_name: order.customer_name,
            total: order.total,
            created_at: order.created_at,
            success: true,
            receipt_number: loyverseResult.receipt_number
          });

          console.log(`[SYNC-LOYVERSE] ✅ ${order.customer_name} $${order.total} → Recibo: ${loyverseResult.receipt_number}`);
        } else {
          throw new Error('Loyverse no devolvió un receipt_id válido');
        }

      } catch (err: any) {
        failedCount++;
        const errMsg = err?.message || String(err);
        console.error(`[SYNC-LOYVERSE] ❌ Fallo en orden ${order.id} (${order.customer_name}): ${errMsg}`);

        results.push({
          order_id: order.id,
          customer_name: order.customer_name,
          total: order.total,
          created_at: order.created_at,
          success: false,
          error: errMsg
        });
      }

      // 300ms de pausa para no saturar la API de Loyverse
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return NextResponse.json({
      success: true,
      message: `Sincronización completada. ${syncedCount} pedidos sincronizados, ${failedCount} fallidos.`,
      total_affected: affectedOrders.length,
      synced: syncedCount,
      failed: failedCount,
      total_synced_amount: totalSyncedAmount,
      results
    });

  } catch (error: any) {
    console.error('[SYNC-LOYVERSE] Error crítico:', error);
    return NextResponse.json(
      { error: 'Error interno al sincronizar con Loyverse.', detail: error?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-loyverse
 * Preview: muestra exactamente qué se va a inyectar sin ejecutar nada
 */
export async function GET(req: Request) {
  try {
    try {
      await requireRole(req, 'owner');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'Se requiere rol owner.' }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    const { data: candidates, error } = await adminSupabase
      .from('orders')
      .select('id, customer_name, customer_phone, total, payment_status, status, service_type, created_at')
      .is('loyverse_receipt_id', null)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const pendingOrders = (candidates || []).filter(o => !isTestOrder(o.customer_name));
    const totalAmount = pendingOrders.reduce((sum, o) => sum + Number(o.total), 0);

    return NextResponse.json({
      success: true,
      pending_count: pendingOrders.length,
      total_amount_not_in_loyverse: totalAmount,
      orders: pendingOrders
    });

  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
