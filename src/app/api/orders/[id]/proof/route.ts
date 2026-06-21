import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { verifyAccessToken, requireRole } from '@/lib/auth';
import { sanitizeError } from '@/lib/apiError';

const slugify = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]+/g, '-');

// POST: Upload payment proof
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orderId = (await params).id;
    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden no proporcionado.' }, { status: 400 });
    }

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'customer');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Configuración de BD ausente.' }, { status: 500 });
    }

    // Endpoint protegido por requireRole → usar adminClient para bypassear RLS
    const adminSupabase = createAdminClient();

    // 1. Verify order ownership and status
    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('user_id, payment_status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Orden no encontrada.' }, { status: 404 });
    }

    if (order.user_id !== tokenPayload.user_id) {
      return NextResponse.json({ error: 'Prohibido. La orden no pertenece a tu usuario.' }, { status: 403 });
    }

    if (order.payment_status !== 'pending_payment') {
      return NextResponse.json({ error: 'La orden no está en espera de pago.' }, { status: 400 });
    }

    // 2. Parse FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo.' }, { status: 400 });
    }

    // 3. Backend validations
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el límite de 5MB.' }, { status: 400 });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de archivo no permitido. Solo se acepta JPG, PNG o PDF.' }, { status: 400 });
    }

    // 5. Upload to Supabase Storage
    const buffer = await file.arrayBuffer();
    const filename = `${Date.now()}-${slugify(file.name)}`;
    const path = `${orderId}/${filename}`;

    const { data: uploadData, error: uploadErr } = await adminSupabase.storage
      .from('payment-proofs')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      throw new Error('Error al guardar el archivo en Storage.');
    }

    // 6. Update Order Status
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({
        payment_status: 'payment_submitted',
        proof_url: uploadData.path
      })
      .eq('id', orderId);

    if (updateErr) {
      console.error('DB update error:', updateErr);
      throw new Error('Error al actualizar el estado de la orden.');
    }

    return NextResponse.json({ 
      success: true, 
      payment_status: 'payment_submitted' 
    });

  } catch (error: any) {
    return sanitizeError(
      error,
      'Upload proof error',
      'Ocurrió un error interno al subir el comprobante.'
    );
  }
}

// GET: Create a temporary signed URL to view the proof (Admin/Cashier only)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const adminSupabase = createAdminClient();

    // 1. Get the proof_url path from the order
    const { data: order, error: orderErr } = await adminSupabase
      .from('orders')
      .select('proof_url')
      .eq('id', orderId)
      .single();

    if (orderErr || !order || !order.proof_url) {
      return NextResponse.json({ error: 'Comprobante no encontrado.' }, { status: 404 });
    }

    // 2. Generate signed URL (expires in 5 minutes = 300 seconds)
    const { data: signedData, error: signedErr } = await adminSupabase.storage
      .from('payment-proofs')
      .createSignedUrl(order.proof_url, 300);

    if (signedErr || !signedData) {
      throw new Error(`Error generando URL firmada: ${signedErr?.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      signedUrl: signedData.signedUrl 
    });

  } catch (error: any) {
    return sanitizeError(
      error,
      'Fetch proof URL error',
      'Ocurrió un error al obtener la URL del comprobante.'
    );
  }
}
