import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// DELETE: Limpiar comprobantes más antiguos de 7 días
export async function DELETE(req: Request) {
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Calcular la fecha de hace 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isoDate = sevenDaysAgo.toISOString();

    // Buscar las órdenes viejas con comprobante
    const { data: oldOrders, error: fetchError } = await adminSupabase
      .from('orders')
      .select('id, proof_url')
      .not('proof_url', 'is', null)
      .lt('created_at', isoDate);

    if (fetchError) throw new Error(fetchError.message);

    if (!oldOrders || oldOrders.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay comprobantes antiguos para limpiar.', deleted_count: 0 });
    }

    // Extraer las rutas (paths) de los archivos a borrar. 
    // proof_url suele guardar la ruta dentro del bucket, ej: 'payment_proofs/id-123.jpg'
    // Como depende de cómo se subió, vamos a asumir que proof_url es directamente la ruta (path) que acepta remove().
    const filesToRemove = oldOrders.map(o => o.proof_url).filter(Boolean) as string[];

    let storageDeleted = 0;
    if (filesToRemove.length > 0) {
      const { data: removeData, error: removeError } = await adminSupabase
        .storage
        .from('payment_proofs')
        .remove(filesToRemove);
        
      if (removeError) {
        console.error('Error eliminando archivos de storage:', removeError);
        // Continuamos de todas formas para limpiar la BD, o podríamos lanzar error.
      } else {
        storageDeleted = removeData?.length || 0;
      }
    }

    // Extraer los IDs de las órdenes para actualizar
    const orderIds = oldOrders.map(o => o.id);

    // Actualizar la base de datos limpiando la URL
    const { error: updateError } = await adminSupabase
      .from('orders')
      .update({ proof_url: null })
      .in('id', orderIds);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ 
      success: true, 
      message: 'Limpieza completada con éxito', 
      deleted_files: storageDeleted,
      updated_orders: orderIds.length
    });

  } catch (error: any) {
    console.error('Cleanup old proofs error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
