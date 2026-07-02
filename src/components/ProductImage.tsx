'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Utensils } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export default function ProductImage({ src, alt, className = '' }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Si la imagen ya está en caché del navegador, activarla inmediatamente
    if (imgRef.current && imgRef.current.complete) {
      setIsLoaded(true);
    }
  }, [src]);

  if (!src || hasError) {
    return (
      <div 
        className={className} 
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
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`${className} product-img-reveal ${isLoaded ? 'is-img-loaded' : ''}`}
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
    />
  );
}
