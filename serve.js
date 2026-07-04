// Railway-compatible server
const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'nexus_social.db');
const OUTPUT_DIR = path.join(__dirname, 'public');

// Init DB
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, nickname TEXT DEFAULT '', avatar_url TEXT DEFAULT '', bio TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS friend_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, from_email TEXT NOT NULL, to_email TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, friend_email TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')));
`);

const count = db.prepare('SELECT COUNT(*) as c FROM profiles').get();
if (count.c === 0) {
  db.prepare("INSERT INTO profiles (email, nickname, bio) VALUES ('demo@ai.com', 'Demo', 'Test user')").run();
}
db.close();

// Sync DB data into HTML
function syncData() {
  const db2 = new Database(DB_PATH);
  const p = db2.prepare('SELECT id, email, nickname, avatar_url, bio FROM profiles').all();
  const r = db2.prepare('SELECT id, from_email, to_email, status, created_at FROM friend_requests').all();
  const f = db2.prepare('SELECT id, user_email, friend_email, created_at FROM friends').all();
  const data = {profiles: p, friend_requests: r, friends: f, ts: Math.floor(Date.now()/1000)};
  const script = `window.__SYNC_DATA__ = ${JSON.stringify(data)};`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'surge-data.js'), script, 'utf-8');

  const indexPath = path.join(OUTPUT_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf-8');
    html = html.replace(
      /<script>window\.__SYNC_DATA__\s*=\s*\{[^]*?\}<\/script>/,
      `<script>${script}</script>`
    );
    fs.writeFileSync(indexPath, html, 'utf-8');
  }
  db2.close();
  console.log(`${new Date().toISOString()} Synced: ${p.length}P/${r.length}R/${f.length}F`);
}

// HTTP server
const server = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.resolve(OUTPUT_DIR, '.' + path.normalize('/' + urlPath.replace(/^\/+/, '')));
  if (!filePath.startsWith(OUTPUT_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    return res.end('Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  }[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on port ${PORT}`);
});

syncData();
setInterval(syncData, 10000);
