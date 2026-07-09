import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { createLoyverseReceipt } from '@/lib/loyverse';

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

    let loyverseDiagnostic = { success: false, receipt_number: null as string | null, error: null as string | null };

    // 5. Send to Loyverse POS si no ha sido enviada previamente
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
          payment_method: order.payment_method || 'transferencia',
          payment_status: 'payment_approved'
        });

        if (loyverseResult?.receipt_id) {
          updates.loyverse_receipt_id = loyverseResult.receipt_id;
          updates.loyverse_receipt_number = loyverseResult.receipt_number;

          // Also update db with receipt info
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
        console.error('❌ [LOYVERSE DIAGNOSTIC in approve-payment]: Error synchronizing with Loyverse POS:', err);
        loyverseDiagnostic = { success: false, receipt_number: null, error: err?.message || String(err) };
        // We don't fail the approval if Loyverse fails, we just log it.
      }
    } else {
      loyverseDiagnostic = { success: true, receipt_number: order.loyverse_receipt_number, error: 'Orden ya sincronizada previamente con Loyverse' };
    }

    return NextResponse.json({ success: true, ...updates, loyverse_diagnostic: loyverseDiagnostic });

  } catch (error: any) {
    console.error('Approve payment error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
