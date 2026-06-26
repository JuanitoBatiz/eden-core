'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

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

      // credentials:'include' envía la cookie httpOnly access_token automáticamente
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

  // Fetch token on mount
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Countdown timer and auto-refresh logic
  useEffect(() => {
    if (!expiresAt) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      const differenceInSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      
      setTimeLeft(differenceInSeconds);

      // Auto-refresh when 10 seconds or less remain
      if (differenceInSeconds <= 10 && !loading) {
        console.log('Renovando token QR silenciomante...');
        fetchToken();
      }

    }, 1000);

    return () => clearInterval(intervalId);
  }, [expiresAt, fetchToken, loading]);

  // Formatting timer
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="profile-card edenpass-qr-container">
      <h2 className="edenpass-qr-title">EdenPass</h2>
      <p className="edenpass-qr-subtitle">Escanea en mostrador para sumar puntos o canjear recompensas</p>

      <div className="edenpass-qr-box">
        {loading && !token ? (
          <div className="spin-icon" style={{ width: '40px', height: '40px', border: '3px solid var(--color-green-light)', borderTopColor: 'var(--color-green-dark)', borderRadius: '50%' }}></div>
        ) : error ? (
          <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 600 }}>{error}</div>
        ) : token ? (
          <div className="edenpass-qr-wrapper">
            <QRCodeSVG 
              value={token} 
              size={180}
              level="H"
              fgColor="#1B3B2B" 
            />
          </div>
        ) : null}
      </div>

      {token && !error && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="edenpass-timer-badge">
            <div className={`edenpass-indicator ${timeLeft > 30 ? 'good' : 'warning'}`}></div>
            <span>Válido por {formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={fetchToken}
            disabled={loading}
            className="edenpass-refresh-btn"
          >
            {loading ? (
              <div className="spin-icon" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
            <span>{loading ? 'Actualizando...' : 'Actualizar código'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
