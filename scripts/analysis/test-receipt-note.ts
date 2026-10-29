// Prueba la nota del recibo en MODO SIMULADO (sin variables LOYVERSE_* → no hay ninguna llamada de red).
delete process.env.LOYVERSE_ACCESS_TOKEN; delete process.env.LOYVERSE_STORE_ID; delete process.env.LOYVERSE_GENERIC_VARIANT_ID;
import { createLoyverseReceipt, isLoyverseConfigured } from '../../src/lib/loyverse';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const capture = async (notes: string, address = 'Calle 1') => {
  let note = '';
  const orig = console.log;
  console.log = (...a: unknown[]) => { const t = a.map(String).join(' '); const m = t.match(/"note": "((?:[^"\\]|\\.)*)"/); if (m) note = JSON.parse(`"${m[1]}"`); };
  await createLoyverseReceipt({ id: ID, customer_name: 'Cliente Prueba', customer_phone: '5500000000', items: [{ name: 'X', quantity: 1, price: 1 }], total: 1, notes, service_type: 'delivery', delivery_address: address, payment_method: 'efectivo', delivery_fee: 15, delivery_fee_confirmed: true });
  console.log = orig;
  return note;
};
let ok = true; const check = (n: string, c: boolean, e = '') => { if (!c) ok = false; console.log(`${c ? 'OK   ' : 'FALLA'} ${n} ${c ? '' : e}`); };

(async () => {
  check('modo simulado activo (sin red)', isLoyverseConfigured === false);
  let n = await capture('sin cebolla');
  check('nota corta lleva el id completo', n.includes(ID) && n.length <= 255, n);
  n = await capture('x'.repeat(600));
  check('nota larga: ≤255, conserva el id completo y recorta las notas libres', n.length <= 255 && n.includes(ID) && n.endsWith('...'), `len=${n.length}`);
  n = await capture('hola', 'D'.repeat(300));
  check('dirección enorme: ≤255 (el id puede perderse solo en este caso extremo)', n.length <= 255, `len=${n.length}`);
  console.log(ok ? '\nTodo OK' : '\nHAY FALLAS');
})();
