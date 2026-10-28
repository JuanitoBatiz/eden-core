'use client';

import { useEffect } from 'react';

/**
 * Motor ligero de animaciones por scroll (sin dependencias):
 *  - [data-reveal]            → agrega .is-in cuando entra en pantalla (una vez).
 *  - [data-words]             → divide el texto en palabras y las ilumina según el scroll (--w por palabra).
 *  - [data-progress]          → escribe --p (0..1): avance del scroll a través del elemento.
 *  - [data-parallax="0.2"]    → desplaza el elemento en Y proporcional a su distancia al centro de la pantalla.
 *  - [data-count="12"]        → cuenta de 0 al número cuando entra en pantalla.
 * Todo se calcula en un solo requestAnimationFrame y respeta prefers-reduced-motion.
 */
export function useScrollFx(deps: unknown[] = []) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    // ── Reveal ──────────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );

    // ── Contadores ──────────────────────────────────────────
    const countIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          countIo.unobserve(el);
          const to = Number(el.dataset.count || 0);
          const prefix = el.dataset.prefix || '';
          if (reduce) {
            el.textContent = prefix + to;
            return;
          }
          const t0 = performance.now();
          const dur = 1300;
          const step = (t: number) => {
            const k = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - k, 3);
            el.textContent = prefix + Math.round(to * eased);
            if (k < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      },
      { threshold: 0.4 }
    );

    let progressEls: HTMLElement[] = [];
    let parallaxEls: HTMLElement[] = [];
    let wordEls: HTMLElement[] = [];

    const scan = () => {
      document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)').forEach((el) => {
        if (reduce) el.classList.add('is-in');
        else io.observe(el);
      });
      document.querySelectorAll<HTMLElement>('[data-count]:not([data-counted])').forEach((el) => {
        el.dataset.counted = '1';
        countIo.observe(el);
      });
      document.querySelectorAll<HTMLElement>('[data-words]:not([data-split])').forEach((el) => {
        el.dataset.split = '1';
        const words = (el.textContent || '').trim().split(/\s+/);
        el.innerHTML = words.map((w) => `<span class="ed-w">${w}</span>`).join(' ');
      });
      progressEls = Array.from(document.querySelectorAll<HTMLElement>('[data-progress]'));
      parallaxEls = reduce ? [] : Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
      wordEls = Array.from(document.querySelectorAll<HTMLElement>('[data-words]'));
      tick();
    };

    let raf = 0;
    const tick = () => {
      raf = 0;
      const vh = window.innerHeight;
      root.style.setProperty('--scroll-y', String(window.scrollY));
      for (const el of progressEls) {
        const r = el.getBoundingClientRect();
        const mode = el.dataset.progress;
        let p: number;
        if (mode === 'pin') {
          // 0 cuando el tope llega arriba, 1 cuando el fondo llega abajo
          const total = r.height - vh;
          p = total > 0 ? -r.top / total : 0;
        } else if (mode === 'exit') {
          // 0 en reposo, 1 cuando el elemento salió por arriba
          p = -r.top / r.height;
        } else {
          // 0 cuando entra por abajo, 1 cuando sale por arriba
          p = (vh - r.top) / (vh + r.height);
        }
        p = Math.max(0, Math.min(1, p));
        el.style.setProperty('--p', p.toFixed(4));
      }
      for (const el of parallaxEls) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const speed = Number(el.dataset.parallax || 0);
        const center = r.top + r.height / 2 - vh / 2;
        el.style.setProperty('--py', `${(-center * speed).toFixed(1)}px`);
      }
      for (const el of wordEls) {
        const r = el.getBoundingClientRect();
        const spans = el.children;
        const n = spans.length;
        if (!n) continue;
        // ilumina palabra por palabra entre 85% y 35% de la pantalla
        const start = vh * 0.85;
        const end = vh * 0.35 - r.height * 0.4;
        const k = reduce ? 1 : Math.max(0, Math.min(1, (start - r.top) / (start - end)));
        const lit = k * n;
        for (let i = 0; i < n; i++) {
          (spans[i] as HTMLElement).style.opacity = String(Math.max(0.18, Math.min(1, lit - i + 0.18)));
        }
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    let mo: MutationObserver | null = null;
    let scanTimer: ReturnType<typeof setTimeout> | null = null;
    mo = new MutationObserver(() => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, 120);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    scan();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      io.disconnect();
      countIo.disconnect();
      mo?.disconnect();
      if (scanTimer) clearTimeout(scanTimer);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
