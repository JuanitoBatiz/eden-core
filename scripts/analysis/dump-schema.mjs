// SOLO LECTURA. Vuelca el esquema expuesto por PostgREST (OpenAPI), conteos de filas,
// valores distintos de columnas tipo "estado" y buckets de Storage.
// Solo hace peticiones GET/HEAD. No imprime ni guarda datos personales ni secretos.
// Uso: node scripts/analysis/dump-schema.mjs
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) throw new Error('Faltan variables de Supabase en .env.local');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const get = async (p, extra = {}) => {
  const r = await fetch(`${URL_}${p}`, { method: 'GET', headers: { ...H, ...extra } });
  return r;
};

const spec = await (await get('/rest/v1/', { Accept: 'application/openapi+json' })).json();
const tables = {};
for (const [name, def] of Object.entries(spec.definitions || {})) {
  tables[name] = { columns: Object.entries(def.properties || {}).map(([c, p]) => ({
    name: c, type: p.type, format: p.format, description: p.description || '',
    default: p.default, enum: p.enum, maxLength: p.maxLength,
    required: (def.required || []).includes(c),
  })) };
}
const rpcs = Object.keys(spec.paths || {}).filter(p => p.startsWith('/rpc/')).map(p => p.slice(5));

// Conteos exactos
for (const t of Object.keys(tables)) {
  const r = await get(`/rest/v1/${t}?select=*&limit=0`, { Prefer: 'count=exact', Range: '0-0' });
  const cr = r.headers.get('content-range') || '';
  tables[t].rows = r.ok ? Number(cr.split('/')[1]) : `error ${r.status}`;
}

// Valores distintos de columnas de bajo cardinalidad (solo columnas no personales)
const enumLike = /^(status|payment_status|refund_status|service_type|payment_method|role|active|type|kind|tier|reason|source|event|direction|order_type|delivery_status|is_.*|.*_status)$/;
for (const [t, info] of Object.entries(tables)) {
  if (typeof info.rows !== 'number' || info.rows === 0) continue;
  info.distinct = {};
  for (const c of info.columns.filter(c => enumLike.test(c.name))) {
    const vals = new Map();
    for (let from = 0; from < Math.min(info.rows, 20000); from += 1000) {
      const r = await get(`/rest/v1/${t}?select=${c.name}`, { Range: `${from}-${from + 999}` });
      if (!r.ok) break;
      for (const row of await r.json()) { const v = JSON.stringify(row[c.name]); vals.set(v, (vals.get(v) || 0) + 1); }
    }
    info.distinct[c.name] = Object.fromEntries([...vals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25));
  }
}

// Claves (nombres) del JSON orders.items: forma real de los items
let itemsShape = null;
{
  const r = await get('/rest/v1/orders?select=items&order=created_at.desc', { Range: '0-49' });
  if (r.ok) {
    const keys = new Map();
    for (const o of await r.json()) for (const it of (Array.isArray(o.items) ? o.items : [])) for (const k of Object.keys(it)) keys.set(k, (keys.get(k) || 0) + 1);
    itemsShape = Object.fromEntries(keys);
  }
}

// Cola Loyverse: antigüedad de pendientes
let queue = null;
{
  const r = await get('/rest/v1/loyverse_sync_queue?select=status,retry_count,created_at,next_retry_at&order=created_at.asc', { Range: '0-999' });
  if (r.ok) {
    const rows = await r.json(); const by = {};
    for (const q of rows) { by[q.status] = by[q.status] || { n: 0, oldest: q.created_at, newest: q.created_at }; by[q.status].n++; by[q.status].newest = q.created_at; }
    queue = by;
  } else queue = `error ${r.status}`;
}

// Storage
const bk = await get('/storage/v1/bucket');
const buckets = bk.ok ? (await bk.json()).map(b => ({ name: b.name, public: b.public, file_size_limit: b.file_size_limit, allowed_mime_types: b.allowed_mime_types })) : `error ${bk.status}`;

const out = { generated_at: new Date().toISOString(), tables, rpcs, itemsShape, queue, buckets };
const dir = path.join('docs', 'analysis', 'data'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'schema.json'), JSON.stringify(out, null, 2));
console.log('OK', Object.keys(tables).length, 'tablas/vistas,', rpcs.length, 'rpcs');
