import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { deriveCapabilities, MinimumRole } from '@/lib/permissions';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    let tokenPayload;
    try {
      tokenPayload = await verifyAccessToken(req);
    } catch (authErr: any) {
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: user, error } = await supabase
      .from('users')
      .select('role, active')
      .eq('id', tokenPayload.user_id)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Cuenta inactiva' }, { status: 401 });
    }

    const role = user.role as MinimumRole;
    const capabilities = deriveCapabilities(role);

    return NextResponse.json({
      success: true,
      role,
      capabilities
    });

  } catch (error: any) {
    console.error('Fetch permissions error:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
