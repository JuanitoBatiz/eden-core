import React, { useState, useEffect } from 'react';
import { MapPin, Truck, Loader2, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { DeliveryZone } from '@/types/api-contracts';

export default function DeliveryZonesManager() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [restaurantLocation, setRestaurantLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);

  // Formularios
  const [locationForm, setLocationForm] = useState({ lat: '', lng: '', address: '' });
  
  // Zonas
  const [editingZone, setEditingZone] = useState<Partial<DeliveryZone> | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resLoc, resZones] = await Promise.all([
        fetch('/api/admin/settings/restaurant-location', { credentials: 'include' }),
        fetch('/api/admin/delivery-zones', { credentials: 'include' })
      ]);
      if (resLoc.ok) {
        const data = await resLoc.json();
        setRestaurantLocation(data.location);
        setLocationForm({
          lat: data.location?.lat?.toString() || '',
          lng: data.location?.lng?.toString() || '',
          address: data.location?.address || ''
        });
      }
      if (resZones.ok) {
        const data = await resZones.json();
        setZones(data.zones || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveLocation = async () => {
    setSavingLocation(true);
    try {
      const payload = {
        lat: parseFloat(locationForm.lat),
        lng: parseFloat(locationForm.lng),
        address: locationForm.address
      };
      const res = await fetch('/api/admin/settings/restaurant-location', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setRestaurantLocation(data.location);
        alert('Ubicación del restaurante guardada');
      } else {
        alert('Error al guardar la ubicación');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red');
    } finally {
      setSavingLocation(false);
    }
  };

  const saveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;

    try {
      const isEdit = !!editingZone.id;
      const method = isEdit ? 'PUT' : 'POST';
      const body = JSON.stringify(editingZone);

      const res = await fetch('/api/admin/delivery-zones', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body
      });
      
      if (res.ok) {
        setEditingZone(null);
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Error al guardar la zona');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red al guardar la zona');
    }
  };

  const deleteZone = async (id: string) => {
    if (!confirm('¿Eliminar zona?')) return;
    try {
      const res = await fetch(`/api/admin/delivery-zones?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        fetchData();
      } else {
        const error = await res.json();
        alert(error.error || 'Error al eliminar la zona');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red al eliminar la zona');
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="spin-icon" /> Cargando...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* Ubicación del Restaurante */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <MapPin size={20} color="var(--color-terracotta)" />
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Ubicación del Restaurante</h2>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            Esta ubicación se usa como punto de partida para calcular las distancias de los envíos a domicilio.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={styles.label}>Latitud</label>
              <input 
                type="text" 
                value={locationForm.lat} 
                onChange={e => setLocationForm(prev => ({ ...prev, lat: e.target.value }))}
                style={styles.input}
                placeholder="Ej: 19.6997"
              />
            </div>
            <div>
              <label style={styles.label}>Longitud</label>
              <input 
                type="text" 
                value={locationForm.lng} 
                onChange={e => setLocationForm(prev => ({ ...prev, lng: e.target.value }))}
                style={styles.input}
                placeholder="Ej: -98.7628"
              />
            </div>
          </div>
          <div>
            <label style={styles.label}>Dirección descriptiva</label>
            <input 
              type="text" 
              value={locationForm.address} 
              onChange={e => setLocationForm(prev => ({ ...prev, address: e.target.value }))}
              style={styles.input}
              placeholder="Calle, número, colonia..."
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={saveLocation} disabled={savingLocation} className="admin-btn admin-btn-accept" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {savingLocation ? <Loader2 size={16} className="spin-icon"/> : <Save size={16} />}
              Guardar Ubicación
            </button>
          </div>
        </div>
      </div>

      {/* Zonas de Entrega */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Truck size={20} color="var(--color-green-dark)" />
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Zonas de Envío y Tarifas</h2>
          <button 
            onClick={() => setEditingZone({ active: true, label: '', max_distance_km: 0, min_order_amount: 0, fee: 0 })}
            className="admin-btn admin-btn-accept"
            style={{ marginLeft: 'auto', display: 'flex', gap: '5px', padding: '6px 12px' }}
          >
            <Plus size={16} /> Nueva Zona
          </button>
        </div>
        
        <div style={{ padding: '20px' }}>
          {editingZone ? (
            <form onSubmit={saveZone} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0 }}>{editingZone.id ? 'Editar Zona' : 'Crear Zona'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={styles.label}>Nombre de la Zona</label>
                  <input required type="text" value={editingZone.label || ''} onChange={e => setEditingZone(p => ({...p!, label: e.target.value}))} style={styles.input} placeholder="Ej: Zona 1 (Cercana)"/>
                </div>
                <div>
                  <label style={styles.label}>Tarifa de Envío ($)</label>
                  <input required type="number" min="0" step="1" value={editingZone.fee || 0} onChange={e => setEditingZone(p => ({...p!, fee: Number(e.target.value)}))} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Distancia Máxima (km)</label>
                  <input required type="number" min="0" step="0.1" value={editingZone.max_distance_km || 0} onChange={e => setEditingZone(p => ({...p!, max_distance_km: Number(e.target.value)}))} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Pedido Mínimo ($)</label>
                  <input required type="number" min="0" step="1" value={editingZone.min_order_amount || 0} onChange={e => setEditingZone(p => ({...p!, min_order_amount: Number(e.target.value)}))} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>Tiempo Estimado (min)</label>
                  <input type="number" min="0" step="1" value={editingZone.delivery_time_mins || 0} onChange={e => setEditingZone(p => ({...p!, delivery_time_mins: Number(e.target.value)}))} style={styles.input} placeholder="Opcional" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '24px' }}>
                  <input type="checkbox" id="zone_active" checked={editingZone.active !== false} onChange={e => setEditingZone(p => ({...p!, active: e.target.checked}))} />
                  <label htmlFor="zone_active" style={{ cursor: 'pointer', fontWeight: 600 }}>Zona Activa</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditingZone(null)} className="admin-btn admin-btn-cancel">Cancelar</button>
                <button type="submit" className="admin-btn admin-btn-accept">Guardar Zona</button>
              </div>
            </form>
          ) : null}

          {zones.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8' }}>No hay zonas configuradas. Los envíos a domicilio podrían no calcularse correctamente.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Zona</th>
                  <th style={styles.th}>Distancia Máx.</th>
                  <th style={styles.th}>Tarifa</th>
                  <th style={styles.th}>Pedido Mín.</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {zones.sort((a, b) => a.max_distance_km - b.max_distance_km).map(z => (
                  <tr key={z.id}>
                    <td style={styles.td}><strong>{z.label}</strong></td>
                    <td style={styles.td}>Hasta {z.max_distance_km} km</td>
                    <td style={styles.td}>${z.fee}</td>
                    <td style={styles.td}>${z.min_order_amount}</td>
                    <td style={styles.td}>
                      <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.8rem', backgroundColor: z.active ? '#dcfce7' : '#f1f5f9', color: z.active ? '#166534' : '#64748b' }}>
                        {z.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setEditingZone(z)} style={styles.iconBtn} title="Editar"><Edit2 size={16} color="#0284c7" /></button>
                        <button onClick={() => deleteZone(z.id)} style={styles.iconBtn} title="Eliminar"><Trash2 size={16} color="#dc2626" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
    marginBottom: '24px',
    overflow: 'hidden'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 20px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0'
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.95rem'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px',
    borderBottom: '2px solid #e2e8f0',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.9rem'
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    fontSize: '0.95rem'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px'
  }
};
