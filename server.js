#!/usr/bin/env node
/**
 * AI Nexus - Backend API Server (Express)
 * Serves the zhitongwang SPA and handles all API endpoints.
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexus-secret-' + require('crypto').randomBytes(16).toString('hex');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(DATA_DIR, 'uploads'))) fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

// ========== JSON file helpers ==========
function loadJSON(filename, fallback = {}) {
  const fp = path.join(DATA_DIR, filename);
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { return typeof fallback === 'function' ? fallback() : fallback; }
}
function saveJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
}

// ========== Middleware ==========
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, serveo-skip-browser-warning');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Maintenance mode detection (controlled by env var, defaults to off)
function isMaintenanceMode() {
  return process.env.MAINTENANCE_MODE === 'true';
}

// Maintenance middleware - must be before static/SPA routes
app.use((req, res, next) => {
  if (!isMaintenanceMode()) return next();
  // API requests get 503 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(503).json({ error: 'maintenance', message: 'System is under maintenance' });
  }
  // Serve maintenance page for all other requests
  const maintPath = path.join(__dirname, 'public', 'maintenance.html');
  if (fs.existsSync(maintPath)) {
    return res.sendFile(maintPath);
  }
  // Fallback inline maintenance
  res.status(503).type('html').send('<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maintenance</title><style>body{background:#0a0a0f;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;text-align:center}</style></head><body><div><h1 style="background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">' + encodeURIComponent('系统升级维护中') + '</h1><p style="color:#9ca3af">' + encodeURIComponent('请稍后再来') + '</p></div></body></html>');
});

// API to toggle maintenance (admin only)
app.get('/api/maintenance/status', (req, res) => {
  res.json({ maintenance: isMaintenanceMode() });
});
app.post('/api/maintenance/toggle', requireAuth, (req, res) => {
  const { enable } = req.body;
  const flagFile = path.join(DATA_DIR, '.maintenance');
  if (enable) {
    fs.writeFileSync(flagFile, new Date().toISOString(), 'utf8');
  } else {
    try { fs.unlinkSync(flagFile); } catch (e) {}
  }
  res.json({ maintenance: enable });
});

// Auth middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// File upload setup
const upload = multer({
  dest: path.join(DATA_DIR, 'uploads'),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB for video support
});

// ========== Data stores ==========
function getUsers() { return loadJSON('users.json', {}); }
function saveUsers(data) { saveJSON('users.json', data); }
function getFriends() { return loadJSON('friends.json', {}); }
function saveFriends(data) { saveJSON('friends.json', data); }
function getFriendRequests() { return loadJSON('friend_requests.json', []); }
function saveFriendRequests(data) { saveJSON('friend_requests.json', data); }
function getMessages() { return loadJSON('messages.json', {}); }
function saveMessages(data) { saveJSON('messages.json', data); }
function getP2PListings() { return loadJSON('p2p_listings.json', []); }
function saveP2PListings(data) { saveJSON('p2p_listings.json', data); }
function getTools() { return loadJSON('tools.json', []); }
function saveTools(data) { saveJSON('tools.json', data); }
function getEvents() { return loadJSON('events.json', []); }
function saveEvents(data) { saveJSON('events.json', data); }

// ========== AUTH ==========
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const users = getUsers();
  if (users[email]) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  users[email] = {
    name: name || email.split('@')[0],
    email,
    password: hash,
    balance: 1000,
    nexus: 1000,
    wallet: '',
    bio: '',
    avatar: '',
    sig_image: '',
    sig_video: '',
    created_at: now,
    updated_at: now
  };
  saveUsers(users);

  const token = jwt.sign({ email, name: users[email].name }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { email, name: users[email].name, balance: 1000, nexus: 1000, wallet: '', bio: '', avatar: '', sig_image: '', sig_video: '' } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const users = getUsers();
  const user = users[email];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { email, name: user.name, balance: user.balance, nexus: user.nexus, wallet: user.wallet || '', bio: user.bio || '', avatar: user.avatar || '', sig_image: user.sig_image || '', sig_video: user.sig_video || '' } });
});

app.get('/api/auth/status', requireAuth, (req, res) => {
  const users = getUsers();
  const user = users[req.user.email];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ authenticated: true, email: req.user.email, name: user.name });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// ========== PROFILE ==========
app.post('/api/profile', requireAuth, (req, res) => {
  const { name, wallet, bio, avatar, sig_image, sig_video } = req.body;
  const users = getUsers();
  if (!users[req.user.email]) return res.status(404).json({ error: 'User not found' });

  if (name !== undefined) users[req.user.email].name = name;
  if (wallet !== undefined) users[req.user.email].wallet = wallet;
  if (bio !== undefined) users[req.user.email].bio = bio;
  if (avatar !== undefined) users[req.user.email].avatar = avatar;
  if (sig_image !== undefined) users[req.user.email].sig_image = sig_image; // comma-separated URLs for multi-image
  if (sig_video !== undefined) users[req.user.email].sig_video = sig_video;
  users[req.user.email].updated_at = new Date().toISOString();
  saveUsers(users);
  res.json({ success: true });
});

// ========== FILE UPLOAD ==========
// Helper: parse upload and move to public uploads folder
function handleUpload(req, res, subfolder) {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = path.extname(file.originalname);
  const filename = uuidv4() + ext;
  const destDir = path.join(DATA_DIR, 'uploads', subfolder);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, filename);
  fs.renameSync(file.path, destPath);

  const url = '/uploads/' + subfolder + '/' + filename;
  res.json({ path: url, url });
}

app.post('/api/upload/avatar', requireAuth, upload.single('file'), (req, res) => handleUpload(req, res, 'avatars'));
app.post('/api/upload/image', requireAuth, upload.single('file'), (req, res) => handleUpload(req, res, 'images'));
app.post('/api/upload/video', requireAuth, upload.single('file'), (req, res) => handleUpload(req, res, 'videos'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// ========== FRIENDS ==========
app.get('/api/friends', requireAuth, (req, res) => {
  const friends = getFriends();
  const myFriends = friends[req.user.email] || [];
  const users = getUsers();
  const result = myFriends.map(email => {
    const u = users[email] || {};
    return { email, name: u.name || email.split('@')[0], avatar: u.avatar || '', bio: u.bio || '', online: false };
  });
  res.json({ friends: result });
});

app.get('/api/friends/requests', requireAuth, (req, res) => {
  const allRequests = getFriendRequests();
  const myRequests = allRequests.filter(r => r.to_email === req.user.email && r.status === 'pending');
  const users = getUsers();
  const result = myRequests.map(r => {
    const u = users[r.from_email] || {};
    return { id: r.id, from_email: r.from_email, from_name: u.name || r.from_email.split('@')[0], created_at: r.created_at };
  });
  res.json({ requests: result });
});

app.post('/api/friends/request', requireAuth, (req, res) => {
  const { to_email } = req.body;
  if (!to_email) return res.status(400).json({ error: 'to_email required' });
  if (to_email === req.user.email) return res.status(400).json({ error: 'Cannot add yourself' });

  const users = getUsers();
  if (!users[to_email]) return res.status(404).json({ error: 'User not found' });

  // Check if already friends
  const friends = getFriends();
  if (friends[req.user.email] && friends[req.user.email].includes(to_email)) {
    return res.status(409).json({ error: 'Already friends' });
  }

  // Check existing pending request
  const allRequests = getFriendRequests();
  const existing = allRequests.find(r =>
    r.from_email === req.user.email && r.to_email === to_email && r.status === 'pending'
  );
  if (existing) return res.status(409).json({ error: 'Friend request already sent' });

  const newReq = {
    id: uuidv4(),
    from_email: req.user.email,
    to_email,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  allRequests.push(newReq);
  saveFriendRequests(allRequests);

  // Notify via WebSocket
  broadcastToUser(to_email, { type: 'friend_request', from_email: req.user.email, from_name: users[req.user.email]?.name || req.user.email.split('@')[0] });

  res.json({ success: true, request_id: newReq.id });
});

app.post('/api/friends/accept', requireAuth, (req, res) => {
  const { request_id } = req.body;
  if (!request_id) return res.status(400).json({ error: 'request_id required' });

  const allRequests = getFriendRequests();
  const idx = allRequests.findIndex(r => r.id === request_id && r.to_email === req.user.email && r.status === 'pending');
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });

  const request = allRequests[idx];
  request.status = 'accepted';
  allRequests[idx] = request;
  saveFriendRequests(allRequests);

  // Add to friends
  const friends = getFriends();
  if (!friends[req.user.email]) friends[req.user.email] = [];
  if (!friends[request.from_email]) friends[request.from_email] = [];
  if (!friends[req.user.email].includes(request.from_email)) friends[req.user.email].push(request.from_email);
  if (!friends[request.from_email].includes(req.user.email)) friends[request.from_email].push(req.user.email);
  saveFriends(friends);

  const users = getUsers();
  broadcastToUser(request.from_email, { type: 'request_accepted', from_email: req.user.email, from_name: users[req.user.email]?.name || req.user.email.split('@')[0] });

  res.json({ success: true });
});

app.post('/api/friends/reject', requireAuth, (req, res) => {
  const { request_id } = req.body;
  if (!request_id) return res.status(400).json({ error: 'request_id required' });

  const allRequests = getFriendRequests();
  const idx = allRequests.findIndex(r => r.id === request_id && r.to_email === req.user.email);
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });

  allRequests[idx].status = 'rejected';
  saveFriendRequests(allRequests);
  res.json({ success: true });
});

// ========== USERS ==========
app.get('/api/users/search', requireAuth, (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'email query param required' });

  const users = getUsers();
  const user = users[email];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Check if friends
  const friends = getFriends();
  const isFriend = (friends[req.user.email] || []).includes(email);

  // Check pending request
  const allRequests = getFriendRequests();
  const pending = allRequests.some(r =>
    ((r.from_email === req.user.email && r.to_email === email) || (r.from_email === email && r.to_email === req.user.email))
    && r.status === 'pending'
  );

  res.json({
    user: { email, name: user.name, bio: user.bio || '', avatar: user.avatar || '' },
    isFriend,
    pendingRequest: pending
  });
});

// ========== MESSAGES ==========
app.get('/api/messages/:email', requireAuth, (req, res) => {
  const otherEmail = req.params.email;
  const allMessages = getMessages();
  const key = [req.user.email, otherEmail].sort().join('|');
  const msgs = (allMessages[key] || []).slice(-100); // last 100 messages
  res.json({ messages: msgs });
});

app.post('/api/messages', requireAuth, (req, res) => {
  const { to_email, text } = req.body;
  if (!to_email || !text) return res.status(400).json({ error: 'to_email and text required' });

  const msg = {
    id: uuidv4(),
    from_email: req.user.email,
    to_email,
    text,
    created_at: new Date().toISOString()
  };

  const allMessages = getMessages();
  const key = [req.user.email, to_email].sort().join('|');
  if (!allMessages[key]) allMessages[key] = [];
  allMessages[key].push(msg);
  saveMessages(allMessages);

  // Notify via WebSocket
  broadcastToUser(to_email, { type: 'new_message', message: msg });

  res.json({ success: true, message: msg });
});

// ========== USER DATA ==========
app.get('/api/user/data', requireAuth, (req, res) => {
  const users = getUsers();
  const user = users[req.user.email];
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Load subscriptions
  const subs = loadJSON('subscriptions.json', {});
  const userSubs = subs[req.user.email] || [];

  res.json({
    user: {
      email: req.user.email,
      name: user.name,
      balance: user.balance,
      nexus: user.nexus,
      bio: user.bio || '',
      avatar: user.avatar || '',
      wallet: user.wallet || ''
    },
    subscriptions: userSubs,
    transactions: []
  });
});

// ========== TOOLS ==========
app.get('/api/user/tools', requireAuth, (req, res) => {
  const tools = getTools();
  const userTools = tools.filter(t => t.owner_email === req.user.email);
  res.json({ tools: userTools });
});

app.post('/api/user/tools', requireAuth, (req, res) => {
  const { name, icon, cat, desc, price, color } = req.body;
  if (!name || !cat) return res.status(400).json({ error: 'name and cat required' });

  const tools = getTools();
  const newTool = {
    id: uuidv4(),
    owner_email: req.user.email,
    name,
    icon: icon || '🛠️',
    cat: cat || 'Other',
    desc: desc || '',
    price: price || 0,
    color: color || '#8b5cf6',
    created_at: new Date().toISOString()
  };
  tools.push(newTool);
  saveTools(tools);
  res.json({ success: true, tool: newTool });
});

app.post('/api/tools/subscribe', requireAuth, (req, res) => {
  const { tool_id, tool_name, price } = req.body;
  if (!tool_id) return res.status(400).json({ error: 'tool_id required' });

  const subs = loadJSON('subscriptions.json', {});
  if (!subs[req.user.email]) subs[req.user.email] = [];
  subs[req.user.email].push({
    tool_id,
    tool_name: tool_name || '',
    price: price || 0,
    subscribed_at: new Date().toISOString()
  });
  saveJSON('subscriptions.json', subs);
  res.json({ success: true });
});

app.get('/api/tools/subscriptions', requireAuth, (req, res) => {
  const subs = loadJSON('subscriptions.json', {});
  const userSubs = subs[req.user.email] || [];
  res.json({ subscriptions: userSubs });
});

// ========== EVENTS ==========
app.get('/api/user/events', requireAuth, (req, res) => {
  const events = getEvents();
  const userEvents = events.filter(e => e.owner_email === req.user.email);
  res.json({ events: userEvents });
});

app.post('/api/user/events', requireAuth, (req, res) => {
  const { title, emoji, date, loc, desc, tokens, price, status } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const events = getEvents();
  const newEvent = {
    id: uuidv4(),
    owner_email: req.user.email,
    title,
    emoji: emoji || '📅',
    date: date || '',
    loc: loc || '',
    desc: desc || '',
    tokens: tokens || 0,
    price: price || 0,
    status: status || 'upcoming',
    attendees: 0,
    created_at: new Date().toISOString()
  };
  events.push(newEvent);
  saveEvents(events);
  res.json({ success: true, event: newEvent });
});

// ========== P2P ==========
app.get('/api/p2p/listings', (req, res) => {
  let listings = getP2PListings();
  // Seed 5 power-compute sample packages on first call
  if (!listings.find(l => l.id === 'pkg-mix-west-240')) {
    const seedPackages = [
      { id: 'pkg-mix-west-240', tool_id: 'pkg-mix-west-240', tool_name: '西部绿电 240M Token/兆瓦时', tool_icon: '⚡', tool_color: '#10b981', price: 0.20, qty: 1000, dur: 365, sale_mode: 'token', power_source: 'mix', region: 'west', sla_tier: 'std', compute_unit: 'mtok', token_per_mwh: 240, owner_email: 'system@zhitongwang.cn', sold: 0, created_at: new Date().toISOString() },
      { id: 'pkg-wind-yrd-280', tool_id: 'pkg-wind-yrd-280', tool_name: '长三角风电 280M Token/兆瓦时', tool_icon: '🌬️', tool_color: '#3b82f6', price: 0.22, qty: 500, dur: 30, sale_mode: 'month', power_source: 'wind', region: 'yrd', sla_tier: 'ent', compute_unit: 'mtok', token_per_mwh: 280, owner_email: 'system@zhitongwang.cn', sold: 0, created_at: new Date().toISOString() },
      { id: 'pkg-solar-prd-200', tool_id: 'pkg-solar-prd-200', tool_name: '珠三角光伏 200M Token/兆瓦时', tool_icon: '☀️', tool_color: '#f59e0b', price: 0.18, qty: 800, dur: 365, sale_mode: 'token', power_source: 'solar', region: 'prd', sla_tier: 'std', compute_unit: 'mtok', token_per_mwh: 200, owner_email: 'system@zhitongwang.cn', sold: 0, created_at: new Date().toISOString() },
      { id: 'pkg-coal-west-360', tool_id: 'pkg-coal-west-360', tool_name: '火电基荷 360M Token/兆瓦时', tool_icon: '💡', tool_color: '#ef4444', price: 0.16, qty: 300, dur: 365, sale_mode: 'year', power_source: 'coal', region: 'west', sla_tier: 'crit', compute_unit: 'mtok', token_per_mwh: 360, owner_email: 'system@zhitongwang.cn', sold: 0, created_at: new Date().toISOString() },
      { id: 'pkg-gpu-overseas-8xh100', tool_id: 'pkg-gpu-overseas-8xh100', tool_name: '海外 H100 集群 8卡-小时', tool_icon: '🖥️', tool_color: '#8b5cf6', price: 32.0, qty: 200, dur: 7, sale_mode: 'gpu', power_source: 'mix', region: 'overseas', sla_tier: 'crit', compute_unit: 'gpu', token_per_mwh: 0, owner_email: 'system@zhitongwang.cn', sold: 0, created_at: new Date().toISOString() }
    ];
    listings = seedPackages.concat(listings);
    saveP2PListings(listings);
  }
  res.json({ listings });
});

app.post('/api/p2p/listings', requireAuth, (req, res) => {
  const {
    tool_id, tool_name, tool_icon, tool_color,
    price, qty, dur,
    sale_mode, power_source, region, sla_tier, compute_unit, token_per_mwh
  } = req.body;
  if (!tool_id || !price || !qty) return res.status(400).json({ error: 'tool_id, price, qty required' });

  // 验证电算协同字段
  const validModes = ['token', 'month', 'year', 'gpu'];
  const validSources = ['coal', 'wind', 'solar', 'hydro', 'mix'];
  const validRegions = ['west', 'yrd', 'prd', 'overseas'];
  const validSla = ['std', 'ent', 'crit'];
  const validUnit = ['mwh', 'gpu', 'mtok'];

  const mode = validModes.includes(sale_mode) ? sale_mode : 'token';
  const psrc = validSources.includes(power_source) ? power_source : 'mix';
  const reg  = validRegions.includes(region) ? region : 'west';
  const sla  = validSla.includes(sla_tier) ? sla_tier : 'std';
  const unit = validUnit.includes(compute_unit) ? compute_unit : 'mtok';
  const cvt  = Math.max(0, Number(token_per_mwh) || 240);

  const listings = getP2PListings();
  const newListing = {
    id: uuidv4(),
    owner_email: req.user.email,
    toolId: tool_id,
    toolName: tool_name || tool_id,
    toolIcon: tool_icon || '🛠️',
    toolColor: tool_color || '#8b5cf6',
    price: Number(price),
    qty: Number(qty),
    dur: Number(dur) || 30,
    sale_mode: mode,
    power_source: psrc,
    region: reg,
    sla_tier: sla,
    compute_unit: unit,
    token_per_mwh: cvt,
    sold: 0,
    created_at: new Date().toISOString()
  };
  listings.push(newListing);
  saveP2PListings(listings);
  res.json({ success: true, listing: newListing });
});

app.delete('/api/p2p/listings/:id', requireAuth, (req, res) => {
  let listings = getP2PListings();
  const idx = listings.findIndex(l => l.id === req.params.id && l.owner_email === req.user.email);
  if (idx === -1) return res.status(404).json({ error: 'Listing not found or not owned' });
  listings.splice(idx, 1);
  saveP2PListings(listings);
  res.json({ success: true });
});

app.post('/api/p2p/listings/:id/buy', requireAuth, (req, res) => {
  let listings = getP2PListings();
  const listing = listings.find(l => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.qty <= 0) return res.status(400).json({ error: 'Out of stock' });
  if (listing.owner_email === req.user.email) return res.status(400).json({ error: 'Cannot buy your own listing' });

  listing.qty -= 1;
  listing.sold = (listing.sold || 0) + 1;
  saveP2PListings(listings);
  res.json({ success: true });
});

// ========== UTILS ==========
app.get('/api/lhr-url', (req, res) => {
  res.json({ url: null });
});

// ========== Static files (SPA) ==========
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  // Don't serve HTML for API routes
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== WebSocket ==========
const wss = new WebSocketServer({ server });
const wsClients = {}; // email -> Set<WebSocket>

wss.on('connection', (ws) => {
  let userEmail = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'auth' && msg.token) {
        try {
          const decoded = jwt.verify(msg.token, JWT_SECRET);
          userEmail = decoded.email;
          if (!wsClients[userEmail]) wsClients[userEmail] = new Set();
          wsClients[userEmail].add(ws);
          ws.send(JSON.stringify({ type: 'auth_ok', email: userEmail }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    if (userEmail && wsClients[userEmail]) {
      wsClients[userEmail].delete(ws);
      if (wsClients[userEmail].size === 0) delete wsClients[userEmail];
    }
  });
});

function broadcastToUser(email, message) {
  if (wsClients[email]) {
    const data = JSON.stringify(message);
    wsClients[email].forEach(ws => {
      try { ws.send(data); } catch (e) {}
    });
  }
}

// ========== Start ==========
server.listen(PORT, () => {
  console.log(`AI Nexus Backend running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
