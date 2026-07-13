'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LogOut, Award, Sparkles, Crown, ShieldCheck, Gift, Lock, CheckCircle } from 'lucide-react';
import EdenPassQR from '@/components/loyalty/EdenPassQR';

export default function PerfilPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<any>(null);
  const [benefits, setBenefits] = useState<any[]>([]);

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
      localPts = mockOrders.reduce((acc: number, curr: any) => acc + Math.floor((curr.total || 0) * 0.03), 0);
    } catch(e) {}

    fetch('/api/me/loyalty', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if ((!data.loyalty_points || data.loyalty_points === 0) && localPts > 0) {
            data.loyalty_points = localPts;
            if (localPts >= 140) data.loyalty_tier = 'Diamante';
            else if (localPts >= 90) data.loyalty_tier = 'Oro';
            else if (localPts >= 40) data.loyalty_tier = 'Plata';
          }
          setLoyaltyData(data);
        } else if (localPts > 0) {
          setLoyaltyData({ loyalty_points: localPts, loyalty_tier: localPts >= 140 ? 'Diamante' : localPts >= 90 ? 'Oro' : localPts >= 40 ? 'Plata' : 'Estándar', history: [] });
        }
      })
      .catch(() => {
        if (localPts > 0) {
          setLoyaltyData({ loyalty_points: localPts, loyalty_tier: localPts >= 140 ? 'Diamante' : localPts >= 90 ? 'Oro' : localPts >= 40 ? 'Plata' : 'Estándar', history: [] });
        }
      });

    fetch('/api/benefits')
      .then(res => res.json())
      .then(data => {
        if (data && data.benefits) {
          setBenefits(data.benefits);
        }
      })
      .catch(() => {});
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

        <div className="edenpass-vip-card-wrapper" style={{ margin: 'auto' }}>
          <div className="edenpass-vip-card" style={{ padding: '32px 28px' }}>
            <div className="edenpass-vip-sheen"></div>

            <div className="edenpass-vip-header">
              <div className="edenpass-vip-logo-group">
                <div className="edenpass-vip-crown-icon">
                  <Crown size={22} color="#d4a35f" />
                </div>
                <div>
                  <div className="edenpass-vip-brand">RESTAURANTE EDÉN</div>
                  <div className="edenpass-vip-subbrand">MEMBRESÍA EXCLUSIVA • EDENPASS</div>
                </div>
              </div>
              <div className="edenpass-vip-status-chip">
                <ShieldCheck size={14} color="#d4a35f" />
                <span>CLUB VIP</span>
              </div>
            </div>

            <div className="edenpass-vip-chip-row">
              <div className="edenpass-smart-chip">
                <div className="chip-line horizontal"></div>
                <div className="chip-line vertical"></div>
                <div className="chip-inner"></div>
              </div>
              <div className="edenpass-vip-motto">
                <div className="motto-title">BARRA BOTÁNICA & JUGOS NATURALES</div>
                <div className="motto-subtitle">Identidad de Fidelidad & Puntos en Cada Visita</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '14px 0', zIndex: 2 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.85rem', color: '#ffffff', margin: '0 0 12px 0', lineHeight: 1.25, fontWeight: 700 }}>Únete a la Familia Edén</h1>
              <p style={{ fontSize: '0.92rem', color: 'rgba(255, 255, 255, 0.82)', lineHeight: 1.55, margin: '0 auto 24px auto' }}>
                Haz tu primer pedido o inicia sesión para activar de inmediato tu credencial de socio exclusivo <strong>EdenPass</strong>, acumular puntos y canjear recompensas en mostrador.
              </p>

              <button 
                onClick={() => router.push('/')} 
                style={{ width: '100%', padding: '16px 24px', borderRadius: '20px', background: 'linear-gradient(135deg, #d4a35f 0%, #b8863b 100%)', color: '#112217', border: 'none', fontSize: '1.05rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 25px rgba(212, 163, 95, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s ease' }}
              >
                <Sparkles size={18} color="#112217" /> Activar Mi EdenPass
              </button>
            </div>
          </div>
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

        {/* Gamified Rewards Roadmap Panel - Ultra Luxury High Contrast Module */}
        {benefits && benefits.length > 0 && (
          <div className="profile-rewards-catalog-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={22} color="#d4a35f" />
                <h2 className="profile-rewards-catalog-title">Catálogo de Premios VIP</h2>
              </div>
              <span className="profile-rewards-points-pill">
                {loyaltyData?.loyalty_points || 0} pts
              </span>
            </div>
            <p className="profile-rewards-catalog-subtitle">
              Desbloquea recompensas automáticas al acumular puntos. Muestra tu código QR en mostrador para canjear cualquiera de tus premios desbloqueados al instante.
            </p>

            <div className="profile-rewards-grid-luxury">
              {benefits.map((b: any, idx: number) => {
                const currentPts = loyaltyData?.loyalty_points || 0;
                const cost = b.points_cost || b.points_required || 0;
                const isUnlocked = currentPts >= cost;
                const missingPts = Math.max(0, cost - currentPts);
                const progressPercent = Math.min(100, Math.floor((currentPts / cost) * 100));

                return (
                  <div 
                    key={b.id || idx}
                    className={`profile-reward-luxury-item ${isUnlocked ? 'unlocked' : 'locked'}`}
                  >
                    {/* Shimmer Sheen on Unlocked */}
                    {isUnlocked && <div className="edenpass-vip-sheen"></div>}

                    <div className="reward-luxury-header">
                      <div className="reward-luxury-title-group">
                        <div className="reward-luxury-icon-box">
                          {isUnlocked ? <Gift size={18} /> : <Lock size={18} />}
                        </div>
                        <div>
                          <h3 className="reward-luxury-name">
                            {b.name}
                          </h3>
                        </div>
                      </div>

                      <div className="reward-luxury-cost-badge">
                        {cost} pts
                      </div>
                    </div>

                    <p className="reward-luxury-description">
                      {b.description}
                    </p>

                    <div className="reward-luxury-footer">
                      {isUnlocked ? (
                        <div className="reward-unlocked-status">
                          <CheckCircle size={15} />
                          <span>¡Desbloqueado! Muestra tu QR en caja para canjear</span>
                        </div>
                      ) : (
                        <div>
                          <div className="reward-locked-progress-header">
                            <span className="reward-locked-missing-text" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Lock size={13} color="#d4a35f" />
                              <span>Faltan <strong>{missingPts} pts</strong> para desbloquear</span>
                            </span>
                            <span style={{ fontWeight: 700 }}>{progressPercent}%</span>
                          </div>
                          <div className="reward-progress-track">
                            <div className="reward-progress-fill" style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
