const url = 'http://localhost:3000/api/delivery/quote';

async function test(name, address) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address_text: address })
  });
  const data = await res.json();
  console.log(`\n--- Test: ${name} ---`);
  console.log(`Address: ${address}`);
  console.log('Result:', data);
}

async function run() {
  await test('Otumba Centro', 'Plaza de la Constitución, Otumba, Estado de México');
  await test('Empacadoras', 'Carretera Otumba a Axapusco, Estado de México');
  await test('Axapusco', 'Axapusco centro, Estado de Mexico');
  await test('Lejos', 'Teotihuacan centro, Estado de Mexico');
}

run();
