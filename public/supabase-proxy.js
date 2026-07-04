// Supabase Reverse Proxy for Chinese users
// Routes: /rest/* /auth/* /storage/* /realtime/*
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_HOST = 'ftucdwqmlzbmmbuiqsgo.supabase.co';
const PORT = 10124;
const CERT_DIR = __dirname + '/certs';

const options = {
  key: fs.readFileSync(CERT_DIR + '/key.pem'),
  cert: fs.readFileSync(CERT_DIR + '/cert.pem'),
};

function proxyRequest(clientReq, clientRes) {
  const opts = {
    hostname: SUPABASE_HOST,
    port: 443,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };
  delete opts.headers.host;
  delete opts.headers.origin;
  delete opts.headers.referer;
  opts.headers.host = SUPABASE_HOST;

  const proxyReq = https.request(opts, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    });
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (e) => {
    clientRes.writeHead(502);
    clientRes.end('Proxy Error: ' + e.message);
  });

  clientReq.pipe(proxyReq);
}

const server = https.createServer(options, proxyRequest);

server.on('upgrade', (clientReq, clientSocket, clientHead) => {
  // WebSocket proxy for Supabase Realtime
  const opts = {
    hostname: SUPABASE_HOST,
    port: 443,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };
  delete opts.headers.host;
  delete opts.headers.origin;
  opts.headers.host = SUPABASE_HOST;

  const proxyReq = https.request(opts);
  proxyReq.on('upgrade', (_, proxySocket, proxyHead) => {
    clientSocket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n\r\n'
    );
    proxySocket.pipe(clientSocket);
    clientSocket.pipe(proxySocket);
  });
  proxyReq.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Supabase proxy running on https://0.0.0.0:' + PORT);
});
