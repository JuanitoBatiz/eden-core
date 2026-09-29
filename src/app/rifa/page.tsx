'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Ticket, CheckCircle, Info, LogIn, ChevronRight, Wind } from 'lucide-react';
import BalloonIcon from '@/components/BalloonIcon';

interface RaffleEntry {
  id: string;
  order_id: string;
  order_total: number;
  created_at: string;
}

interface RaffleData {
  total_entries: number;
  entries: RaffleEntry[];
}

export default function RifaPage() {
  const router = useRouter();
  const [raffleData, setRaffleData] = useState<RaffleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function fetchRaffle() {
      try {
        const res = await fetch('/api/me/raffle', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setRaffleData(data);
          setIsLoggedIn(true);
        } else if (res.status === 401 || res.status === 403) {
          setIsLoggedIn(false);
        }
      } catch {
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRaffle();
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  return (
    <div className="rifa-page">
      <header className="rifa-header">
        <button className="rifa-back-btn" onClick={() => router.push('/')} aria-label="Volver al inicio">
          <ArrowLeft size={20} />
          <span>Volver al menú</span>
        </button>
      </header>

      <div className="rifa-content">
        {/* HERO COMPACTO */}
        <section className="rifa-hero-compact">
          <div className="rifa-hero-icon-wrap">
            <BalloonIcon size={56} />
          </div>
          <h1 className="rifa-title">Gana un vuelo en globo para dos personas</h1>
          <div className="rifa-prize-badge">
            <Wind size={16} /> Experiencia completa
          </div>
        </section>

        {/* PASOS ESCANEABLES */}
        <section className="rifa-steps">
          <div className="rifa-step">
            <div className="rifa-step-num">1</div>
            <p>Pide <strong>$200</strong> o más</p>
          </div>
          <ChevronRight className="rifa-step-arrow" size={20} />
          <div className="rifa-step">
            <div className="rifa-step-num">2</div>
            <p>Gana <strong>1 oportunidad</strong></p>
          </div>
          <ChevronRight className="rifa-step-arrow" size={20} />
          <div className="rifa-step">
            <div className="rifa-step-num">3</div>
            <p>Sorteo <strong>6 Noviembre</strong></p>
          </div>
        </section>

        {/* ÁREA DEL USUARIO: CONTADOR Y CTA */}
        <section className="rifa-user-area">
          {isLoading ? (
            <div className="rifa-loading-skeleton" />
          ) : isLoggedIn && raffleData ? (
            <div className="rifa-tickets-board">
              <div className="rifa-tickets-header">
                <Ticket size={24} className="rifa-ticket-icon" />
                <div className="rifa-tickets-count">
                  <span className="count-number">{raffleData.total_entries}</span>
                  <span className="count-label">Oportunidades ganadas</span>
                </div>
              </div>

              {raffleData.total_entries === 0 ? (
                <div className="rifa-empty-state">
                  Aún no tienes oportunidades ganadas. ¡Haz tu primer pedido para participar!
                </div>
              ) : (
                <div className="rifa-history-compact">
                  {raffleData.entries.map((entry, i) => (
                    <div key={entry.id} className="rifa-history-row">
                      <CheckCircle size={16} className="text-terracotta" />
                      <span className="history-date">{formatDate(entry.created_at)}</span>
                      <span className="history-amount">${entry.order_total.toFixed(0)}</span>
                      <span className="history-ticket">Oportunidad #{raffleData.total_entries - i}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rifa-guest-board">
              <LogIn size={24} className="rifa-guest-icon" />
              <p>Inicia sesión para ver tus oportunidades</p>
              <button className="rifa-login-btn" onClick={() => { window.location.href = '/?login=1'; }}>
                Iniciar sesión
              </button>
            </div>
          )}
        </section>

        {/* CTA PRINCIPAL */}
        <button className="rifa-cta-btn" onClick={() => router.push('/')}>
          Ir al menú a pedir
        </button>

        {/* LEGAL COMPACTO */}
        <p className="rifa-legal-note">
          <Info size={14} /> Válido solo en pedidos pagados por esta web. Ganadores contactados por WhatsApp.
        </p>
      </div>
    </div>
  );
}