import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyRefreshToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { ROLE_HIERARCHY } from '@/lib/permissions';

export default async function RepartidorLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token');

  if (!refreshToken?.value) {
    redirect('/?login=true');
  }

  try {
    const payload = verifyRefreshToken(refreshToken.value);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (supabaseUrl && serviceRoleKey) {
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: user } = await adminSupabase
        .from('users')
        .select('role, active')
        .eq('id', payload.user_id)
        .single();

      if (!user || user.active === false) {
        redirect('/?unauthorized=true');
      }

      // El repartidor necesita al menos rol cashier
      const cashierIndex = ROLE_HIERARCHY.indexOf('cashier');
      const userIndex = ROLE_HIERARCHY.indexOf(user.role as any);

      if (userIndex < cashierIndex) {
        redirect('/?unauthorized=true');
      }
    }

    return <>{children}</>;
  } catch {
    redirect('/?login=true');
  }
}
