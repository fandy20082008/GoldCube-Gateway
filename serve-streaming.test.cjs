// Real TCP regression: node --test serve-streaming.test.cjs
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

let fixture, proxy, origin;
const active = new Map();
before(async () => {
  fixture = http.createServer((req, res) => {
    if (req.url.startsWith('/api/agent/runs/')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' });
      res.flushHeaders();
      active.set(req.url, res);
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 100);
      res.on('close', () => { clearInterval(heartbeat); active.delete(req.url); });
      res.write('event: run.snapshot\ndata: {"status":"running","url":"http://localhost:3300/_next/raw"}\n\n');
    } else if (req.url === '/api/drama/analyze') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(' ');
      const heartbeat = setInterval(() => res.write(' '), 10000);
      const complete = setTimeout(() => res.end('{"code":0,"data":{"ok":true}}'), 32000);
      res.on('close', () => { clearInterval(heartbeat); clearTimeout(complete); });
    } else if (req.url === '/api/plain') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ url: '/_next/asset.js' }));
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<html><head><title>VOZEB PRO</title></head><body><script src="/_next/asset.js"></script></body></html>');
    }
  });
  fixture.listen(0, '127.0.0.1');
  await once(fixture, 'listening');
  const reservation = http.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  proxy = spawn(process.execPath, [process.env.PROXY_SCRIPT || path.join(__dirname, 'serve.js')], {
    env: { ...process.env, PORT: String(port), GOLDCUBE_BACKEND_HOST: '127.0.0.1', GOLDCUBE_BACKEND_PORT: String(fixture.address().port) },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  await Promise.race([once(proxy.stdout, 'data'), once(proxy, 'exit').then(() => { throw new Error('Proxy exited before ready'); })]);
});
after(async () => {
  proxy?.kill();
  for (const res of active.values()) res.destroy();
  fixture?.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
});

function connect(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(origin + url, resolve);
    req.on('error', reject);
    req.setTimeout(1500, () => req.destroy(new Error('Proxy buffered the stream')));
  });
}
test('SSE snapshot and heartbeat arrive before completion, payload is unchanged, completion arrives live', { timeout: 5000 }, async () => {
  const response = await connect('/api/agent/runs/live/events');
  assert.equal(response.headers['x-accel-buffering'], 'no');
  let body = '';
  let completed = false;
  for await (const chunk of response) {
    body += chunk;
    if (!completed && body.includes(': heartbeat')) {
      completed = true;
      assert.ok(active.has('/api/agent/runs/live/events'), 'upstream must still be open');
      assert.match(body, /http:\/\/localhost:3300\/_next\/raw/);
      active.get('/api/agent/runs/live/events').end('event: run.completed\ndata: {"url":"result.png"}\n\n');
    }
  }
  assert.match(body, /event: run.completed/);
});
test('client disconnect releases upstream subscription', { timeout: 5000 }, async () => {
  const response = await connect('/api/agent/runs/disconnect/events');
  const upstream = active.get('/api/agent/runs/disconnect/events');
  const closed = once(upstream, 'close');
  response.destroy();
  await closed;
  assert.equal(active.has('/api/agent/runs/disconnect/events'), false);
});
test('upstream interruption closes SSE without appending invalid JSON', { timeout: 5000 }, async () => {
  const response = await connect('/api/agent/runs/interrupted/events');
  let body = '';
  response.on('data', chunk => { body += chunk; });
  const closed = once(response, 'close').catch(() => {});
  active.get('/api/agent/runs/interrupted/events').destroy();
  await closed;
  assert.doesNotMatch(body, /GoldCube 后端不可用/);
});
test('drama heartbeat crosses the 30 second idle limit before final valid JSON', { timeout: 35000 }, async () => {
  const started = Date.now();
  const response = await connect('/api/drama/analyze');
  response.req.setTimeout(0);
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk.toString());
  assert.equal(chunks[0], ' ');
  assert.equal(JSON.parse(chunks.join('')).data.ok, true);
  assert.ok(Date.now() - started >= 32000);
  assert.ok(chunks.length >= 4);
});
test('ordinary JSON asset rewrites remain unchanged', async () => {
  const response = await connect('/api/plain');
  let body = '';
  for await (const chunk of response) body += chunk;
  assert.equal(JSON.parse(body).url, '/goldcube-next/asset.js');
});
test('ordinary HTML branding and asset rewrites remain unchanged', async () => {
  const response = await connect('/create');
  let body = '';
  for await (const chunk of response) body += chunk;
  assert.match(body, /金立方 GoldCube/);
  assert.match(body, /goldcube-next\/asset.js/);
});
test('source-entry local homepage exposes public link and source/help routes reach the application', async () => {
  const homepage = await fetch(origin + '/');
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /<footer>[\s\S]*href="\/open-source">License &amp; Source<\/a>[\s\S]*<\/footer>/);
  for (const route of ['/open-source', '/open-source/', '/help']) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /goldcube-next\/asset.js/);
  }
});
