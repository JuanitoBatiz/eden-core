'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ShieldCheck, Smartphone } from 'lucide-react';

/**
 * Inicio de sesión del Edén Pass con los mismos endpoints que usa el checkout
 * (/api/auth/check-phone, /api/sms, /api/auth/verify-otp). No crea pedidos:
 * solo verifica el número, deja la sesión iniciada y avisa con onSuccess.
 */
export default function LoginCard({ onSuccess }: { onSuccess: (user: { name?: string; phone?: string }) => void }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [needsName, setNeedsName] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 50);
  }, [step]);

  const sendCode = async () => {
    setError('');
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name: name.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No pudimos enviar el código. Intenta de nuevo.');
    if (data.code) setDevCode(String(data.code));
    setCooldown(45);
    setStep('code');
  };

  const handlePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{10}$/.test(phone)) {
      setError('Escribe tu celular a 10 dígitos.');
      return;
    }
    if (needsName && !name.trim()) {
      setError('Escribe tu nombre para crear tu Edén Pass.');
      return;
    }
    setBusy(true);
    try {
      if (!needsName) {
        const check = await fetch('/api/auth/check-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        if (check.ok) {
          const d = await check.json();
          if (!d.exists) {
            // Número nuevo: pedimos el nombre antes de enviar el SMS
            setNeedsName(true);
            setBusy(false);
            return;
          }
        }
      }
      await sendCode();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error de red. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError('El código tiene 6 dígitos.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone, code, name: name.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Código incorrecto o expirado.');
        if (data.code === 'wrong_code') setCode('');
        if (data.code === 'expired' || data.code === 'max_attempts') {
          setCode('');
          setCooldown(0);
        }
        return;
      }
      const user = { name: data.user?.name || name, phone: data.user?.phone || phone };
      try {
        localStorage.setItem('eden_user_session', JSON.stringify({ ...user, role: data.user?.role || 'customer', lastActive: Date.now() }));
      } catch {}
      onSuccess(user);
    } catch {
      setError('Error de red al verificar el código.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      await sendCode();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pretty = `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;

  return (
    <div className="ed-login">
      <div className="ed-login-steps" aria-hidden="true">
        <span className={step === 'phone' ? 'is-on' : 'is-done'}>1</span>
        <i />
        <span className={step === 'code' ? 'is-on' : ''}>2</span>
      </div>

      {step === 'phone' ? (
        <form onSubmit={handlePhone} className="ed-login-form">
          <div className="ed-login-ico"><Smartphone size={22} /></div>
          <h2>Inicia sesión con tu celular</h2>
          <p>Te enviamos un código por SMS. Si es tu primera vez, tu Edén Pass se crea al verificar tu número.</p>

          <label className="ed-field">
            <span>Celular</span>
            <div className="ed-field-row">
              <em>+52</em>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="10 dígitos"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ''));
                  setNeedsName(false);
                }}
              />
            </div>
          </label>

          {needsName && (
            <label className="ed-field ed-field--new">
              <span>¡Bienvenido! ¿Cómo te llamas?</span>
              <input type="text" autoComplete="name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
          )}

          {error && <div className="ed-login-error">{error}</div>}

          <button className="ed-btn ed-btn--gold ed-login-btn" type="submit" disabled={busy}>
            <span>{busy ? 'Enviando…' : needsName ? 'Crear mi Edén Pass' : 'Enviarme el código'}</span>
            {!busy && <ArrowRight size={18} />}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="ed-login-form">
          <div className="ed-login-ico"><ShieldCheck size={22} /></div>
          <h2>Escribe tu código</h2>
          <p>Lo enviamos por SMS al <b>{pretty}</b>.</p>

          <label className="ed-field">
            <span>Código de 6 dígitos</span>
            <input
              ref={codeRef}
              className="ed-code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>

          {devCode && <div className="ed-login-dev">Modo local: usa el código <b>{devCode}</b></div>}
          {error && <div className="ed-login-error">{error}</div>}

          <button className="ed-btn ed-btn--gold ed-login-btn" type="submit" disabled={busy || code.length !== 6}>
            <span>{busy ? 'Verificando…' : 'Entrar a mi Edén Pass'}</span>
            {!busy && <ArrowRight size={18} />}
          </button>

          <div className="ed-login-links">
            <button type="button" onClick={resend} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? `Reenviar código en ${cooldown}s` : '¿No te llegó? Reenviar código'}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(''); }}>
              Cambiar número
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
