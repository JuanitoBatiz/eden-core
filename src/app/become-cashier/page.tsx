'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Key, ShieldCheck, ArrowLeft, Loader2, User, Phone } from 'lucide-react';

export default function SetupCashierPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !phone.trim() || loading) {
      setError('Por favor completa todos los campos.');
      return;
    }
    
    if (phone.length < 10) {
      setError('El teléfono debe tener 10 dígitos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/become-cashier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ secretCode: code.trim(), name: name.trim(), phone: phone.trim() })
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
            <img src="/images/logo.webp" alt="Edén Logo" className="logo-img" />
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
                Registro de Cajero
              </h1>
              
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '30px', lineHeight: '1.5' }}>
                Ingresa el Código Maestro de Cajero y tus datos para habilitar tu cuenta operativa.
              </p>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <User size={20} color="var(--color-text-muted)" style={{ position: 'absolute', left: '15px' }} />
                  <input 
                    type="text"
                    placeholder="Nombre Completo"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '15px 15px 15px 45px',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      color: 'var(--color-text-dark)'
                    }}
                  />
                </div>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Phone size={20} color="var(--color-text-muted)" style={{ position: 'absolute', left: '15px' }} />
                  <input 
                    type="tel"
                    maxLength={10}
                    placeholder="Número de Celular (10 dígitos)"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\\D/g, ''))}
                    style={{
                      width: '100%',
                      padding: '15px 15px 15px 45px',
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      color: 'var(--color-text-dark)'
                    }}
                  />
                </div>

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
                    transition: 'border-color 0.2s',
                    color: 'var(--color-text-dark)'
                  }}
                />

                {error && (
                  <div style={{ color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading || !code || !name || !phone}
                  style={{
                    padding: '15px',
                    backgroundColor: 'var(--color-green-dark)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: loading || !code || !name || !phone ? 'not-allowed' : 'pointer',
                    opacity: loading || !code || !name || !phone ? 0.7 : 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s',
                    marginTop: '10px'
                  }}
                >
                  {loading ? <Loader2 className="spin" size={20} /> : 'Registrar Cuenta'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 20px auto' }}>
                <ShieldCheck size={40} color="#16a34a" />
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: '#16a34a', marginBottom: '10px' }}>
                ¡Registro Exitoso!
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                Tu cuenta ha sido habilitada como Cajero. Entrando al panel...
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
