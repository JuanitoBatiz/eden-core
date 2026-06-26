import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { requireRole } from '@/lib/auth';
import { sanitizeError } from '@/lib/apiError';

const slugify = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.]+/g, '-');

// POST: Completar reembolso (Admin/Cashier) con subida de archivo
export async function POST(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'cashier');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ error: 'insufficient_permissions', required_role: authErr.required_role, your_role: authErr.your_role }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Configuración de BD ausente.' }, { status: 500 });
    }

    const adminSupabase = createAdminClient();

    // 1. Parse FormData
    const formData = await req.formData();
    const orderId = formData.get('orderId') as string;
    const file = formData.get('file') as File;

    if (!orderId || !file) {
      return NextResponse.json({ error: 'Faltan datos requeridos (orderId o file).' }, { status: 400 });
    }

    // 2. Validate file
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el límite de 5MB.' }, { status: 400 });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de archivo no permitido. Solo se acepta JPG, PNG o PDF.' }, { status: 400 });
    }

    // 3. Upload to Supabase Storage (using payment-proofs bucket, maybe prefixed with refund_)
    const buffer = await file.arrayBuffer();
    const filename = `refund-${Date.now()}-${slugify(file.name)}`;
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

    // 4. Actualizamos el estado de reembolso a completed y guardamos la URL
    const { error: updateErr } = await adminSupabase
      .from('orders')
      .update({ 
        refund_status: 'completed',
        refund_proof_url: uploadData.path 
      })
      .eq('id', orderId)
      .eq('refund_status', 'pending');

    if (updateErr) {
      throw new Error(`DB Error: ${updateErr.message}`);
    }

    return NextResponse.json({ success: true, refund_proof_url: uploadData.path });

  } catch (error: any) {
    return sanitizeError(
      error,
      'Upload refund proof error',
      'Ocurrió un error interno al subir el comprobante de reembolso.'
    );
  }
}
