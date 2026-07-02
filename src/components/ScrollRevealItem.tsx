'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealItemProps {
  children: React.ReactNode;
  className?: string;
  staggerIndex?: number;
}

export default function ScrollRevealItem({
  children,
  className = '',
  staggerIndex = 0,
}: ScrollRevealItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -30px 0px', // Revelar cuando el elemento entra 30px en pantalla
        threshold: 0.12,
      }
    );

    observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  // Desfase de carga sutil de 85ms (ciclando de 3 en 3 para no demorar listas largas)
  const staggerDelayMs = (staggerIndex % 3) * 85;

  return (
    <div
      ref={ref}
      className={`scroll-reveal-item ${isVisible ? 'is-revealed' : ''} ${className}`}
      style={{
        transitionDelay: `${staggerDelayMs}ms`,
      }}
    >
      {children}
    </div>
  );
}
