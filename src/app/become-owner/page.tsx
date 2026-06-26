'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';

export default function SetupOwnerPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/upgrade-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ secretCode: code.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Código incorrecto o error de red');
        setLoading(false);
        return;
      }

      setSuccess(true);
      // Redirigir al panel de admin después de 1.5s
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1500);

    } catch (err) {
      console.error(err);
      setError('Error de conexión');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-cream-light)' }}>
      {/* HEADER */}
      <header className="header">
        <div className="container header-content">
          <div className="logo-container" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <img src="/logo.png" alt="Edén Logo" className="logo-img" />
            <div className="logo-text">EDÉN</div>
          </div>
          
          <button className="cart-icon-btn" onClick={() => router.push('/')} style={{ background: 'none', border: '1px solid var(--color-green-dark)', color: 'var(--color-green-dark)' }}>
            <ArrowLeft size={16} />
            <span>Volver</span>
          </button>
        </div>
      </header>

      <main className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
        <div style={{ backgroundColor: 'white', padding: '40px 30px', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          
          {!success ? (
            <>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--color-cream-dark)', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 20px auto' }}>
                <Key size={30} color="var(--color-terracotta)" />
              </div>
              
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: 'var(--color-green-dark)', marginBottom: '10px' }}>
                Acceso de Dueño
              </h1>
              
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '30px', lineHeight: '1.5' }}>
                Ingresa el Código Secreto Maestro para elevar los permisos de tu cuenta y acceder al Panel de Administración.
              </p>

              <form onSubmit={handleUpgrade} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input 
                  type="password"
                  placeholder="Código Secreto"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  style={{
                    padding: '15px',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    fontSize: '1rem',
                    textAlign: 'center',
                    letterSpacing: '2px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  autoFocus
                />

                {error && (
                  <div style={{ color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading || !code}
                  style={{
                    padding: '15px',
                    backgroundColor: 'var(--color-green-dark)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: loading || !code ? 'not-allowed' : 'pointer',
                    opacity: loading || !code ? 0.7 : 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s'
                  }}
                >
                  {loading ? <Loader2 className="spin" size={20} /> : 'Validar Código'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 20px auto' }}>
                <ShieldCheck size={40} color="#16a34a" />
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: '#16a34a', marginBottom: '10px' }}>
                ¡Acceso Concedido!
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                Tu cuenta ha sido elevada a Owner permanentemente. Entrando al panel...
              </p>
            </div>
          )}
        </div>
      </main>
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
