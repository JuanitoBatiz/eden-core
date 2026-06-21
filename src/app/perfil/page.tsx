'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EdenPassQR from '@/components/loyalty/EdenPassQR';

export default function PerfilPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loyaltyData, setLoyaltyData] = useState<any>(null);

  useEffect(() => {
    // Verificar sesión via refresh (no localStorage)
    // credentials:'include' envía la cookie refresh_token automáticamente
    fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          router.push('/?login=true');
        }
      })
      .catch(() => router.push('/?login=true'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // credentials:'include' envía la cookie access_token automáticamente
    fetch('/api/me/loyalty', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) setLoyaltyData(data);
      })
      .catch(console.error);
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="p-2 -ml-2 text-gray-500 hover:text-gray-800">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">Mi Perfil</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-red-500 font-semibold hover:text-red-700"
        >
          Salir
        </button>
      </header>

      <main className="max-w-md mx-auto px-4 pt-8 space-y-8">
        {/* EdenPass QR */}
        <EdenPassQR />

        {/* Loyalty Summary */}
        {loyaltyData && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-black text-gray-800 mb-4">Mis Puntos</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black text-emerald-600">{loyaltyData.loyalty_points}</p>
                <p className="text-sm text-gray-500 mt-1">puntos acumulados</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-800">{loyaltyData.loyalty_tier}</p>
                {loyaltyData.next_tier && (
                  <p className="text-xs text-gray-500 mt-1">
                    {loyaltyData.points_needed_for_next_tier} pts para {loyaltyData.next_tier}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {loyaltyData?.history?.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-black text-gray-800 mb-4">Historial de Canjes</h2>
            <ul className="space-y-3">
              {loyaltyData.history.map((item: any) => (
                <li key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.benefit_description}</span>
                  <span className="text-emerald-600 font-semibold">-{item.points_used} pts</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
