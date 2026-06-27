const { sign } = require('jsonwebtoken');
const http = require('http');

const token = sign({ user_id: '2162cedc-4e28-48a3-8829-49e863a349e5', phone: '5575084267', role: 'owner' }, 'rv0G8JGyZ2VSJMoT5E3hxi5TV/yKtK7FLfz/E/1GxJs=', { expiresIn: '15m' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/me/loyalty',
  method: 'GET',
  headers: {
    'Cookie': `access_token=${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});
req.on('error', e => console.error(e));
req.end();
