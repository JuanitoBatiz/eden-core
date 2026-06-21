'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EdenPassQR from '@/components/loyalty/EdenPassQR';

export default function PerfilPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<any>(null);

  useEffect(() => {
    // Verificar sesión via refresh (no localStorage)
    // credentials:'include' envía la cookie refresh_token automáticamente
    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          router.push('/?login=true');
        }
      })
      .catch(() => router.push('/?login=true'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // credentials:'include' envía la cookie access_token automáticamente
    fetch('/api/me/loyalty', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) setLoyaltyData(data);
      })
      .catch(console.error);
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-cream-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="status-animation-ring active" style={{ width: '48px', height: '48px' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-cream-light)', paddingBottom: '96px' }}>
      <header style={{ backgroundColor: 'white', position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid var(--color-cream-dark)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/')} style={{ padding: '8px', marginLeft: '-8px', color: 'var(--color-text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '24px', height: '24px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-text-dark)', letterSpacing: '-0.025em', margin: 0 }}>Mi Perfil</h1>
        <button
          onClick={handleLogout}
          style={{ fontSize: '0.875rem', color: 'var(--color-terracotta)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Salir
        </button>
      </header>

      <main style={{ maxWidth: '28rem', margin: '0 auto', padding: '32px 16px 0 16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* EdenPass QR */}
        <EdenPassQR />

        {/* Loyalty Summary */}
        {loyaltyData && (
          <div style={{ backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', border: '1px solid var(--color-cream-dark)', padding: '24px' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--color-text-dark)', marginBottom: '16px', marginTop: 0 }}>Mis Puntos</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--color-green-dark)', margin: 0 }}>{loyaltyData.loyalty_points}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: 0 }}>puntos acumulados</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 600, color: 'var(--color-text-dark)', margin: 0 }}>{loyaltyData.loyalty_tier}</p>
                {loyaltyData.next_tier && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: 0 }}>
                    {loyaltyData.points_needed_for_next_tier} pts para {loyaltyData.next_tier}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {loyaltyData?.history?.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', border: '1px solid var(--color-cream-dark)', padding: '24px' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--color-text-dark)', marginBottom: '16px', marginTop: 0 }}>Historial de Canjes</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, margin: 0, listStyle: 'none' }}>
              {loyaltyData.history.map((item: any) => (
                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--color-text-dark)' }}>{item.benefit_description}</span>
                  <span style={{ color: 'var(--color-green-dark)', fontWeight: 600 }}>-{item.points_used} pts</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
