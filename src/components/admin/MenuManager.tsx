'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus, AlertTriangle, Link as LinkIcon, RefreshCw, Save, X } from 'lucide-react';

export default function MenuManager({ accessToken }: { accessToken: string }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // States for expanding tree
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedProds, setExpandedProds] = useState<Record<string, boolean>>({});

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/menu', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories || []);
        setProducts(data.products || []);
      } else {
        setError(data.error || 'Error loading menu');
      }
    } catch (err) {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [accessToken]);

  const toggleCat = (id: string) => setExpandedCats(p => ({ ...p, [id]: !p[id] }));
  const toggleProd = (id: string) => setExpandedProds(p => ({ ...p, [id]: !p[id] }));

  // Generic Edit Modal/Form could be complex, I'll use simple prompts for MVP or inline editing
  const handleEditProduct = async (prod: any) => {
    const newName = prompt('Nuevo nombre del producto:', prod.name);
    if (newName === null) return;
    if (newName.trim() === '') return alert('El nombre no puede estar vacío');
    
    const newPriceStr = prompt('Nuevo precio base (ej. 100):', prod.base_price.toString());
    if (newPriceStr === null) return;
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice < 0) return alert('Precio inválido');

    try {
      const res = await fetch(`/api/admin/products/${prod.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: newName, base_price: newPrice })
      });
      if (res.ok) fetchMenu();
      else alert((await res.json()).error);
    } catch (e) {
      alert('Error de red');
    }
  };

  const handleDeleteProduct = async (prod: any) => {
    const isLinked = !!prod.loyverse_item_id;
    let msg = `¿Seguro que deseas eliminar el producto "${prod.name}"?\nEl producto dejará de mostrarse en la tienda, pero no se borrará del historial de órdenes pasadas.`;
    if (isLinked) {
      msg += `\n\n⚠️ ESTE PRODUCTO ESTÁ VINCULADO A LOYVERSE.\nLa eliminación local no lo borrará de tu inventario en Loyverse.`;
    }
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/admin/products/${prod.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) fetchMenu();
      else alert((await res.json()).error);
    } catch (e) {
      alert('Error de red');
    }
  };

  const handleToggleProductAvailability = async (prod: any) => {
    try {
      const res = await fetch(`/api/admin/products/${prod.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ available: !prod.available })
      });
      if (res.ok) fetchMenu();
      else alert((await res.json()).error);
    } catch (e) {
      alert('Error de red');
    }
  };

  if (loading) return <div>Cargando menú completo...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--color-green-dark)' }}>Gestor de Menú Local</h2>
        <div style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', gap: '15px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <LinkIcon size={14} color="#8b5cf6" /> Vinculado a Loyverse
          </span>
          <button onClick={fetchMenu} style={{ background: 'none', border: '1px solid #d1d5db', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}><RefreshCw size={14} /></button>
        </div>
      </div>
      
      <div style={{ padding: '10px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '20px' }}>
        <strong>Nota Arquitectónica:</strong> Cualquier cambio en precio, nombre o disponibilidad se refleja inmediatamente en el menú web (los 30 segundos de caché se invalidan automáticamente). <strong>La sincronización es unidireccional (Loyverse → Plataforma)</strong>, por lo tanto, cambios hechos aquí NO alteran el catálogo interno de tu App de Loyverse en la caja.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {categories.map(cat => {
          const catProducts = products.filter(p => p.category_id === cat.id);
          const isCatExpanded = expandedCats[cat.id];

          return (
            <div key={cat.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <div 
                onClick={() => toggleCat(cat.id)}
                style={{ backgroundColor: '#f9fafb', padding: '15px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 600 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isCatExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  {cat.name} {!cat.active && <span style={{ color: 'red', fontSize: '0.8rem' }}>(Inactiva)</span>}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  {catProducts.length} productos
                </div>
              </div>
              
              {isCatExpanded && (
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {catProducts.length === 0 ? (
                    <div style={{ padding: '10px', color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>Sin productos en esta categoría</div>
                  ) : (
                    catProducts.map(prod => {
                      const isProdExpanded = expandedProds[prod.id];
                      return (
                        <div key={prod.id} style={{ border: '1px solid #f3f4f6', borderRadius: '6px', marginLeft: '20px' }}>
                           <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: prod.available ? 'white' : '#fef2f2' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => toggleProd(prod.id)}>
                                {isProdExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span style={{ fontWeight: 500, textDecoration: !prod.available ? 'line-through' : 'none' }}>{prod.name}</span>
                                {prod.loyverse_item_id && <LinkIcon size={14} color="#8b5cf6" title="Sincronizado con Loyverse" />}
                                <span style={{ color: '#059669', fontSize: '0.9rem' }}>${prod.base_price}</span>
                             </div>
                             
                             <div style={{ display: 'flex', gap: '10px' }}>
                               <button onClick={() => handleToggleProductAvailability(prod)} style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer' }}>
                                 {prod.available ? 'Pausar' : 'Reactivar'}
                               </button>
                               <button onClick={() => handleEditProduct(prod)} style={{ color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={16} /></button>
                               <button onClick={() => handleDeleteProduct(prod)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                             </div>
                           </div>

                           {isProdExpanded && (
                             <div style={{ padding: '10px 10px 10px 30px', backgroundColor: '#f9fafb', fontSize: '0.85rem' }}>
                               <div style={{ marginBottom: '10px' }}>
                                 <strong style={{ color: '#4b5563' }}>Variantes de Tamaño:</strong>
                                 {prod.variants?.length === 0 ? <span style={{ color: '#9ca3af', marginLeft: '5px' }}>Ninguna</span> : (
                                   <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                                     {prod.variants?.map((v: any) => (
                                       <li key={v.id}>{v.name} - ${v.price}</li>
                                     ))}
                                   </ul>
                                 )}
                               </div>
                               <div>
                                 <strong style={{ color: '#4b5563' }}>Grupos Modificadores:</strong>
                                 {prod.modifier_groups?.length === 0 ? <span style={{ color: '#9ca3af', marginLeft: '5px' }}>Ninguno</span> : (
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '5px' }}>
                                     {prod.modifier_groups?.map((g: any) => (
                                       <div key={g.id} style={{ borderLeft: '2px solid #d1d5db', paddingLeft: '10px' }}>
                                         <strong>{g.name}</strong> (Mín: {g.min_selection}, Máx: {g.max_selection || '∞'}, Extra: ${g.extra_price})
                                         <div style={{ color: '#6b7280', marginTop: '2px' }}>
                                           Opciones: {g.modifiers?.map((m: any) => m.name).join(', ')}
                                         </div>
                                       </div>
                                     ))}
                                   </div>
                                 )}
                               </div>
                             </div>
                           )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}
