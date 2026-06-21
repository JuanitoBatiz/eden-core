import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// No requiere auth en este nivel porque los beneficios son un catálogo público
export const revalidate = 60; // Cache 1 min

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; // Usamos anon key porque le dimos política de lectura pública

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuración DB ausente' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: benefits, error } = await supabase
      .from('loyalty_benefits')
      .select('*')
      .eq('active', true)
      .order('points_required', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      benefits: benefits || []
    });

  } catch (error: any) {
    console.error('Error fetching benefits:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
