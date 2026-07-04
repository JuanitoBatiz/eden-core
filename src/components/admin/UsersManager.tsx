'use client';

import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, UserCheck, UserX, AlertCircle } from 'lucide-react';
import { User } from '@/types/api-contracts';

export default function UsersManager({ accessToken }: { accessToken: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setTotalCount(data.count || 0);
      } else {
        setError(data.error || 'Error loading users');
      }
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, accessToken]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleChangeRole = async (userId: string, newRole: string, currentRole: string) => {
    if (newRole === currentRole) return;
    if (!confirm(`¿Estás seguro de cambiar el rol a ${newRole}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Error cambiando rol');
      }
    } catch (e) {
      alert('Error de red');
    }
  };

  const handleToggleActive = async (user: User) => {
    const action = user.active ? 'deactivate' : 'reactivate';
    const actionText = user.active ? 'desactivar' : 'reactivar';
    
    let msg = `¿Seguro que deseas ${actionText} a ${user.name}?`;
    if (user.active) {
      msg += `\n\nATENCIÓN: Este usuario no podrá iniciar sesión ni usar sesiones activas inmediatamente. Sus tokens actuales se invalidarán.`;
    }

    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || `Error al ${actionText}`);
      }
    } catch (e) {
      alert('Error de red');
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--color-green-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={24} /> Gestión de Usuarios
        </h2>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Buscar por nombre o teléfono..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--color-cream-dark)', width: '250px', color: 'var(--color-text-dark)' }}
          />
          <button type="submit" style={{ padding: '10px 15px', backgroundColor: 'var(--color-text-dark)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Search size={16} /> Buscar
          </button>
        </form>
      </div>

      <div style={{ padding: '10px', backgroundColor: 'var(--color-ochre-light)', color: 'var(--color-ochre)', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={18} />
        La desactivación de una cuenta expulsa al usuario de su sesión en un máximo de 15 segundos mediante invalidación por caché.
      </div>

      {error && <div style={{ color: 'var(--color-terracotta)', marginBottom: '15px' }}>{error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-cream-light)', color: 'var(--color-text-muted)', fontSize: '0.9rem', borderBottom: '1px solid var(--color-cream-dark)' }}>
              <th style={{ padding: '12px' }}>Nombre</th>
              <th style={{ padding: '12px' }}>Teléfono</th>
              <th style={{ padding: '12px' }}>Rol</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px' }}>Registro</th>
              <th style={{ padding: '12px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando usuarios...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No se encontraron usuarios.</td></tr>
            ) : (
              users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--color-cream-dark)', opacity: user.active ? 1 : 0.6 }}>
                  <td style={{ padding: '12px', fontWeight: 500, color: 'var(--color-text-dark)' }}>{user.name}</td>
                  <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{user.phone}</td>
                  <td style={{ padding: '12px' }}>
                    <select 
                      value={user.role} 
                      onChange={(e) => handleChangeRole(user.id, e.target.value, user.role)}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--color-cream-dark)', outline: 'none', color: 'var(--color-text-dark)', fontWeight: 500 }}
                    >
                      <option value="customer">Cliente</option>
                      <option value="cashier">Cajero / POS</option>
                      <option value="owner">Dueño (Admin)</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.8rem', 
                      fontWeight: 600,
                      backgroundColor: user.active ? 'rgba(4,120,87,0.1)' : 'var(--color-ochre-light)',
                      color: user.active ? 'var(--color-green-dark)' : 'var(--color-terracotta)'
                    }}>
                      {user.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button 
                      onClick={() => handleToggleActive(user)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        color: user.active ? 'var(--color-terracotta)' : 'var(--color-green-dark)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}
                      title={user.active ? 'Desactivar Usuario' : 'Reactivar Usuario'}
                    >
                      {user.active ? <><UserX size={16} /> Bloquear</> : <><UserCheck size={16} /> Activar</>}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Mostrando {users.length} de {totalCount} usuarios
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            disabled={page <= 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '6px 12px', border: '1px solid var(--color-cream-dark)', borderRadius: '6px', backgroundColor: 'white', color: 'var(--color-text-dark)', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            Anterior
          </button>
          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '6px 12px', border: '1px solid var(--color-cream-dark)', borderRadius: '6px', backgroundColor: 'white', color: 'var(--color-text-dark)', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
