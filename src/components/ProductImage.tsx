'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Utensils } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}

export default function ProductImage({ src, alt, className = '', priority = false }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Si la imagen ya está en caché del navegador o terminó de cargar, activarla al instante
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setIsLoaded(true);
      } else {
        setHasError(true);
      }
    }

    // Timeout de seguridad (2.2s): evita que un retraso de red o bloqueo del navegador deje el skeleton girando indefinidamente
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 2200);

    return () => clearTimeout(timer);
  }, [src]);

  if (!src || hasError) {
    return (
      <div 
        className={`${className} product-img-fallback`} 
        style={{ 
          backgroundColor: 'var(--color-cream-light, #FAF6F0)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--color-green-dark, #2C3E2D)',
          opacity: 0.6,
          width: '100%',
          height: '100%'
        }}
      >
        <Utensils size={36} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Shimmering Skeleton while image loads over network */}
      {!isLoaded && (
        <div 
          className="product-img-skeleton" 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #f0ede6 0%, #e5e0d5 50%, #f0ede6 100%)',
            backgroundSize: '200% 100%',
            animation: 'edenShimmerImage 1.4s infinite linear',
            zIndex: 1
          }}
        />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="eager"
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={`${className} product-img-reveal`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isLoaded ? 1 : 0.01,
          transform: isLoaded ? 'scale(1)' : 'scale(1.04)',
          transition: 'opacity 0.4s ease-out, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
          position: 'relative',
          zIndex: 2
        }}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
