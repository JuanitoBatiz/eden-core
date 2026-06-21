'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Capability } from '@/lib/permissions';

interface PermissionsContextType {
  role: string | null;
  capabilities: Record<Capability, boolean>;
  loading: boolean;
  can: (capability: Capability) => boolean;
}

const defaultContext: PermissionsContextType = {
  role: null,
  capabilities: {} as Record<Capability, boolean>,
  loading: true,
  can: () => false, // fail-closed por defecto
};

const PermissionsContext = createContext<PermissionsContextType>(defaultContext);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Record<Capability, boolean>>({} as Record<Capability, boolean>);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        // credentials: 'include' envía automáticamente las cookies httpOnly
        // No se necesita leer nada de localStorage — el token viaja solo en la cookie
        const res = await fetch('/api/me/permissions', {
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setRole(data.role);
            setCapabilities(data.capabilities);
          }
        } else if (res.status === 401) {
          // Token expirado — intentar refresh silencioso
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include'
          });
          if (refreshRes.ok) {
            // Volver a intentar obtener permisos con el nuevo token (en cookie)
            const retryRes = await fetch('/api/me/permissions', { credentials: 'include' });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              if (retryData.success) {
                setRole(retryData.role);
                setCapabilities(retryData.capabilities);
              }
            }
          }
          // Si el refresh falla, el usuario simplemente no tiene permisos (fail-closed correcto)
        }
      } catch (err) {
        console.error('Error fetching permissions context:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  const can = (capability: Capability): boolean => {
    if (loading) return false;
    return !!capabilities[capability];
  };

  return (
    <PermissionsContext.Provider value={{ role, capabilities, loading, can }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
