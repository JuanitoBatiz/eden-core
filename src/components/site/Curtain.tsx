'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EdenMark, Monstera } from './brand';

type Phase = 'idle' | 'in' | 'hold' | 'out';

interface CurtainOptions {
  /** Palabra que aparece en la cortina. Si es "EDÉN" se muestra el logotipo vectorial. */
  word: string;
  /** Qué hacer cuando la pantalla ya está cubierta (saltar a sección, cambiar de ruta...). */
  action?: () => void;
  /** true cuando la acción cambia de ruta: la cortina espera a que cargue la nueva página. */
  route?: boolean;
}

interface CurtainCtx {
  go: (opts: CurtainOptions) => void;
  busy: boolean;
}

const Ctx = createContext<CurtainCtx>({ go: (o) => o.action?.(), busy: false });

export const useCurtain = () => useContext(Ctx);

const IN_MS = 620;
const WORD_MS = 380;
const OUT_MS = 720;

export function CurtainProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [word, setWord] = useState('EDÉN');
  const pathname = usePathname();
  const waitingRoute = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const reveal = useCallback(() => {
    setPhase('out');
    later(() => setPhase('idle'), OUT_MS);
  }, []);

  const go = useCallback(
    ({ word: w, action, route }: CurtainOptions) => {
      const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        action?.();
        return;
      }
      timers.current.forEach(clearTimeout);
      timers.current = [];
      // Navegar con cortina = ya no repetir la intro de entrada
      document.documentElement.classList.add('ed-seen');
      setWord(w);
      setPhase('in');
      later(() => {
        setPhase('hold');
        if (route) {
          waitingRoute.current = window.location.pathname;
          action?.();
          // Seguridad: si la ruta tarda, se descubre de todas formas.
          later(() => {
            if (waitingRoute.current) {
              waitingRoute.current = null;
              reveal();
            }
          }, 2600);
        } else {
          action?.();
          later(reveal, 90);
        }
      }, IN_MS + WORD_MS);
    },
    [reveal]
  );

  // Cuando la nueva ruta ya montó, se levanta la cortina.
  useEffect(() => {
    if (waitingRoute.current && waitingRoute.current !== pathname) {
      waitingRoute.current = null;
      later(reveal, 160);
    }
  }, [pathname, reveal]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const isMark = word === 'EDÉN';

  return (
    <Ctx.Provider value={{ go, busy: phase !== 'idle' }}>
      {children}
      <div className={`ed-curtain is-${phase}`} aria-hidden="true">
        <Monstera v={0} className="ed-curtain-leaf l1" />
        <Monstera v={2} className="ed-curtain-leaf l2" />
        <div className="ed-curtain-word">
          {isMark ? (
            <EdenMark leaf={false} className="ed-curtain-mark" />
          ) : (
            word.split('').map((c, i) => (
              <span key={i} style={{ ['--i' as string]: i } as React.CSSProperties}>
                {c === ' ' ? ' ' : c}
              </span>
            ))
          )}
        </div>
        <div className="ed-curtain-tag">Lo esencial es natural</div>
      </div>
    </Ctx.Provider>
  );
}
