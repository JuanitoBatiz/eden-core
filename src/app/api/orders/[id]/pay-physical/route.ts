import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { ensureLoyverseReceipt } from '@/lib/loyverseReceiptSync';

// PATCH: Pagar en físico
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orderId = (await params).id;
    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden no proporcionado.' }, { status: 400 });
    }

    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(req);
    } catch (e) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Validar que la orden pertenezca al usuario y esté esperando pago
    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    if (order.user_id !== tokenPayload.user_id) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta orden.' }, { status: 403 });
    }

    if (order.status !== 'awaiting_payment') {
      return NextResponse.json({ error: 'Esta orden no está esperando decisión de pago.' }, { status: 400 });
    }

    // Actualizar estado para mandarla a cocina directamente
    // También se marca el pago como aprobado y el método como efectivo para que
    // NO aparezca en la vista de finanzas/transferencias pendientes del cajero.
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({
        status: 'in_preparation',
        payment_status: 'payment_approved',
        payment_method: 'efectivo'
      })
      .eq('id', orderId);

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    // RIFA: Registrar entrada si el total es >= $200 (1 oportunidad por ticket, sin importar el monto exacto)
    // El upsert + UNIQUE constraint en DB hacen imposible duplicar entradas para el mismo pedido
    if (order.total >= 200 && order.user_id) {
      try {
        await adminSupabase
          .from('raffle_entries')
          .upsert(
            { user_id: order.user_id, order_id: order.id, order_total: order.total },
            { onConflict: 'order_id', ignoreDuplicates: true }
          );
        console.log(`[RIFA] Entrada registrada para user=${order.user_id}, order=${order.id}, total=${order.total}`);
      } catch (raffleErr: any) {
        // No bloqueamos el flujo si falla el registro de la rifa
        console.error('[RIFA] Error al registrar entrada de rifa:', raffleErr?.message);
      }
    }

    // Recibo en Loyverse: idempotente y con reintento automático si Loyverse falla
    const receiptSync = await ensureLoyverseReceipt(adminSupabase, orderId, {
      paymentMethod: 'efectivo',
      paymentStatus: 'payment_approved', // el cliente confirmó pago físico
    });
    const loyverseDiagnostic = {
      success: receiptSync.success,
      receipt_number: receiptSync.receipt_number,
      error: receiptSync.error,
    };

    return NextResponse.json({ success: true, status: 'in_preparation', loyverse_diagnostic: loyverseDiagnostic });

  } catch (error: any) {
    console.error('Pay physical error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
