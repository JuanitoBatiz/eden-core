import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// PATCH: Aprobar pago
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const orderId = params.id;
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

    // 2. Fetch current payment status
    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('status, payment_status, customer_phone')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    if (order.payment_status !== 'payment_submitted') {
      return NextResponse.json({ error: 'Esta orden no está en un estado que pueda ser aprobado.' }, { status: 400 });
    }

    // 3. Prepare updates
    const updates: any = {
      payment_status: 'payment_approved',
    };

    // Auto-advance to kitchen if it was waiting on payment
    if (order.status === 'received') {
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

    return NextResponse.json({ success: true, ...updates });

  } catch (error: any) {
    console.error('Approve payment error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
