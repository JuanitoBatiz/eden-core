const loyverseToken = '2d42d924c5f34c87b3a739869563c018';
const customerId = 'loyverse_cust_rtzhsinwp'; // Is this Juan Jesus's? Let's check DB.

async function test() {
  try {
    const res = await fetch(`https://api.loyverse.com/v1.0/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${loyverseToken}`
      }
    });
    const data = await res.json();
    console.log("Customer data from Loyverse:", data);
  } catch (e) {
    console.error(e);
  }
}
test();
