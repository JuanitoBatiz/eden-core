import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyRefreshToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { ROLE_HIERARCHY, MinimumRole, ROUTE_PERMISSIONS } from '@/lib/permissions';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token');

  if (!refreshToken?.value) {
    redirect('/?login=true');
  }

  try {
    const payload = verifyRefreshToken(refreshToken.value);
    
    // Validar rol en DB
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

      const requiredRole = ROUTE_PERMISSIONS['GET /api/orders']; // Representa el acceso admin
      const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
      const userIndex = ROLE_HIERARCHY.indexOf(user.role as MinimumRole);

      if (userIndex < requiredIndex) {
        redirect('/?unauthorized=true');
      }
    }
    
    return <>{children}</>;
  } catch (error) {
    redirect('/?login=true');
  }
}
