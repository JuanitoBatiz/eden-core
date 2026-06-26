import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const LOYVERSE_TOKEN = process.env.LOYVERSE_ACCESS_TOKEN || '';
const LOYVERSE_API = 'https://api.loyverse.com/v1.0';

if (!LOYVERSE_TOKEN) {
  console.error('❌ Error: Faltan credenciales de Loyverse.');
  process.exit(1);
}

async function analyzeHistory() {
  console.log('⏳ Conectando al motor analítico de Loyverse (Descargando histórico de ventas)...\n');

  try {
    // Descargar hasta 4 páginas de recibos recientes (aprox 1000 transacciones o las que existan)
    const receipts: any[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 30);
    const minIso = minDate.toISOString();

    do {
      const url: string = cursor 
        ? `${LOYVERSE_API}/receipts?created_at_min=${encodeURIComponent(minIso)}&cursor=${cursor}&limit=250` 
        : `${LOYVERSE_API}/receipts?created_at_min=${encodeURIComponent(minIso)}&limit=250`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${LOYVERSE_TOKEN}` }
      });
      
      if (!res.ok) {
        throw new Error(`Loyverse API error (${res.status}): ${await res.text()}`);
      }

      const data = await res.json();
      if (data.receipts && data.receipts.length > 0) {
        receipts.push(...data.receipts);
      }
      cursor = data.cursor || null;
      pageCount++;
      // Limitar a 4 páginas (1000 tickets) para un análisis rápido e inmediato
    } while (cursor && pageCount < 4);

    if (receipts.length === 0) {
      console.log('⚠️ No se encontraron recibos/tickets de venta en esta cuenta. Parece una cuenta nueva o de pruebas recién creada.');
      return;
    }

    // Filtrar solo ventas válidas (no reembolsos ni recibos en borrador)
    const sales = receipts.filter(r => r.receipt_type === 'SALE' && !r.cancelled_at);

    let totalRevenue = 0;
    let minTicket = Infinity;
    let maxTicket = 0;
    const paymentMethods: Record<string, number> = {};
    const hourlySales: Record<number, number> = {};
    const dayOfWeekSales: Record<string, number> = {};
    const itemCounts: Record<string, { qty: number; revenue: number }> = {};

    const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    sales.forEach(sale => {
      const amount = sale.total_money || 0;
      totalRevenue += amount;
      if (amount < minTicket && amount > 0) minTicket = amount;
      if (amount > maxTicket) maxTicket = amount;

      // Fecha y hora
      if (sale.created_at) {
        const date = new Date(sale.created_at);
        const hour = date.getHours();
        const dayName = daysMap[date.getDay()];

        hourlySales[hour] = (hourlySales[hour] || 0) + 1;
        dayOfWeekSales[dayName] = (dayOfWeekSales[dayName] || 0) + amount;
      }

      // Formas de pago
      sale.payments?.forEach((p: any) => {
        const pName = p.name || p.payment_type_id || 'Efectivo';
        paymentMethods[pName] = (paymentMethods[pName] || 0) + (p.amount || 0);
      });

      // Artículos
      sale.line_items?.forEach((li: any) => {
        const name = li.item_name || 'Desconocido';
        const qty = li.quantity || 1;
        const rev = li.total_money || 0;

        if (!itemCounts[name]) itemCounts[name] = { qty: 0, revenue: 0 };
        itemCounts[name].qty += qty;
        itemCounts[name].revenue += rev;
      });
    });

    const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0;

    // Sort top items
    const topByVolume = Object.entries(itemCounts)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);

    const topByRevenue = Object.entries(itemCounts)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);

    // Peak hour
    const peakHour = Object.entries(hourlySales).sort((a, b) => b[1] - a[1])[0];
    // Best day
    const bestDay = Object.entries(dayOfWeekSales).sort((a, b) => b[1] - a[1])[0];

    console.log('========================================================');
    console.log('📈 ANÁLISIS ESTADÍSTICO DESCRIPTIVO (LÍNEA BASE PRE-WEB)');
    console.log('========================================================\n');
    console.log(`🎟️ MUESTRA ANALIZADA:    ${sales.length} transacciones de mostrador`);
    console.log(`💵 FACTURACIÓN TOTAL:    $${totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN\n`);

    console.log('--- INDICADORES DE TICKET (KPIs) ---');
    console.log(`🟡 TICKET PROMEDIO:      $${avgTicket.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`);
    console.log(`🟢 Ticket Máximo:        $${maxTicket.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`);
    console.log(`🔵 Ticket Mínimo:        $${(minTicket === Infinity ? 0 : minTicket).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN\n`);

    console.log('--- COMPORTAMIENTO TEMPORAL ---');
    if (peakHour) console.log(`⏰ Hora Pico de Compras: las ${peakHour[0]}:00 hrs (${peakHour[1]} tickets emitidos)`);
    if (bestDay) console.log(`📅 Día de Mayor Ingreso: ${bestDay[0]} ($${bestDay[1].toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN)\n`);

    console.log('--- TOP 5 PRODUCTOS MÁS VENDIDOS (POR VOLUMEN) ---');
    topByVolume.forEach(([name, stat], i) => {
      console.log(`  ${i+1}. "${name}": ${stat.qty} unidades vendidas ($${stat.revenue.toLocaleString('es-MX')} MXN)`);
    });

    console.log('\n--- TOP 5 PRODUCTOS QUE MÁS DINERO DEJAN (POR INGRESOS) ---');
    topByRevenue.forEach(([name, stat], i) => {
      console.log(`  ${i+1}. "${name}": $${stat.revenue.toLocaleString('es-MX')} MXN facturados (${stat.qty} uds)`);
    });

    console.log('\n--- PREFERENCIA DE PAGO DEL CLIENTE ---');
    Object.entries(paymentMethods).forEach(([method, amt]) => {
      const pct = totalRevenue > 0 ? ((amt / totalRevenue) * 100).toFixed(1) : '0';
      console.log(`  - ${method}: $${amt.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (${pct}%)`);
    });

    console.log('\n========================================================');

  } catch (err) {
    console.error('❌ Error en el análisis:', err);
  }
}

analyzeHistory();
