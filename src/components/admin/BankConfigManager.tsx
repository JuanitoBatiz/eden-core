'use client';

import React, { useState, useEffect } from 'react';
import { Landmark, Plus, History, CheckCircle } from 'lucide-react';
import { BankConfigCreateRequest } from '@/types/api-contracts';

export default function BankConfigManager({ accessToken }: { accessToken: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bank-config/admin', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.history || []);
      } else {
        setError(data.error || 'Error cargando historial bancario');
      }
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountName || !accountNumber) {
      return alert('Todos los campos son obligatorios');
    }
    
    if (!confirm('Al guardar esta configuración, se desactivará la anterior y esta será la única cuenta mostrada a los clientes para transferencias. ¿Continuar?')) {
      return;
    }

    try {
      const payload: BankConfigCreateRequest = {
        bank_name: bankName,
        account_holder: accountName,
        clabe: accountNumber
      };

      const res = await fetch('/api/bank-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setBankName('');
        setAccountName('');
        setAccountNumber('');
        fetchHistory();
        alert('Configuración bancaria actualizada.');
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar');
      }
    } catch (err) {
      alert('Error de red');
    }
  };

  const activeConfig = history.find(h => h.active);

  return (
    <div className="admin-bank-config-container" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
      <div style={{ flex: '1', backgroundColor: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ color: 'var(--color-green-dark)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Landmark size={24} /> Nueva Cuenta Bancaria
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, color: 'var(--color-text-dark)' }}>Nombre del Banco</label>
            <input 
              type="text" 
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="Ej. BBVA, Santander..."
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-cream-dark)', color: 'var(--color-text-dark)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, color: 'var(--color-text-dark)' }}>Nombre del Titular</label>
            <input 
              type="text" 
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-cream-dark)', color: 'var(--color-text-dark)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, color: 'var(--color-text-dark)' }}>CLABE / Número de Cuenta</label>
            <input 
              type="text" 
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              placeholder="18 dígitos"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-cream-dark)', color: 'var(--color-text-dark)' }}
            />
          </div>
          <button type="submit" style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--color-green-dark)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Plus size={18} /> Publicar Nueva Cuenta
          </button>
        </form>
      </div>

      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: 'rgba(4,120,87,0.05)', borderRadius: '15px', padding: '25px', border: '1px solid var(--color-green-dark)' }}>
          <h3 style={{ color: 'var(--color-green-dark)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} /> Cuenta Activa Actual
          </h3>
          {activeConfig ? (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-dark)' }}>{activeConfig.bank_name}</div>
              <div style={{ fontSize: '1rem', color: 'var(--color-green-dark)', margin: '5px 0' }}>{activeConfig.account_holder}</div>
              <div style={{ fontSize: '1.1rem', letterSpacing: '1px', fontFamily: 'monospace', backgroundColor: 'rgba(255,255,255,0.5)', padding: '5px 10px', borderRadius: '5px', display: 'inline-block', color: 'var(--color-text-dark)' }}>{activeConfig.clabe}</div>
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)' }}>No hay cuenta activa configurada. Los clientes no podrán hacer transferencias.</div>
          )}
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: 'var(--color-text-dark)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={20} /> Historial de Cuentas
          </h3>
          {loading ? (
            <div style={{ color: 'var(--color-text-muted)' }}>Cargando...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map(h => (
                <div key={h.id} style={{ padding: '10px', border: '1px solid var(--color-cream-dark)', borderRadius: '8px', opacity: h.active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--color-text-dark)' }}>{h.bank_name}</strong>
                    {h.active && <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--color-green-dark)', color: 'white', padding: '2px 6px', borderRadius: '10px' }}>ACTIVA</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{h.account_number}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Registrada: {new Date(h.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
