import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { createLoyverseReceipt } from '@/lib/loyverse';

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
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({
        status: 'in_preparation',
      })
      .eq('id', orderId);

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    let loyverseDiagnostic = { success: false, receipt_number: null as string | null, error: null as string | null };

    // Enviar orden a Loyverse POS inmediatamente para pagos en físico / efectivo / caja si no ha sido enviada previamente
    if (!order.loyverse_receipt_id) {
      try {
        const { data: dbUser } = await adminSupabase
          .from('users')
          .select('loyverse_customer_id')
          .eq('id', order.user_id)
          .single();

        const loyverseResult = await createLoyverseReceipt({
          id: order.id,
          customer_id: dbUser?.loyverse_customer_id || undefined,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          items: order.items,
          total: order.total,
          notes: order.notes || '',
          service_type: order.service_type,
          delivery_address: order.delivery_address,
          payment_method: order.payment_method || 'efectivo',
          payment_status: 'pending_payment'
        });

        if (loyverseResult?.receipt_id) {
          await adminSupabase
            .from('orders')
            .update({
              loyverse_receipt_id: loyverseResult.receipt_id,
              loyverse_receipt_number: loyverseResult.receipt_number
            })
            .eq('id', orderId);
          
          loyverseDiagnostic = { success: true, receipt_number: loyverseResult.receipt_number, error: null };
        }
      } catch (err: any) {
        console.error('❌ [LOYVERSE DIAGNOSTIC in pay-physical]: Error synchronizing with Loyverse POS:', err);
        loyverseDiagnostic = { success: false, receipt_number: null, error: err?.message || String(err) };
      }
    } else {
      loyverseDiagnostic = { success: true, receipt_number: order.loyverse_receipt_number, error: 'Orden ya sincronizada previamente con Loyverse' };
    }

    return NextResponse.json({ success: true, status: 'in_preparation', loyverse_diagnostic: loyverseDiagnostic });

  } catch (error: any) {
    console.error('Pay physical error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
