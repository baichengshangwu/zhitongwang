const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const DB_PATH = '/home/marvis/nexus_social.db';
const PORT = 3000;

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, nickname TEXT DEFAULT '', avatar_url TEXT DEFAULT '', bio TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS friend_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, from_email TEXT NOT NULL, to_email TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, friend_email TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')));
`);

const app = express();
app.use(cors());
app.use(express.json());

// --- Profiles ---
app.get('/api/profiles', (req, res) => {
  const rows = db.prepare('SELECT id, email, nickname, avatar_url, bio FROM profiles').all();
  res.json(rows);
});

app.get('/api/profiles/:email', (req, res) => {
  const row = db.prepare('SELECT id, email, nickname, avatar_url, bio FROM profiles WHERE email = ?').get(req.params.email);
  row ? res.json(row) : res.status(404).json({error: 'not found'});
});

app.post('/api/profiles', (req, res) => {
  const { email, nickname, avatar_url, bio } = req.body;
  if (!email) return res.status(400).json({error: 'email required'});
  try {
    const r = db.prepare('INSERT OR REPLACE INTO profiles (email, nickname, avatar_url, bio) VALUES (?, ?, ?, ?)').run(email, nickname||'', avatar_url||'', bio||'');
    res.json({id: r.lastInsertRowid, email, nickname, avatar_url, bio});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.patch('/api/profiles/:email', (req, res) => {
  const { nickname, avatar_url, bio } = req.body;
  const sets = [], vals = [];
  if (nickname !== undefined) { sets.push('nickname=?'); vals.push(nickname); }
  if (avatar_url !== undefined) { sets.push('avatar_url=?'); vals.push(avatar_url); }
  if (bio !== undefined) { sets.push('bio=?'); vals.push(bio); }
  if (!sets.length) return res.status(400).json({error: 'no fields'});
  vals.push(req.params.email);
  db.prepare(`UPDATE profiles SET ${sets.join(',')} WHERE email=?`).run(...vals);
  res.json(db.prepare('SELECT * FROM profiles WHERE email=?').get(req.params.email));
});

// --- Friend Requests ---
app.post('/api/friend-requests', (req, res) => {
  const { from_email, to_email } = req.body;
  if (!from_email || !to_email) return res.status(400).json({error: 'from_email and to_email required'});
  const r = db.prepare('INSERT INTO friend_requests (from_email, to_email) VALUES (?, ?)').run(from_email, to_email);
  res.json({id: r.lastInsertRowid, from_email, to_email, status: 'pending'});
});

app.get('/api/friend-requests/pending/:email', (req, res) => {
  const rows = db.prepare('SELECT * FROM friend_requests WHERE to_email = ? AND status = ?').all(req.params.email, 'pending');
  res.json(rows);
});

app.patch('/api/friend-requests/:id', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({error: 'status required'});
  db.prepare('UPDATE friend_requests SET status=? WHERE id=?').run(status, req.params.id);
  const fr = db.prepare('SELECT * FROM friend_requests WHERE id=?').get(req.params.id);
  if (status === 'accepted' && fr) {
    db.prepare('INSERT OR IGNORE INTO friends (user_email, friend_email) VALUES (?, ?)').run(fr.from_email, fr.to_email);
    db.prepare('INSERT OR IGNORE INTO friends (user_email, friend_email) VALUES (?, ?)').run(fr.to_email, fr.from_email);
  }
  res.json(fr);
});

// --- Friends ---
app.get('/api/friends/:email', (req, res) => {
  const rows = db.prepare('SELECT friend_email, created_at FROM friends WHERE user_email=?').all(req.params.email);
  res.json(rows);
});

// --- Search ---
app.get('/api/search', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare('SELECT email, nickname, avatar_url FROM profiles WHERE email LIKE ? OR nickname LIKE ? LIMIT 20').all(`%${q}%`, `%${q}%`);
  res.json(rows);
});

app.listen(PORT, () => console.log(`VPS API running on port ${PORT}`));
