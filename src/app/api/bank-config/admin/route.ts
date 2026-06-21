import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// GET: Protected endpoint to list all bank configs (Owner only)
export async function GET(req: Request) {
  try {
    // 1. Verificar sesión y rol (RBAC)
    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, 'owner');
    } catch (authErr: any) {
      if (authErr.message.includes('403')) {
        return NextResponse.json({ 
          error: 'insufficient_permissions', 
          required_role: authErr.required_role, 
          your_role: authErr.your_role 
        }, { status: 403 });
      }
      return NextResponse.json({ error: authErr.message || 'No autorizado' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.' },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminSupabase
      .from('bank_config')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`DB Error: ${error.message}`);
    }

    return NextResponse.json({ success: true, history: data });

  } catch (error: any) {
    console.error('Fetch bank config history error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
