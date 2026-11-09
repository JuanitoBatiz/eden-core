// Los productos en Supabase usan UUID como id. El menú de respaldo (src/lib/menuData.ts)
// usa slugs ("ensalada", "jugo-mixto"); esos ids NO existen en la base y no deben llegar a un pedido.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
