'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Sparkles, Crown, Gift, Lock, CheckCircle, ArrowRight } from 'lucide-react';
import EdenPassQR from '@/components/loyalty/EdenPassQR';
import SiteNav, { NavTarget } from '@/components/site/SiteNav';
import { EdenMark, Monstera } from '@/components/site/brand';
import { useCurtain } from '@/components/site/Curtain';
import { useScrollFx } from '@/components/site/useScrollFx';

const TIERS = [
  { name: 'Estándar', pts: 0 },
  { name: 'Plata', pts: 40 },
  { name: 'Oro', pts: 90 },
  { name: 'Diamante', pts: 140 },
];

export default function PerfilPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<any>(null);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [memberName, setMemberName] = useState('');
  const { go } = useCurtain();
  useScrollFx([loading, isAuthenticated]);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem('eden_user_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.name) setMemberName(String(parsed.name).split(' ')[0]);
        if (parsed.lastActive && (Date.now() - parsed.lastActive) < 30 * 24 * 60 * 60 * 1000) {
          setIsAuthenticated(true);
          setLoading(false);
        } else {
          localStorage.removeItem('eden_user_session');
        }
      }
    } catch (e) {}

    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
          return res.json();
        } else if (res.status === 401) {
          setIsAuthenticated(false);
          try { localStorage.removeItem('eden_user_session'); } catch (e) {}
        }
        return null;
      })
      .then(data => {
        if (data && data.user) {
          if (data.user.name) setMemberName(String(data.user.name).split(' ')[0]);
          try {
            localStorage.setItem('eden_user_session', JSON.stringify({
              name: data.user.name || '',
              phone: data.user.phone || '',
              role: data.user.role || 'customer',
              lastActive: Date.now()
            }));
          } catch (e) {}
        }
      })
      .catch(() => {
        // Mantener sesión local si hubo error de red
      })
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
    go({ word: 'EDÉN', route: true, action: () => router.push('/') });
  };

  const navigate = (t: NavTarget) => {
    if (t === 'perfil') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (t === 'rifa') { go({ word: 'RIFA', route: true, action: () => router.push('/rifa') }); return; }
    const words: Record<string, string> = { inicio: 'EDÉN', menu: 'MENÚ', arma: 'TU ENSALADA', pass: 'EDÉN PASS' };
    const hash = t === 'inicio' ? '' : `#${t}`;
    go({ word: words[t] || 'EDÉN', route: true, action: () => router.push(`/${hash}`) });
  };

  const nav = <SiteNav variant="page" active="perfil" onNavigate={navigate} />;

  if (loading) {
    return (
      <div className="ed-page" style={{ display: 'grid', placeItems: 'center', background: 'var(--ed-deep)' }}>
        {nav}
        <div className="spin-icon" style={{ width: '44px', height: '44px', border: '3px solid rgba(230,203,146,.2)', borderTopColor: 'var(--ed-gold-2)', borderRadius: '50%' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="ed-page">
        {nav}
        <section className="ed-pp-hero ed-pp-join">
          <Monstera v={0} className="ed-pp-leaf1" />
          <Monstera v={2} className="ed-pp-leaf2" />
          <div className="ed-wrap ed-pp-grid">
            <div>
              <div className="ed-eyebrow ed-eyebrow--gold">Membresía · Edén Pass</div>
              <h1 className="ed-pp-title">Únete a la <em>familia Edén</em></h1>
              <p className="ed-pp-hello">
                Haz tu primer pedido o inicia sesión para activar tu credencial <strong>Edén Pass</strong>, acumular puntos y canjear recompensas en mostrador.
              </p>
              <div className="ed-tiers" style={{ maxWidth: 560 }}>
                {TIERS.map((t, i) => (
                  <div key={t.name} className={`ed-tier t${i}`}>
                    <span className="ed-tier-gem" />
                    <b>{t.name}</b>
                    <small>{t.pts === 0 ? 'Al unirte' : `${t.pts} pts`}</small>
                  </div>
                ))}
              </div>
              <div className="ed-pp-actions">
                <button className="ed-btn ed-btn--gold" onClick={() => navigate('inicio')}>
                  <Sparkles size={18} /> <span>Activar mi Edén Pass</span>
                </button>
              </div>
            </div>
            <div className="ed-pass-card-wrap is-in">
              <div className="ed-pass-card">
                <span className="ed-pass-sheen" />
                <div className="ed-pass-card-top">
                  <EdenMark leaf={false} className="ed-pass-mark" />
                  <span className="ed-pass-chip"><Crown size={13} /> Club</span>
                </div>
                <div className="ed-pass-card-mid">
                  <div>
                    <small>Edén Pass</small>
                    <b>Tu credencial de socio</b>
                    <span>3 puntos por cada $100 de compra</span>
                  </div>
                </div>
                <div className="ed-pass-card-foot">
                  <span>Lo esencial es natural</span>
                  <span>Otumba · Edo. Méx.</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <footer className="ed-pp-footer">Restaurante Edén · Otumba, Estado de México</footer>
      </div>
    );
  }

  const points: number = loyaltyData?.loyalty_points || 0;
  const tierIdx = TIERS.reduce((acc, t, i) => (points >= t.pts ? i : acc), 0);
  const nextTier = TIERS[tierIdx + 1];
  const prevPts = TIERS[tierIdx].pts;
  const ringPct = nextTier ? Math.min(1, (points - prevPts) / (nextTier.pts - prevPts)) : 1;
  const R = 84;
  const C = 2 * Math.PI * R;
  const ladderPct = Math.min(100, (points / TIERS[TIERS.length - 1].pts) * 100);

  return (
    <div className="ed-page">
      {nav}
      <section className="ed-pp-hero">
        <Monstera v={0} className="ed-pp-leaf1" />
        <Monstera v={2} className="ed-pp-leaf2" />
        <div className="ed-wrap ed-pp-grid">
          <div>
            <div className="ed-eyebrow ed-eyebrow--gold">Mi perfil · Edén Pass</div>
            <h1 className="ed-pp-title">Hola{memberName ? ',' : ''} <em>{memberName || 'socio'}</em></h1>
            <p className="ed-pp-hello">
              Presenta tu código en mostrador para acumular puntos o canjear tus premios. El QR se renueva solo para mantener tu cuenta segura.
            </p>
            <div className="ed-pp-actions">
              <button className="ed-btn ed-btn--gold" onClick={() => navigate('menu')}>
                <span>Hacer un pedido</span>
                <ArrowRight size={18} />
              </button>
              <button className="ed-btn ed-btn--line" onClick={handleLogout}>
                <LogOut size={17} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
          <div className="ed-pp-qr">
            <EdenPassQR />
          </div>
        </div>
      </section>

      <main className="ed-pp-body">
        <div className="ed-wrap">
          {loyaltyData && (
            <div className="ed-points" data-reveal="">
              <div className="ed-ring">
                <svg viewBox="0 0 200 200" aria-hidden="true">
                  <defs>
                    <linearGradient id="edRingGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#56742D" />
                      <stop offset="100%" stopColor="#C9A15A" />
                    </linearGradient>
                  </defs>
                  <circle className="trk" cx="100" cy="100" r={R} />
                  <circle className="val" cx="100" cy="100" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - ringPct)} />
                </svg>
                <div className="ed-ring-center">
                  <b data-count={points}>{points}</b>
                  <span>puntos</span>
                </div>
              </div>
              <div>
                <span className="ed-points-tier"><Crown size={15} /> Nivel {loyaltyData.loyalty_tier}</span>
                <h3>
                  {nextTier
                    ? <>Te faltan {loyaltyData.points_needed_for_next_tier ?? Math.max(0, nextTier.pts - points)} pts para {loyaltyData.next_tier || nextTier.name}</>
                    : <>Estás en el nivel más alto</>}
                </h3>
                <p>Acumulas 3 puntos por cada $100 en pedidos pagados o entregados.</p>
                <div className="ed-ladder">
                  <span className="ed-ladder-fill" style={{ width: `${ladderPct}%` }} />
                  {TIERS.map((t, i) => (
                    <div key={t.name} className={`ed-rung t${i} ${points >= t.pts ? 'is-on' : ''}`}>
                      <span className="ed-tier-gem" />
                      <b>{t.name}</b>
                      <small>{t.pts === 0 ? 'Inicio' : `${t.pts} pts`}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {benefits && benefits.length > 0 && (
            <>
              <div className="ed-pp-section-head" data-reveal="">
                <div>
                  <span className="ed-eyebrow">Recompensas</span>
                  <h2>Catálogo de <em>premios</em></h2>
                </div>
                <p>Se desbloquean solos al juntar puntos. Muestra tu QR en caja para canjear cualquiera de tus premios desbloqueados.</p>
              </div>
              <div className="ed-rewards">
                {benefits.map((b: any, idx: number) => {
                  const cost = b.points_cost || b.points_required || 0;
                  const isUnlocked = points >= cost;
                  const missingPts = Math.max(0, cost - points);
                  const progressPercent = cost > 0 ? Math.min(100, Math.floor((points / cost) * 100)) : 100;
                  return (
                    <article key={b.id || idx} className={`ed-reward ${isUnlocked ? 'is-on' : ''}`} data-reveal="">
                      {isUnlocked && <span className="ed-pass-sheen" />}
                      <div className="ed-reward-top">
                        <span className="ed-reward-ico">{isUnlocked ? <Gift size={20} /> : <Lock size={18} />}</span>
                        <span className="ed-reward-cost">{cost} pts</span>
                      </div>
                      <h3>{b.name}</h3>
                      {b.description && <p>{b.description}</p>}
                      {isUnlocked ? (
                        <div className="ed-reward-status"><CheckCircle size={16} /> ¡Desbloqueado! Muestra tu QR en caja</div>
                      ) : (
                        <div className="ed-reward-status" style={{ display: 'block' }}>
                          <div className="ed-reward-meta">
                            <span>Faltan {missingPts} pts</span>
                            <span>{progressPercent}%</span>
                          </div>
                          <div className="ed-reward-bar"><span style={{ width: `${progressPercent}%` }} /></div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {loyaltyData?.history?.length > 0 && (
            <>
              <div className="ed-pp-section-head" data-reveal="">
                <div>
                  <span className="ed-eyebrow">Movimientos</span>
                  <h2>Historial de <em>canjes</em></h2>
                </div>
              </div>
              <ul className="ed-history" data-reveal="">
                {loyaltyData.history.map((item: any) => (
                  <li key={item.id}>
                    <span>{item.benefit_description}</span>
                    <b>-{item.points_used} pts</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
      <footer className="ed-pp-footer">Restaurante Edén · Otumba, Estado de México</footer>
    </div>
  );
}
