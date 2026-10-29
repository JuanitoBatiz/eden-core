'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, UserCircle, ArrowUpRight } from 'lucide-react';
import { EdenMark, Monstera } from './brand';

export type NavTarget = 'inicio' | 'menu' | 'arma' | 'pass' | 'rifa' | 'perfil';

const LINKS: { id: NavTarget; label: string; hint: string }[] = [
  { id: 'inicio', label: 'Inicio', hint: 'Bienvenido a Edén' },
  { id: 'menu', label: 'Menú', hint: 'Ordena en línea' },
  { id: 'arma', label: 'Arma tu ensalada', hint: 'A tu gusto, paso a paso' },
  { id: 'pass', label: 'Edén Pass', hint: 'Puntos y recompensas' },
  { id: 'rifa', label: 'Rifa', hint: 'Vuelo en globo para dos' },
];

export default function SiteNav({
  active,
  cartCount = 0,
  onCart,
  onNavigate,
  categories = [],
  onCategory,
  variant = 'home',
}: {
  active?: NavTarget;
  cartCount?: number;
  onCart?: () => void;
  onNavigate: (id: NavTarget) => void;
  categories?: { id: string; name: string }[];
  onCategory?: (id: string) => void;
  variant?: 'home' | 'page';
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 30);
      if (y < 120) setHidden(false);
      else if (y > last + 6) setHidden(true);
      else if (y < last - 6) setHidden(false);
      last = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('ed-lock', open);
    return () => document.documentElement.classList.remove('ed-lock');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const nav = (id: NavTarget) => {
    setOpen(false);
    onNavigate(id);
  };

  return (
    <>
      <header
        className={`ed-nav ${scrolled || variant === 'page' ? 'is-solid' : ''} ${hidden && !open ? 'is-hidden' : ''} ${open ? 'is-open' : ''}`}
      >
        <div className="ed-nav-inner">
          <button className="ed-nav-logo" onClick={() => nav('inicio')} aria-label="Edén, inicio">
            <EdenMark leaf={false} />
          </button>

          <nav className="ed-nav-links" aria-label="Principal">
            {LINKS.filter((l) => l.id !== 'rifa').map((l) => (
              <button key={l.id} className={`ed-nav-link ${active === l.id ? 'is-active' : ''}`} onClick={() => nav(l.id)}>
                <span className="ed-nl"><span data-text={l.label}>{l.label}</span></span>
              </button>
            ))}
          </nav>

          <div className="ed-nav-actions">
            <button className="ed-icon-btn ed-hide-sm" onClick={() => nav('perfil')} aria-label="Mi perfil y Edén Pass" title="Mi perfil">
              <UserCircle size={22} />
            </button>
            {onCart && (
              <button key={`cart-${cartCount}`} className={`ed-cart-pill ${cartCount ? 'is-bump' : ''}`} onClick={onCart} aria-label={`Abrir carrito (${cartCount})`}>
                <ShoppingBag size={18} />
                <span className="ed-hide-xs">Carrito</span>
                <span className={`ed-cart-count ${cartCount ? 'has' : ''}`}>{cartCount}</span>
              </button>
            )}
            <button className={`ed-burger ${open ? 'is-x' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open}>
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {/* Menú a pantalla completa */}
      <div className={`ed-overlay ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <Monstera v={0} className="ed-overlay-leaf o1" />
        <Monstera v={1} className="ed-overlay-leaf o2" />
        <div className="ed-overlay-grid">
          <ol className="ed-overlay-links">
            {[...LINKS, { id: 'perfil' as NavTarget, label: 'Mi perfil', hint: 'Pedidos y QR de socio' }].map((l, i) => (
              <li key={l.id} style={{ ['--i' as string]: i } as React.CSSProperties}>
                <button onClick={() => nav(l.id)} className={active === l.id ? 'is-active' : ''} tabIndex={open ? 0 : -1}>
                  <span className="ed-ov-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="ed-ov-label">{l.label}</span>
                  <span className="ed-ov-hint">{l.hint}</span>
                </button>
              </li>
            ))}
          </ol>

          <aside className="ed-overlay-side">
            {categories.length > 0 && onCategory && (
              <div className="ed-ov-block">
                <div className="ed-eyebrow">Ir directo a</div>
                <div className="ed-ov-chips">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      tabIndex={open ? 0 : -1}
                      onClick={() => {
                        setOpen(false);
                        onCategory(c.id);
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="ed-ov-block">
              <div className="ed-eyebrow">Visítanos</div>
              <p className="ed-ov-text">Otumba, Estado de México</p>
              <div className="ed-ov-social">
                <a href="https://wa.me/525635830014" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>
                  WhatsApp <ArrowUpRight size={14} />
                </a>
                <a href="https://www.instagram.com/edenensaladas?igsh=OHZpZGFsZm5vc2hk" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>
                  Instagram <ArrowUpRight size={14} />
                </a>
                <a href="https://www.facebook.com/share/18cVG24wEM/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>
                  Facebook <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
          </aside>
        </div>
        <EdenMark className="ed-overlay-mark" />
      </div>
    </>
  );
}
