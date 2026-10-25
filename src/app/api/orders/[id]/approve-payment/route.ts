import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { ensureLoyverseReceipt } from '@/lib/loyverseReceiptSync';

// PATCH: Aprobar pago
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orderId = (await params).id;
    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden no proporcionado.' }, { status: 400 });
    }

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 2. Fetch current payment status and full order details
    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    if (order.payment_status === 'payment_approved') {
      return NextResponse.json({ success: true, message: 'La orden ya estaba aprobada.' });
    }

    if (order.payment_status !== 'payment_submitted' && order.payment_status !== 'pending_payment') {
      return NextResponse.json({ error: 'Esta orden no tiene un comprobante por revisar.' }, { status: 400 });
    }

    // 3. Prepare updates
    const updates: any = {
      payment_status: 'payment_approved',
    };

    // Auto-advance to kitchen if it was waiting on payment
    if (order.status === 'awaiting_payment') {
      updates.status = 'in_preparation';
    }

    // 4. Execute Update
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    /* 
    // TODO: Send SMS via Twilio using the order.customer_phone
    // Example:
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const client = require('twilio')(accountSid, authToken);
      await client.messages.create({
        body: 'Tu pago ha sido aprobado. Hemos comenzado a preparar tu orden de Edén.',
        from: process.env.TWILIO_PHONE_NUMBER,
        to: order.customer_phone.startsWith('52') ? `+${order.customer_phone}` : `+52${order.customer_phone}`
      });
    } catch(err) {
      console.error('Failed to send approval SMS', err);
    }
    */

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
        // No bloqueamos el flujo de aprobación si falla el registro de la rifa
        console.error('[RIFA] Error al registrar entrada de rifa:', raffleErr?.message);
      }
    }

    // 5. Recibo en Loyverse: idempotente y con reintento automático si Loyverse falla.
    //    (La aprobación del pago NO falla si Loyverse falla: el recibo queda en la cola de reintentos.)
    const receiptSync = await ensureLoyverseReceipt(adminSupabase, orderId, {
      paymentMethod: order.payment_method || 'transferencia',
      paymentStatus: 'payment_approved',
    });
    const loyverseDiagnostic = {
      success: receiptSync.success,
      receipt_number: receiptSync.receipt_number,
      error: receiptSync.error,
    };

    return NextResponse.json({ success: true, ...updates, loyverse_diagnostic: loyverseDiagnostic });

  } catch (error: any) {
    console.error('Approve payment error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
