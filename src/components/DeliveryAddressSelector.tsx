'use client';

/**
 * DeliveryAddressSelector — Premium Edition
 * ==========================================
 * Experiencia de selección de dirección estilo Uber Eats / DiDi.
 *
 * CARACTERÍSTICAS:
 * - Mapa de pantalla completa como protagonista visual
 * - Estilo de mapa personalizado (dark/minimalista)
 * - Pin fijo al centro — el usuario arrastra el MAPA, no el pin
 * - Botón "Usar mi ubicación" con HTML5 Geolocation API
 * - Barra de búsqueda flotante con glassmorphism
 * - Bottom-sheet deslizante con detalles del pedido
 * - Direcciones guardadas en panel deslizable
 * - Animaciones suaves y micro-interacciones
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, LocateFixed, Search, Star, Trash2, X, ChevronUp, ChevronDown, Bike, CheckCircle2, AlertCircle, Loader2, History, Edit2, Bookmark } from 'lucide-react';
import { DeliveryQuote, SavedAddress } from '@/types/api-contracts';

declare global {
  interface Window {
    google?: any;
    initGoogleMaps?: () => void;
  }
}

interface DeliveryAddressSelectorProps {
  isAuthenticated: boolean;
  onAddressConfirmed: (params: {
    address: string;
    lat: number;
    lng: number;
    quote: DeliveryQuote;
  }) => void;
  onClear: () => void;
  confirmedAddress: string | null;
  confirmedQuote: DeliveryQuote | null;
}

// ── Google Maps Loader ─────────────────────────────────────────────────────────
let gmLoaded = false;
let gmLoading = false;
let gmCallbacks: (() => void)[] = [];

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(); return; }
    if (window.google?.maps) { gmLoaded = true; resolve(); return; }
    if (gmLoaded) { resolve(); return; }
    if (gmLoading) { gmCallbacks.push(resolve); return; }
    gmLoading = true;
    gmCallbacks.push(resolve);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es&region=MX`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gmLoaded = true;
      gmLoading = false;
      gmCallbacks.forEach(cb => cb());
      gmCallbacks = [];
    };
    document.head.appendChild(script);
  });
}

// Mapa con estilo premium claro integrado a la marca del restaurante
const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
];

const RESTAURANT = { lat: 19.6997, lng: -98.7628 };

// ── Animaciones CSS ────────────────────────────────────────────────────────────
const CSS_ANIMATIONS = `
@keyframes das-spin { to { transform: rotate(360deg); } }
@keyframes das-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.9); } }
@keyframes das-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes das-pinBounce { 0%, 100% { transform: translateX(-50%) translateY(-100%); } 40% { transform: translateX(-50%) translateY(-115%); } }
@keyframes das-ripple { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
@keyframes das-slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }
@keyframes das-shimmer { from { background-position: -400px 0; } to { background-position: 400px 0; } }
.das-spin { animation: das-spin 0.8s linear infinite; }
.das-pulse-loc { animation: das-pulse 1.2s ease-in-out infinite; }
.das-fadeUp { animation: das-fadeUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.das-pin-idle { animation: none; transition: transform 0.2s ease; }
.das-pin-dragging { transform: translateX(-50%) translateY(-130%) scale(1.15) !important; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5)); }
`;

export default function DeliveryAddressSelector({
  isAuthenticated,
  onAddressConfirmed,
  onClear,
  confirmedAddress,
  confirmedQuote,
}: DeliveryAddressSelectorProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const hasGoogleMaps = !!apiKey;

  // ── Estado ────────────────────────────────────────────────────────────────
  const [mapsReady, setMapsReady] = useState(false);
  const [addressLine, setAddressLine] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [wantToSave, setWantToSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [fallbackInput, setFallbackInput] = useState('');
  const [showHint, setShowHint] = useState(true);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Cargar CSS de animaciones ──────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('das-styles')) return;
    const style = document.createElement('style');
    style.id = 'das-styles';
    style.textContent = CSS_ANIMATIONS;
    document.head.appendChild(style);
  }, []);

  // ── Ocultar Hint después de 3.5 segundos ──
  useEffect(() => {
    if (mapsReady) {
      const timer = setTimeout(() => setShowHint(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [mapsReady]);

  // ── Cargar Google Maps ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasGoogleMaps) return;
    let mounted = true;
    loadGoogleMaps(apiKey).then(() => {
      if (mounted) setMapsReady(true);
    });
    return () => { mounted = false; };
  }, [apiKey, hasGoogleMaps]);

  // ── Geocodificación inversa (coords → texto) ───────────────────────────────
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]) {
        setAddressLine(results[0].formatted_address);
        setCoords({ lat, lng });
        setQuoteError('');
        setLocationError('');
      }
    });
  }, []);

  // ── Debounce para reverse geocode al mover el mapa ────────────────────────
  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => reverseGeocode(lat, lng), 400);
  }, [reverseGeocode]);

  // ── Inicializar Mapa ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !hasGoogleMaps || !mapDivRef.current || mapInitialized) return;
    setMapInitialized(true);

    const map = new window.google.maps.Map(mapDivRef.current, {
      center: RESTAURANT,
      zoom: 15,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      styles: MAP_STYLE,
    });
    mapRef.current = map;

    // Geocoder
    geocoderRef.current = new window.google.maps.Geocoder();

    // Marker de origen (restaurante)
    new window.google.maps.Marker({
      position: RESTAURANT,
      map,
      title: 'Edén',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#d4a35f',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2.5,
      },
    });

    // Eventos del mapa (drag)
    map.addListener('dragstart', () => setIsDragging(true));
    map.addListener('dragend', () => {
      setIsDragging(false);
      const center = map.getCenter();
      if (center) scheduleReverseGeocode(center.lat(), center.lng());
    });
    map.addListener('idle', () => {
      const center = map.getCenter();
      if (center) {
        const lat = center.lat();
        const lng = center.lng();
        setCoords({ lat, lng });
      }
    });

    // Autocomplete en el input flotante
    if (inputRef.current) {
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'mx' },
        fields: ['geometry', 'formatted_address', 'name'],
      });
      ac.bindTo('bounds', map);
      autocompleteRef.current = ac;
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name || '';
        setAddressLine(address);
        setCoords({ lat, lng });
        setQuoteError('');
        map.panTo({ lat, lng });
        map.setZoom(17);
        setShowSearchInput(false);
        setSearchFocused(false);
      });
    }
  }, [mapsReady, hasGoogleMaps, mapInitialized, scheduleReverseGeocode]);

  // ── Cargar direcciones guardadas ───────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/me/addresses', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setSavedAddresses(d.addresses ?? []); })
      .catch(console.error);
  }, [isAuthenticated]);

  // ── Geolocalización ────────────────────────────────────────────────────────
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización.');
      return;
    }
    setIsLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(17);
        }
        reverseGeocode(lat, lng);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Permiso de ubicación denegado. Actívalo en tu navegador.');
        } else {
          setLocationError('No se pudo obtener tu ubicación. Busca tu dirección manualmente.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // ── Seleccionar dirección guardada ─────────────────────────────────────────
  const handleSelectSaved = (addr: SavedAddress) => {
    setAddressLine(addr.address_text);
    setCoords({ lat: addr.lat, lng: addr.lng });
    setQuoteError('');
    setShowSaved(false);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: addr.lat, lng: addr.lng });
      mapRef.current.setZoom(17);
    }
  };

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    fetch(`/api/me/addresses/${id}`, { method: 'DELETE', credentials: 'include' })
      .then(() => setSavedAddresses(prev => prev.filter(a => a.id !== id)))
      .catch(console.error);
  };

  // ── Cotizar envío ──────────────────────────────────────────────────────────
  const handleQuote = async () => {
    const effectiveCoords = coords;
    const effectiveAddress = hasGoogleMaps ? addressLine : fallbackInput;

    if (!effectiveCoords && !effectiveAddress.trim()) {
      setQuoteError('Selecciona tu ubicación en el mapa o escribe tu dirección.');
      return;
    }

    let finalCoords = effectiveCoords;

    if (!finalCoords && effectiveAddress.trim() && hasGoogleMaps && mapsReady && geocoderRef.current) {
      try {
        finalCoords = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
          geocoderRef.current.geocode(
            { address: effectiveAddress + ', México', componentRestrictions: { country: 'mx' } },
            (results: any, status: string) => {
              if (status === 'OK' && results?.length > 0) {
                resolve({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
              } else reject(new Error(status));
            }
          );
        });
        setCoords(finalCoords);
        if (mapRef.current && finalCoords) {
          mapRef.current.panTo(finalCoords);
          mapRef.current.setZoom(17);
        }
      } catch {
        setQuoteError('No encontramos esa dirección. Intenta ser más específico.');
        return;
      }
    }

    const payload = finalCoords
      ? { lat: finalCoords.lat, lng: finalCoords.lng }
      : { address_text: effectiveAddress };

    setIsQuoting(true);
    setQuoteError('');

    try {
      const res = await fetch('/api/delivery/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: DeliveryQuote & { success: boolean } = await res.json();

      if (!res.ok) {
        setQuoteError((data as any).message || (data as any).error || 'Error al cotizar el envío.');
        return;
      }
      if (!data.in_range) {
        setQuoteError(data.message || 'Lo sentimos, por ahora no llegamos a esa ubicación.');
        return;
      }

      const finalLat = finalCoords?.lat ?? data.lat ?? 0;
      const finalLng = finalCoords?.lng ?? data.lng ?? 0;
      const finalAddress = (hasGoogleMaps ? addressLine : fallbackInput) || 'Ubicación seleccionada en el mapa';

      onAddressConfirmed({ address: finalAddress, lat: finalLat, lng: finalLng, quote: data });

      if (wantToSave && saveLabel.trim() && isAuthenticated) {
        setIsSaving(true);
        fetch('/api/me/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ label: saveLabel.trim(), address_text: hasGoogleMaps ? addressLine : fallbackInput, lat: finalLat, lng: finalLng, is_default: savedAddresses.length === 0 }),
        })
          .then(r => r.json())
          .then(d => { if (d.success) { setSavedAddresses(prev => [d.address, ...prev]); setWantToSave(false); setSaveLabel(''); } })
          .catch(console.error)
          .finally(() => setIsSaving(false));
      }
    } catch {
      setQuoteError('Error de red. Intenta de nuevo.');
    } finally {
      setIsQuoting(false);
    }
  };

  // ── Vista: Dirección ya confirmada (Extraída para reusar) ──
  const ConfirmedView = () => (
    <div className="das-fadeUp" style={{
      marginTop: 12,
      borderRadius: 16,
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
      padding: '16px',
      display: 'flex',
      gap: 12,
      alignItems: 'center',
    }}>
      <div style={{
        flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
        backgroundColor: 'rgba(212,163,95,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <MapPin size={22} color="#d4a35f" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#6b7a99', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Enviar a:</div>
        <div style={{ fontSize: '0.9rem', color: '#1B3B2B', fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>{confirmedAddress}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#d4a35f', fontWeight: 700, marginTop: 6 }}>
          <Bike size={14} />
          <span>${confirmedQuote?.fee} envío {confirmedQuote?.distance_km != null && `(${confirmedQuote.distance_km} km)`}</span>
        </div>
      </div>
      <button onClick={onClear} style={{
        background: '#f9f9f9', border: '1px solid #e5e7eb', cursor: 'pointer', color: '#1B3B2B', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', flexShrink: 0
      }} title="Cambiar dirección" type="button">
        <Edit2 size={16} />
      </button>
    </div>
  );

  // ── Vista Fallback (sin API key de Google) ─────────────────────────────────
  if (!hasGoogleMaps) {
    if (confirmedAddress && confirmedQuote?.in_range) return <ConfirmedView />;
    return (
      <div style={S.fallbackWrap}>
        <div style={S.fallbackTitle}>
          <MapPin size={16} color="#d4a35f" />
          <span>¿A dónde te lo llevamos?</span>
        </div>
        <input
          type="text"
          value={fallbackInput}
          onChange={e => setFallbackInput(e.target.value)}
          placeholder="Calle, número, colonia y referencias..."
          style={S.fallbackInput}
        />
        {quoteError && <div style={S.errorBox}><AlertCircle size={13} color="#f87171" /><span>{quoteError}</span></div>}
        <button onClick={handleQuote} disabled={isQuoting || !fallbackInput.trim()} style={{ ...S.quoteBtn, ...((!fallbackInput.trim() || isQuoting) ? S.quoteBtnDisabled : {}) }} type="button">
          {isQuoting ? <><Loader2 size={16} className="das-spin" /> Calculando...</> : <><Bike size={16} /> Calcular costo de envío</>}
        </button>
      </div>
    );
  }

  // ── Vista Principal: Mapa Premium ──────────────────────────────────────────
  const isConfirmed = confirmedAddress && confirmedQuote?.in_range;

  return (
    <div style={S.root}>
      {isConfirmed ? <ConfirmedView /> : null}

      {/* ── Contenedor del mapa (oculto si ya se confirmó) ── */}
      <div style={{ ...S.mapWrap, display: isConfirmed ? 'none' : 'block' }}>
        {/* Spinner de carga del mapa */}
        {!mapsReady && (
          <div style={S.mapLoading}>
            <Loader2 size={28} color="#1B3B2B" className="das-spin" />
            <span style={{ fontSize: '0.82rem', color: '#1B3B2B', marginTop: 8 }}>Cargando mapa...</span>
          </div>
        )}

        {/* Mapa de Google */}
        <div ref={mapDivRef} style={{ ...S.mapDiv, opacity: mapsReady ? 1 : 0 }} />

        {/* ── PIN FIJO CENTRAL ── */}
        {mapsReady && (
          <div style={{ ...S.pinWrap, ...(isDragging ? S.pinWrapDragging : {}) }}>
            {/* Sombra pulsante debajo del pin */}
            <div style={{ ...S.pinShadow, ...(isDragging ? S.pinShadowDragging : {}) }} />
            {/* SVG del Pin */}
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" style={{ filter: isDragging ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
              <path d="M20 0C8.954 0 0 8.954 0 20c0 14 20 30 20 30S40 34 40 20C40 8.954 31.046 0 20 0z" fill="#d4a35f" />
              <circle cx="20" cy="20" r="8" fill="white" />
              <circle cx="20" cy="20" r="5" fill="#d4a35f" />
            </svg>
          </div>
        )}

        {/* ── Barra de búsqueda flotante (top) ── */}
        {mapsReady && (
          <div style={S.searchBar}>
            {showSearchInput ? (
              <div style={S.searchInputWrap} className="das-fadeUp">
                <Search size={16} color="#6b7a99" style={{ flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  placeholder="Busca tu calle, colonia..."
                  style={S.searchInput}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                />
                <button onClick={() => setShowSearchInput(false)} style={S.searchClose} type="button">
                  <X size={16} color="#1B3B2B" />
                </button>
              </div>
            ) : (
              <div style={S.searchCollapsed} className="das-fadeUp">
                <button
                  type="button"
                  onClick={() => setShowSearchInput(true)}
                  style={S.searchCollapsedBtn}
                >
                  <Search size={15} color="#1B3B2B" />
                  <span style={{ flex: 1, textAlign: 'left', color: addressLine ? '#1B3B2B' : '#6b7a99', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {addressLine || 'Busca tu dirección...'}
                  </span>
                </button>
                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {isAuthenticated && savedAddresses.length > 0 && (
                    <button type="button" onClick={() => setShowSaved(v => !v)} style={S.actionBtn} title="Mis direcciones">
                      <History size={15} color="#1B3B2B" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Botón Ubicación Actual (bottom-right del mapa) ── */}
  {mapsReady && (
    <button
      type="button"
      onClick={handleLocateMe}
      style={{ ...S.locateBtn, ...(isLocating ? S.locateBtnActive : {}) }}
      title="Usar mi ubicación actual"
      disabled={isLocating}
    >
      {isLocating
        ? <><Loader2 size={18} color="#1B3B2B" className="das-spin" /><span style={S.locateBtnText}>Ubicando...</span></>
        : <><LocateFixed size={18} color="#1B3B2B" className={isLocating ? 'das-pulse-loc' : ''} /><span style={S.locateBtnText}>Mi ubicación</span></>
      }
    </button>
  )}

        {/* ── Overlay Inicial "Arrastra el mapa" ── */}
        {mapsReady && !addressLine && (
          <div style={{
            ...S.dragHintOverlay,
            opacity: showHint ? 1 : 0,
            visibility: showHint ? 'visible' : 'hidden',
          }}>
            <div style={S.dragHintText}>Arrastra el mapa</div>
            <div style={S.dragHintSubtext}>para elegir tu punto de entrega</div>
          </div>
        )}
      </div>

      {/* ── Panel de Direcciones Guardadas (Oculto si se confirmó) ── */}
      {!isConfirmed && showSaved && isAuthenticated && savedAddresses.length > 0 && (
        <div style={S.savedPanel} className="das-fadeUp">
          <div style={S.savedPanelHeader}>
            <History size={14} color="#1B3B2B" />
            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1B3B2B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Mis direcciones</span>
            <button type="button" onClick={() => setShowSaved(false)} style={S.searchClose}><X size={14} color="#1B3B2B" /></button>
          </div>
          {savedAddresses.map(addr => (
            <div
              key={addr.id}
              onClick={() => handleSelectSaved(addr)}
              style={S.savedItem}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectSaved(addr)}
            >
              <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', backgroundColor: addr.is_default ? 'rgba(212,163,95,0.15)' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {addr.is_default ? <Star size={14} color="#d4a35f" fill="#d4a35f" /> : <MapPin size={14} color="#6b7a99" />}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1B3B2B' }}>{addr.label}</div>
                <div style={{ fontSize: '0.74rem', color: '#6b7a99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr.address_text}</div>
              </div>
              <button onClick={(e) => handleDeleteSaved(addr.id, e)} style={{ ...S.searchClose, color: '#4a5568' }} type="button"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom Sheet: Confirmar Envío (Oculto si se confirmó) ── */}
      {!isConfirmed && mapsReady && (
        <div style={S.bottomSheet} className="das-fadeUp">
          {/* Línea de la dirección detectada */}
          <div style={S.bottomAddressRow}>
            <div style={S.bottomPinDot} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {isDragging ? (
                <div style={{ fontSize: '0.82rem', color: '#6b7a99' }}>Ajustando ubicación...</div>
              ) : addressLine ? (
                <div style={{ fontSize: '0.85rem', color: '#1B3B2B', fontWeight: 600, lineHeight: 1.3 }}>{addressLine}</div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: '#6b7a99', fontStyle: 'italic' }}>Mueve el mapa para seleccionar tu punto de entrega</div>
              )}
            </div>
          </div>

          {/* Error de geolocalización */}
          {locationError && (
            <div style={S.errorBox}><AlertCircle size={13} color="#f87171" /><span>{locationError}</span></div>
          )}

          {/* Error de cotización */}
          {quoteError && (
            <div style={S.errorBox}><AlertCircle size={13} color="#f87171" /><span>{quoteError}</span></div>
          )}

          {/* Opción de guardar dirección */}
          {isAuthenticated && addressLine && (
            <div style={{ marginBottom: wantToSave ? 12 : 16 }}>
              <div
                onClick={() => setWantToSave(!wantToSave)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: wantToSave ? 'rgba(212,163,95,0.06)' : '#f9fafb',
                  border: `1px solid ${wantToSave ? 'rgba(212,163,95,0.3)' : '#e5e7eb'}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: wantToSave ? 8 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bookmark size={16} color={wantToSave ? '#d4a35f' : '#6b7a99'} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: wantToSave ? '#1B3B2B' : '#4b5563' }}>Guardar esta dirección</span>
                </div>
                {/* Toggle Switch */}
                <div style={{
                  width: 36, height: 20, borderRadius: 10,
                  backgroundColor: wantToSave ? '#d4a35f' : '#d1d5db',
                  position: 'relative', transition: 'background-color 0.2s'
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff',
                    position: 'absolute', top: 2, left: wantToSave ? 18 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
              
              {wantToSave && (
                <div className="das-fadeUp">
                  <input
                    type="text"
                    value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)}
                    placeholder='Nombre (Ej: "Casa", "Oficina")'
                    maxLength={30}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #d4a35f',
                      borderRadius: 10,
                      color: '#1B3B2B',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxShadow: '0 0 0 3px rgba(212,163,95,0.1)',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Botón principal de cotizar */}
          <button
            onClick={handleQuote}
            disabled={isQuoting || (!addressLine && !coords)}
            style={{ ...S.quoteBtn, ...((!addressLine && !coords) || isQuoting ? S.quoteBtnDisabled : {}) }}
            type="button"
          >
            {isQuoting
              ? <><Loader2 size={18} className="das-spin" /> Calculando precio de envío...</>
              : <><Bike size={18} /> Confirmar dirección y ver costo</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  // ── Root ──
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    overscrollBehavior: 'contain', // Previene el scroll del body
  },

  // ── Mapa ──
  mapWrap: {
    position: 'relative',
    height: 380,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
    touchAction: 'pan-x pan-y', // Ayuda al mapa en móviles
  },
  mapDiv: {
    width: '100%',
    height: '100%',
    transition: 'opacity 0.5s ease',
  },
  mapLoading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    zIndex: 10,
  },

  // ── Pin Central ──
  pinWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translateX(-50%) translateY(-100%)',
    zIndex: 5,
    pointerEvents: 'none',
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  pinWrapDragging: {
    transform: 'translateX(-50%) translateY(-120%) scale(1.1)',
  },
  pinShadow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 16,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    filter: 'blur(3px)',
    transition: 'all 0.2s ease',
  },
  pinShadowDragging: {
    width: 10,
    height: 4,
    opacity: 0.3,
    bottom: -12,
  },

  // ── Barra de búsqueda flotante ──
  searchBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  searchCollapsed: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 14,
    padding: '10px 14px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
  },
  searchCollapsedBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    minWidth: 0,
    padding: 0,
  },
  searchInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: '10px 14px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    border: '1px solid #d4a35f',
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: '#1B3B2B',
    fontSize: '0.9rem',
    minWidth: 0,
  },
  searchClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7a99',
    display: 'flex',
    alignItems: 'center',
    padding: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },

  // ── Botón de ubicación ──
  locateBtn: {
    position: 'absolute',
    bottom: 16,
    right: 14,
    zIndex: 10,
    height: 44,
    padding: '0 16px',
    borderRadius: 22,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  locateBtnText: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#1B3B2B',
  },
  locateBtnActive: {
    border: '1px solid #1B3B2B',
    backgroundColor: '#f3f4f6',
  },

  // ── Overlay Inicial de Arrastre ──
  dragHintOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)', // Capa muy ligera
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    zIndex: 20, // Por encima del mapa y del pin
    pointerEvents: 'none',
    transition: 'opacity 0.8s ease, visibility 0.8s ease',
  },
  dragHintText: {
    color: '#1B3B2B',
    fontWeight: 800,
    fontSize: '1.4rem',
    textAlign: 'center',
    textShadow: '0 2px 10px rgba(255,255,255,0.9)',
    letterSpacing: '0.5px',
  },
  dragHintSubtext: {
    color: '#1B3B2B',
    fontWeight: 600,
    fontSize: '0.95rem',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
    textShadow: '0 1px 6px rgba(255,255,255,0.8)',
  },

  // ── Panel de guardadas ──
  savedPanel: {
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    maxHeight: 220,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  savedPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px 8px',
  },
  savedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    borderTop: '1px solid #f3f4f6',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.15s ease',
  },

  // ── Bottom Sheet ──
  bottomSheet: {
    backgroundColor: '#ffffff',
    padding: '16px 16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    borderTop: '1px solid #e5e7eb',
    overscrollBehavior: 'contain',
  },
  bottomAddressRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  bottomPinDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#d4a35f',
    flexShrink: 0,
    marginTop: 5,
    boxShadow: '0 0 0 3px rgba(212,163,95,0.2)',
  },

  // ── Botón de cotizar ──
  quoteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '15px',
    background: 'linear-gradient(135deg, #d4a35f 0%, #c08840 100%)',
    color: '#1a1000',
    border: 'none',
    borderRadius: 14,
    fontWeight: 800,
    fontSize: '0.92rem',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 20px rgba(212,163,95,0.35)',
    letterSpacing: '0.2px',
    transition: 'all 0.2s ease',
  },
  quoteBtnDisabled: {
    background: '#f3f4f6',
    color: '#9ca3af',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },

  // ── Errores ──
  errorBox: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    padding: '10px 12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 10,
    fontSize: '0.8rem',
    color: '#ef4444',
    lineHeight: 1.4,
  },

  // ── Guardar dirección ──
  saveLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.8rem',
    color: '#4b5563',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 6,
  },
  saveLabelInput: {
    width: '100%',
    padding: '9px 12px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    color: '#1B3B2B',
    fontSize: '0.84rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  // ── Confirmado ──
  confirmedWrap: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    border: '1px solid #86efac',
  },
  confirmedInner: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: '14px 16px',
  },
  confirmedIcon: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    boxShadow: '0 2px 4px rgba(22,163,74,0.1)',
  },
  confirmedLabel: { fontWeight: 800, fontSize: '0.78rem', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 },
  confirmedAddress: { fontSize: '0.88rem', color: '#1B3B2B', lineHeight: 1.4, wordBreak: 'break-word' as const },
  confirmedChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: '4px 10px',
    fontSize: '0.78rem',
    color: '#16a34a',
    fontWeight: 600,
    marginTop: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  confirmedClear: {
    background: 'rgba(0,0,0,0.03)',
    border: '1px solid rgba(0,0,0,0.05)',
    cursor: 'pointer',
    color: '#6b7a99',
    padding: 8,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },

  // ── Fallback (sin Google Maps) ──
  fallbackWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '16px',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    border: '1px solid #e5e7eb',
    marginTop: 12,
  },
  fallbackTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 700,
    fontSize: '0.85rem',
    color: '#1B3B2B',
  },
  fallbackInput: {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: '#f9f9f9',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    color: '#1B3B2B',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
};
