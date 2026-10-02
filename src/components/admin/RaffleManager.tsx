'use client';

import React, { useState, useEffect } from 'react';
import { Ticket, Users, Search, ChevronDown, ChevronUp, Calendar, CheckCircle2 } from 'lucide-react';

interface RaffleEntry {
  id: string;
  order_id: string;
  order_total: number;
  created_at: string;
  ticket_printed: boolean;
}

interface Participant {
  user_id: string;
  name: string | null;
  phone: string;
  total_entries: number;
  last_entry_at: string;
  entries: RaffleEntry[];
}

interface RaffleData {
  total_participants: number;
  total_entries_issued: number;
  ranking: Participant[];
}

export default function RaffleManager() {
  const [data, setData] = useState<RaffleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState<string | null>(null);

  useEffect(() => {
    fetchRaffleData();
  }, []);

  const fetchRaffleData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/raffle', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al obtener datos de la rifa');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || 'Respuesta inválida del servidor');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTicketPrinted = async (participantId: string, ticketId: string, currentStatus: boolean) => {
    setUpdatingTicket(ticketId);
    try {
      const res = await fetch(`/api/admin/raffle/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_printed: !currentStatus }),
        credentials: 'include'
      });
      if (res.ok) {
        // Optimistic UI update
        setData((prev) => {
          if (!prev) return prev;
          const newRanking = prev.ranking.map((p) => {
            if (p.user_id !== participantId) return p;
            return {
              ...p,
              entries: p.entries.map((e) => e.id === ticketId ? { ...e, ticket_printed: !currentStatus } : e)
            };
          });
          return { ...prev, ranking: newRanking };
        });
      } else {
        const errData = await res.json();
        alert(errData.error || 'Error al actualizar el estado del boleto');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setUpdatingTicket(null);
    }
  };

  const filteredRanking = data?.ranking.filter((p) => {
    const term = searchQuery.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(term);
    const phoneMatch = p.phone.includes(term);
    return nameMatch || phoneMatch;
  }) || [];

  const toggleExpand = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div className="status-animation-ring active" style={{ margin: '0 auto 20px auto', width: '50px', height: '50px' }}></div>
        <p>Cargando datos del sorteo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginTop: '20px' }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div className="raffle-manager" style={{ marginTop: '20px' }}>
      {/* Módulo de métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ backgroundColor: '#22c55e', color: 'white', padding: '12px', borderRadius: '50%' }}>
            <Ticket size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: '#166534', fontSize: '0.9rem', fontWeight: 600 }}>Boletos Generados</p>
            <h3 style={{ margin: 0, color: '#15803d', fontSize: '1.8rem', fontWeight: 800 }}>{data?.total_entries_issued || 0}</h3>
          </div>
        </div>
        
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ backgroundColor: '#3b82f6', color: 'white', padding: '12px', borderRadius: '50%' }}>
            <Users size={24} />
          </div>
          <div>
            <p style={{ margin: 0, color: '#1e40af', fontSize: '0.9rem', fontWeight: 600 }}>Participantes</p>
            <h3 style={{ margin: 0, color: '#1d4ed8', fontSize: '1.8rem', fontWeight: 800 }}>{data?.total_participants || 0}</h3>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>
          <Search size={20} />
        </div>
        <input 
          type="text" 
          placeholder="Buscar por nombre o teléfono..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '14px 15px 14px 45px', 
            borderRadius: '8px', 
            border: '1px solid #d1d5db',
            fontSize: '1rem',
            outline: 'none'
          }}
        />
      </div>

      {/* Lista de Participantes */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {filteredRanking.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
            No se encontraron participantes.
          </div>
        ) : (
          filteredRanking.map((participant, index) => (
            <div key={participant.user_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {/* Resumen del participante (Clicable) */}
              <div 
                onClick={() => toggleExpand(participant.user_id)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '20px', 
                  cursor: 'pointer',
                  backgroundColor: expandedUser === participant.user_id ? '#f8fafc' : 'white',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ 
                    width: '40px', height: '40px', 
                    backgroundColor: '#1f2937', color: 'white', 
                    borderRadius: '50%', display: 'flex', 
                    justifyContent: 'center', alignItems: 'center',
                    fontWeight: 700, fontSize: '1.1rem'
                  }}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#111827' }}>
                      {participant.name || 'Cliente sin nombre'}
                    </h4>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>{participant.phone}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#059669', fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Ticket size={18} /> {participant.total_entries}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Boletos</div>
                  </div>
                  <div style={{ color: '#9ca3af' }}>
                    {expandedUser === participant.user_id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </div>

              {/* Detalle de oportunidades (Expansible) */}
              {expandedUser === participant.user_id && (
                <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  <h5 style={{ margin: '0 0 15px 0', color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Historial de Oportunidades
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {participant.entries.map((entry, i) => (
                      <div key={entry.order_id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        backgroundColor: 'white',
                        padding: '12px 15px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button 
                            onClick={() => toggleTicketPrinted(participant.user_id, entry.id, entry.ticket_printed)}
                            disabled={updatingTicket === entry.id}
                            style={{ 
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex',
                              opacity: updatingTicket === entry.id ? 0.5 : 1,
                              transition: 'transform 0.1s'
                            }}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            title={entry.ticket_printed ? "Marcar como NO impreso" : "Marcar como impreso (Físico creado)"}
                          >
                            <CheckCircle2 size={22} color={entry.ticket_printed ? "#10b981" : "#cbd5e1"} />
                          </button>
                          <span style={{ 
                            color: entry.ticket_printed ? '#94a3b8' : '#334155', 
                            fontWeight: 600,
                            textDecoration: entry.ticket_printed ? 'line-through' : 'none',
                            transition: 'color 0.2s'
                          }}>
                            Boleto #{participant.total_entries - i}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.9rem' }}>
                          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={14} /> {formatDate(entry.created_at)}
                          </span>
                          <strong style={{ color: '#0f172a' }}>${entry.order_total}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
