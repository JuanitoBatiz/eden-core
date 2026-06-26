'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LogOut } from 'lucide-react';
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
          router.push('/?login=true');
        }
      })
      .catch(() => router.push('/?login=true'))
      .finally(() => setLoading(false));
  }, [router]);

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

  if (!isAuthenticated) return null;

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
