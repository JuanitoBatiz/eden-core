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
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl shadow-xl border border-gray-100 max-w-sm mx-auto">
      <h2 className="text-2xl font-black text-gray-800 mb-1">EdenPass</h2>
      <p className="text-gray-500 text-sm mb-6 text-center">Escanea en mostrador para sumar puntos o canjear recompensas</p>

      <div className="relative p-4 bg-gray-50 rounded-2xl flex items-center justify-center min-h-[200px] min-w-[200px]">
        {loading && !token ? (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
        ) : error ? (
          <div className="text-red-500 text-sm text-center font-medium max-w-[200px]">{error}</div>
        ) : token ? (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-4">
              <QRCodeSVG 
                value={token} 
                size={180}
                level="H"
                fgColor="#111827" 
              />
            </div>
          </div>
        ) : null}
      </div>

      {token && !error && (
        <div className="mt-6 flex flex-col items-center w-full">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4 bg-gray-50 px-4 py-2 rounded-full">
            <div className={`w-2 h-2 rounded-full ${timeLeft > 30 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-ping'}`}></div>
            <span className="font-medium">
              Válido por {formatTime(timeLeft)}
            </span>
          </div>

          <button
            onClick={fetchToken}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-semibold transition-all active:scale-95 disabled:opacity-70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>{loading ? 'Actualizando...' : 'Actualizar código'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
