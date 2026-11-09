// A stand-in OAuth provider for scripts/evidence/P1.S2.sh: the standard code flow, synthetic identity, no real provider.
// Runs in the api image on the compose network: the browser reaches /authorize through the published port, the api
// reaches /token and /userinfo by the container name.
/* global process, console, URL -- Node globals */
import { createServer } from 'node:http';

const PORT = 4000;
const CODE = 'evidence-mock-code';
const ACCESS_TOKEN = 'evidence-mock-access-token';
const IDENTITY = {
  sub: 'evidence-subject-1',
  email: process.env.MOCK_EMAIL,
  email_verified: true,
  given_name: 'Oauth',
  family_name: 'Merchant',
};

function json(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/authorize') {
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.searchParams.set('code', CODE);
    back.searchParams.set('state', url.searchParams.get('state'));
    res.writeHead(302, { location: back.toString() });
    res.end();
  } else if (url.pathname === '/token' && req.method === 'POST') {
    req.resume();
    req.on('end', () => json(res, { access_token: ACCESS_TOKEN, token_type: 'bearer' }));
  } else if (url.pathname === '/userinfo') {
    if (req.headers.authorization === `Bearer ${ACCESS_TOKEN}`) json(res, IDENTITY);
    else json(res, { error: 'invalid_token' }, 401);
  } else {
    json(res, { error: 'not_found' }, 404);
  }
}).listen(PORT, () => console.log('oauth mock listening'));
