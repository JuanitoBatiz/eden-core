'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Crown, ShieldCheck, RefreshCw, CreditCard, Sparkles } from 'lucide-react';

export default function EdenPassQR() {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/me/qr-token', {
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al obtener código QR');
      }

      const data = await res.json();
      setToken(data.qr_token);
      setExpiresAt(new Date(data.expires_at));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    if (!expiresAt) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      const differenceInSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

      setTimeLeft(differenceInSeconds);

      if (differenceInSeconds <= 10 && !loading) {
        console.log('Renovando token QR silenciosamente...');
        fetchToken();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [expiresAt, fetchToken, loading]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="edenpass-vip-card-wrapper">
      <div className="edenpass-vip-card">
        {/* Shimmer Sheen Highlights */}
        <div className="edenpass-vip-sheen"></div>

        {/* Card Header */}
        <div className="edenpass-vip-header">
          <div className="edenpass-vip-logo-group">
            <div className="edenpass-vip-crown-icon">
              <Crown size={20} color="#d4a35f" />
            </div>
            <div>
              <div className="edenpass-vip-brand"> EDÉN</div>
              <div className="edenpass-vip-subbrand">• EDENPASS</div>
            </div>
          </div>
          <div className="edenpass-vip-status-chip">
            <ShieldCheck size={14} color="#d4a35f" />
            <span>SOCIO VIP</span>
          </div>
        </div>

        {/* Smart Chip Row */}
        <div className="edenpass-vip-chip-row">
          <div className="edenpass-smart-chip">
            <div className="chip-line horizontal"></div>
            <div className="chip-line vertical"></div>
            <div className="chip-inner"></div>
          </div>
          <div className="edenpass-vip-motto">
            <div className="motto-title">BARRA DE ENSALADAS & JUGOS</div>
          </div>
        </div>

        {/* Center Stage QR Box */}
        <div className="edenpass-vip-qr-stage">
          {loading && !token ? (
            <div className="edenpass-vip-loading">
              <div className="spin-icon gold-spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(212, 163, 95, 0.2)', borderTopColor: '#d4a35f', borderRadius: '50%' }}></div>
              <span>Generando credencial segura...</span>
            </div>
          ) : error ? (
            <div className="edenpass-vip-error">
              <span>{error}</span>
              <button onClick={fetchToken} className="edenpass-vip-retry-btn">Reintentar</button>
            </div>
          ) : token ? (
            <div className="edenpass-vip-qr-frame">
              <QRCodeSVG
                value={token}
                size={180}
                level="H"
                fgColor="#112217"
              />
              <div className="qr-corner top-left"></div>
              <div className="qr-corner top-right"></div>
              <div className="qr-corner bottom-left"></div>
              <div className="qr-corner bottom-right"></div>
            </div>
          ) : null}
          <p className="edenpass-vip-hint">Presenta y escanea tu código en mostrador para acumular puntos o canjear productos</p>
        </div>

        {/* Card Footer / Timer */}
        {token && !error && (
          <div className="edenpass-vip-footer">
            <div className="edenpass-vip-timer">
              <div className={`edenpass-indicator ${timeLeft > 30 ? 'good' : 'warning'}`}></div>
              <span>Válido por {formatTime(timeLeft)}</span>
            </div>

            <button
              onClick={fetchToken}
              disabled={loading}
              className="edenpass-vip-refresh-btn"
              title="Actualizar Código QR"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Actualizando...' : 'Renovar QR'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
