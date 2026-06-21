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
    <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
      <div style={{ flex: '1', backgroundColor: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ color: 'var(--color-green-dark)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Landmark size={24} /> Nueva Cuenta Bancaria
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, color: '#4b5563' }}>Nombre del Banco</label>
            <input 
              type="text" 
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="Ej. BBVA, Santander..."
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, color: '#4b5563' }}>Nombre del Titular</label>
            <input 
              type="text" 
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, color: '#4b5563' }}>CLABE / Número de Cuenta</label>
            <input 
              type="text" 
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              placeholder="18 dígitos"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>
          <button type="submit" style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--color-green-dark)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Plus size={18} /> Publicar Nueva Cuenta
          </button>
        </form>
      </div>

      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: '#ecfdf5', borderRadius: '15px', padding: '25px', border: '1px solid #10b981' }}>
          <h3 style={{ color: '#065f46', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} /> Cuenta Activa Actual
          </h3>
          {activeConfig ? (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#064e3b' }}>{activeConfig.bank_name}</div>
              <div style={{ fontSize: '1rem', color: '#065f46', margin: '5px 0' }}>{activeConfig.account_name}</div>
              <div style={{ fontSize: '1.1rem', letterSpacing: '1px', fontFamily: 'monospace', backgroundColor: 'rgba(255,255,255,0.5)', padding: '5px 10px', borderRadius: '5px', display: 'inline-block' }}>{activeConfig.account_number}</div>
            </div>
          ) : (
            <div style={{ color: '#047857' }}>No hay cuenta activa configurada. Los clientes no podrán hacer transferencias.</div>
          )}
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#4b5563', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={20} /> Historial de Cuentas
          </h3>
          {loading ? (
            <div>Cargando...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map(h => (
                <div key={h.id} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', opacity: h.active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: '#374151' }}>{h.bank_name}</strong>
                    {h.active && <span style={{ fontSize: '0.7rem', backgroundColor: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '10px' }}>ACTIVA</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{h.account_number}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>Registrada: {new Date(h.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
