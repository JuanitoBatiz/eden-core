'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LogOut, Award, Sparkles } from 'lucide-react';
import EdenPassQR from '@/components/loyalty/EdenPassQR';

export default function PerfilPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let localPts = 0;
    try {
      const mockOrders = JSON.parse(localStorage.getItem('eden_mock_orders') || '[]');
      localPts = mockOrders.reduce((acc: number, curr: any) => acc + Math.floor((curr.total || 0) * 0.1), 0);
    } catch(e) {}

    fetch('/api/me/loyalty', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if ((!data.loyalty_points || data.loyalty_points === 0) && localPts > 0) {
            data.loyalty_points = localPts;
            if (localPts >= 1800) data.loyalty_tier = 'Diamante';
            else if (localPts >= 600) data.loyalty_tier = 'Oro';
            else if (localPts >= 150) data.loyalty_tier = 'Plata';
          }
          setLoyaltyData(data);
        } else if (localPts > 0) {
          setLoyaltyData({ loyalty_points: localPts, loyalty_tier: localPts >= 150 ? 'Plata' : 'Estándar', history: [] });
        }
      })
      .catch(() => {
        if (localPts > 0) {
          setLoyaltyData({ loyalty_points: localPts, loyalty_tier: localPts >= 150 ? 'Plata' : 'Estándar', history: [] });
        }
      });
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="profile-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin-icon" style={{ width: '48px', height: '48px', border: '4px solid var(--color-green-light)', borderTopColor: 'var(--color-green-dark)', borderRadius: '50%' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="profile-page-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 20px', background: 'var(--color-cream-light)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.push('/')} className="profile-back-btn" style={{ position: 'static', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', background: 'rgba(34, 60, 43, 0.08)', borderRadius: '12px', padding: '8px 14px', border: 'none', cursor: 'pointer', color: 'var(--color-green-dark)', fontWeight: 700 }}>
            <ChevronLeft size={20} /> <span style={{ fontSize: '0.95rem' }}>Menú</span>
          </button>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--color-green-dark)', fontWeight: 700, letterSpacing: '1px' }}>EDÉN</div>
          <div style={{ width: '70px' }}></div>
        </header>

        <div style={{ maxWidth: '420px', margin: 'auto', textAlign: 'center', padding: '44px 28px', backgroundColor: '#ffffff', borderRadius: '32px', boxShadow: '0 24px 50px rgba(34, 60, 43, 0.08)', border: '2px solid rgba(212, 163, 115, 0.25)' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '24px', background: 'linear-gradient(135deg, var(--color-green-dark) 0%, #15261b 100%)', color: 'var(--color-ochre)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', boxShadow: '0 12px 28px rgba(34, 60, 43, 0.22)' }}>
            <Award size={40} />
          </div>

          <span style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '2.5px', color: 'var(--color-terracotta)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>MEMBRESÍA EXCLUSIVA</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-green-dark)', margin: '0 0 16px 0', lineHeight: 1.25, fontWeight: 700 }}>Únete a la Familia Edén</h1>
          
          <p style={{ fontSize: '0.96rem', color: 'var(--color-text-main)', opacity: 0.85, lineHeight: 1.6, margin: '0 auto 32px auto' }}>
            Haz tu primer pedido en nuestro menú digital para activar tu membresía exclusiva <strong>EdenPass</strong>, acumular recompensas reales en cada visita y agilizar tus entregas en sucursal.
          </p>

          <button 
            onClick={() => router.push('/')} 
            style={{ width: '100%', padding: '18px 24px', borderRadius: '18px', background: 'linear-gradient(135deg, var(--color-green-dark) 0%, #172b1e 100%)', color: '#f4ebd9', border: 'none', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 24px rgba(34, 60, 43, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s ease' }}
          >
            <Sparkles size={18} color="var(--color-ochre)" /> Hacer mi Primer Pedido
          </button>
        </div>

        <footer style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', paddingBottom: '10px' }}>
          Restaurante Edén • Otumba, Estado de México
        </footer>
      </div>
    );
  }

  return (
    <div className="profile-page-wrapper">
      <header className="profile-header-bar">
        <button onClick={() => router.push('/')} className="profile-back-btn" title="Volver al Menú">
          <ChevronLeft size={28} />
        </button>
        <h1 className="profile-header-title">Mi Perfil</h1>
        <button onClick={handleLogout} className="profile-action-btn" title="Cerrar Sesión">
          Salir
        </button>
      </header>

      <main className="profile-main-content">
        {/* EdenPass QR Component */}
        <EdenPassQR />

        {/* Loyalty Points Display */}
        {loyaltyData && (
          <div className="profile-card">
            <h2 className="profile-card-title">Mis Puntos</h2>
            <div className="profile-points-layout">
              <div>
                <p className="profile-points-hero">{loyaltyData.loyalty_points}</p>
                <p className="profile-points-label">puntos acumulados</p>
              </div>
              <div className="profile-tier-layout">
                <p className="profile-tier-name">{loyaltyData.loyalty_tier}</p>
                {loyaltyData.next_tier && (
                  <div className="profile-tier-progress">
                    Faltan {loyaltyData.points_needed_for_next_tier} pts para {loyaltyData.next_tier}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Redemption History */}
        {loyaltyData?.history?.length > 0 && (
          <div className="profile-card">
            <h2 className="profile-card-title">Historial de Canjes</h2>
            <ul className="profile-history-list">
              {loyaltyData.history.map((item: any) => (
                <li key={item.id} className="profile-history-item">
                  <span className="profile-history-desc">{item.benefit_description}</span>
                  <span className="profile-history-pts">-{item.points_used} pts</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
