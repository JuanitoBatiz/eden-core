import React from 'react';
import { MARK_LETTERS, MARK_LEAF, MARK_VIEWBOX_FULL, MARK_VIEWBOX_LETTERS, MONSTERA } from './edenPaths';

/**
 * Logotipo vectorial de Edén (letras + hoja de lechuga en línea).
 * Los colores se controlan con CSS: `.ed-mark-l` (letras) y `.ed-mark-leaf` (hoja).
 */
export function EdenMark({
  leaf = true,
  className = '',
  title = 'Edén',
  animated = false,
}: {
  leaf?: boolean;
  className?: string;
  title?: string;
  animated?: boolean;
}) {
  return (
    <svg
      className={`ed-mark ${animated ? 'ed-mark--anim' : ''} ${className}`}
      viewBox={leaf ? MARK_VIEWBOX_FULL : MARK_VIEWBOX_LETTERS}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {leaf && (
        <g className="ed-mark-leaf">
          <path d={MARK_LEAF} />
        </g>
      )}
      {MARK_LETTERS.map((l, i) => (
        <g key={l.key} className="ed-mark-l" style={{ ['--i' as string]: i } as React.CSSProperties}>
          <path d={l.d} />
        </g>
      ))}
    </svg>
  );
}

/** Hoja de monstera (3 variantes) para decoración y sombras. */
export function Monstera({
  v = 0,
  className = '',
  style,
}: {
  v?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const leaf = MONSTERA[v % MONSTERA.length];
  return (
    <svg
      className={`ed-monstera ${className}`}
      style={style}
      viewBox={`0 0 ${leaf.w} ${leaf.h}`}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fillRule="evenodd" d={leaf.d} />
    </svg>
  );
}

/** Sombras de hojas difuminadas, como la luz que entra en los videos de menú. */
export function LeafShadows({ className = '' }: { className?: string }) {
  return (
    <div className={`ed-shadows ${className}`} aria-hidden="true">
      <Monstera v={0} className="ed-shadow s1" />
      <Monstera v={1} className="ed-shadow s2" />
      <Monstera v={2} className="ed-shadow s3" />
      <Monstera v={1} className="ed-shadow s4" />
    </div>
  );
}

/** Tagline oficial del logo. */
export function Tagline({ className = '' }: { className?: string }) {
  return <span className={`ed-tagline ${className}`}>• Lo esencial es natural •</span>;
}

/** Imagen recortada (sin fondo) si existe para la foto del producto. */
const CUTOUTS = new Set([
  'bowl_avena', 'ciabatta', 'coctel', 'ensalada', 'hotcakes', 'infusion', 'jugo_mixto', 'jugo_natural',
  'rafaello', 'rollito3', 'sandwich', 'smoothie_clasico', 'smoothie_deluxe', 'torta', 'yogurt',
]);

export function cutoutFor(src?: string | null): string | null {
  if (!src) return null;
  const m = src.match(/\/([a-z0-9_]+)\.(webp|png|jpe?g)(\?.*)?$/i);
  if (!m) return null;
  const base = m[1].toLowerCase();
  return CUTOUTS.has(base) ? `/images/cut/${base}.webp` : null;
}
