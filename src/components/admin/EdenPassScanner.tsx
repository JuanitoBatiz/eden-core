import React from 'react';
import { QrCode, Search, Gift, ShieldAlert, Award, ScanLine, UserCircle } from 'lucide-react';
import { LoyaltyBenefit, User } from '@/types/api-contracts';

interface EdenPassScannerProps {
  scannerActive: boolean;
  setScannerActive: (val: boolean) => void;
  phoneSearchQuery: string;
  setPhoneSearchQuery: (val: string) => void;
  searchPhone: (e: React.FormEvent) => void;
  edenPassError: string | null;
  customerProfile: User | null;
  loyaltyBenefits: LoyaltyBenefit[];
  isRedeeming: boolean;
  redeemBenefit: (id: string, name: string) => void;
}

export default function EdenPassScanner({
  scannerActive,
  setScannerActive,
  phoneSearchQuery,
  setPhoneSearchQuery,
  searchPhone,
  edenPassError,
  customerProfile,
  loyaltyBenefits,
  isRedeeming,
  redeemBenefit
}: EdenPassScannerProps) {
  return (
    <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
      
      {/* ESCÁNER Y BÚSQUEDA */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
            <ScanLine size={20} /> Escáner de Código QR
          </h3>
          
          {scannerActive ? (
            <div id="reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}></div>
          ) : (
            <button 
              onClick={() => setScannerActive(true)}
              style={{ width: '100%', padding: '15px', backgroundColor: '#f3f4f6', border: '2px dashed #d1d5db', borderRadius: '10px', color: '#4b5563', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              <ScanLine size={20} /> Iniciar Cámara
            </button>
          )}
          
          {edenPassError && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
              {edenPassError}
            </div>
          )}
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ color: '#4b5563', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', fontSize: '1rem' }}>
            <Search size={18} /> Búsqueda Manual
          </h3>
          <form onSubmit={searchPhone} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="tel" 
              placeholder="Teléfono (ej. 52...)" 
              value={phoneSearchQuery}
              onChange={(e) => setPhoneSearchQuery(e.target.value)}
              style={{ flex: '1', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
            />
            <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* PERFIL Y BENEFICIOS */}
      <div style={{ flex: '2', backgroundColor: '#f9fafb', borderRadius: '15px', padding: '30px', border: '1px solid #e5e7eb', minHeight: '60vh' }}>
        {!customerProfile ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
              <UserCircle size={64} style={{ marginBottom: '15px', opacity: 0.5 }} />
              <p>Escanea un código QR o busca un teléfono para ver el perfil.</p>
            </div>
        ) : (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '1px solid #e5e7eb', paddingBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '2rem', color: '#111827', fontWeight: 800, marginBottom: '5px' }}>{customerProfile.name}</h2>
                <div style={{ color: '#6b7280', fontSize: '1rem' }}>{customerProfile.phone}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>{customerProfile.loyalty_tier || 'Miembro'}</div>
                <div style={{ fontSize: '2.5rem', color: '#8b5cf6', fontWeight: 900, lineHeight: '1' }}>{customerProfile.loyalty_points} <span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: 600 }}>pts</span></div>
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', color: '#374151', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={20} color="#8b5cf6" /> Recompensas Disponibles
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
              {loyaltyBenefits.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '10px', textAlign: 'center', color: '#6b7280' }}>
                  No hay beneficios configurados en el sistema.
                </div>
              ) : (
                loyaltyBenefits.map(benefit => {
                  const canAfford = (customerProfile.loyalty_points || 0) >= benefit.points_cost;
                  return (
                    <div key={benefit.id} style={{ border: `1px solid ${canAfford ? '#8b5cf6' : '#e5e7eb'}`, borderRadius: '12px', padding: '15px', backgroundColor: 'white', opacity: benefit.is_active ? 1 : 0.6, position: 'relative', overflow: 'hidden' }}>
                      {!canAfford && (
                        <div style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '0.75rem', padding: '2px 8px', borderBottomLeftRadius: '8px', fontWeight: 600 }}>
                          Faltan {benefit.points_cost - (customerProfile.loyalty_points || 0)} pts
                        </div>
                      )}
                      <h4 style={{ fontSize: '1.1rem', color: canAfford ? '#111827' : '#9ca3af', fontWeight: 700, marginBottom: '5px' }}>{benefit.name}</h4>
                      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '15px', minHeight: '40px' }}>{benefit.description}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: canAfford ? '#8b5cf6' : '#9ca3af' }}>{benefit.points_cost} pts</span>
                        <button 
                          disabled={!canAfford || !benefit.is_active || isRedeeming}
                          onClick={() => redeemBenefit(benefit.id, benefit.name)}
                          style={{ padding: '8px 15px', borderRadius: '6px', backgroundColor: canAfford && benefit.is_active ? '#8b5cf6' : '#e5e7eb', color: canAfford && benefit.is_active ? 'white' : '#9ca3af', border: 'none', fontWeight: 600, cursor: canAfford && benefit.is_active ? 'pointer' : 'not-allowed' }}
                        >
                          Canjear
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
