/**
 * Payment Server — 支付绑定 & 提现后端
 * 端口 3001，独立于主站 Express 后端运行
 * 部署: node payment-server.js
 * 建议配合 PM2: pm2 start payment-server.js --name payment-api
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DB_FILE = path.join(__dirname, 'payment-data.json');
const ZPAY_PID = '1735719561';
const ZPAY_KEY = 'abc021270Abaichengshangwu1234567';
const ZPAY_EXRATE = 7.25;

// ─── DB helpers ───────────────────────────────────────────
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) { console.error('DB load error:', e.message); }
  return { payment_methods: [], withdrawals: [] };
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// ─── Simple token verify (reuse same JWT secret as main backend) ──
const JWT_SECRET = process.env.JWT_SECRET || 'nexus-social-jwt-secret-2026';

function verifyTokenLocal(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const header = parts[0];
    const sig = crypto.createHmac('sha256', JWT_SECRET)
      .update(header + '.' + parts[1])
      .digest('base64url');
    if (sig !== parts[2]) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

async function verifyTokenViaBackend(token) {
  // Fallback: call main backend API to validate token
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 80,
      path: '/api/user/data',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 5000
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data && data.user) resolve({ email: data.user.email });
          else resolve(null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function verifyToken(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  // Try local verification first
  const local = verifyTokenLocal(token);
  if (local) return local;
  // Fallback: call main backend
  return await verifyTokenViaBackend(token);
}

// ─── ZPay helpers ─────────────────────────────────────────
function zpaySign(params) {
  const keys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] !== null)
    .sort();
  const str = keys.map(k => k + '=' + params[k]).join('&');
  return crypto.createHash('md5').update(str + ZPAY_KEY).digest('hex');
}

function zpayTransfer(account, accountName, amount, type) {
  // ZPay 转账到支付宝/微信
  // 文档: https://zpayz.cn/doc (transfer API)
  const params = {
    pid: ZPAY_PID,
    type: type, // 'alipay' or 'wxpay'
    account: account, // 支付宝账号或微信openid
    account_name: accountName,
    money: parseFloat(amount).toFixed(2),
    out_trade_no: 'ZPW' + Date.now() + Math.random().toString(36).substr(2, 6),
    sign_type: 'MD5'
  };
  params.sign = zpaySign(params);

  return new Promise((resolve, reject) => {
    const qs = Object.keys(params).map(k =>
      encodeURIComponent(k) + '=' + encodeURIComponent(params[k])
    ).join('&');

    const options = {
      hostname: 'zpayz.cn',
      port: 80,
      path: '/api/transfer.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(qs)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data);
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(qs);
    req.end();
  });
}

// ─── CORS ──────────────────────────────────────────────────
function corsHeaders(req) {
  const origin = req.headers['origin'] || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Router ────────────────────────────────────────────────
async function handleRequest(req, res) {
  const headers = corsHeaders(req);
  Object.assign(res, { setHeader: (k, v) => res.setHeader?.(k, v) });

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // Parse body for POST/PUT
  let body = '';
  if (req.method === 'POST' || req.method === 'PUT') {
    body = await new Promise(resolve => {
      let chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
  }

  // Auth middleware (skip for OPTIONS)
  let user = null;
  if (pathname !== '/health') {
    user = verifyToken(req);
    if (!user) {
      sendJSONWithHeaders(res, 401, { error: 'Unauthorized' }, headers);
      return;
    }
  }

  const db = loadDB();

  // ─── Health ────────────────────────────────────────────
  if (pathname === '/health' && req.method === 'GET') {
    sendJSONWithHeaders(res, 200, { status: 'ok', pid: ZPAY_PID }, headers);
    return;
  }

  // ─── Payment Methods CRUD ──────────────────────────────
  if (pathname === '/api/payment-methods') {
    if (req.method === 'GET') {
      const methods = db.payment_methods.filter(m => m.user_email === user.email);
      sendJSONWithHeaders(res, 200, { methods }, headers);
      return;
    }

    if (req.method === 'POST') {
      let pm = JSON.parse(body);
      pm.id = 'pm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      pm.user_email = user.email;
      pm.created_at = new Date().toISOString();
      db.payment_methods.push(pm);
      saveDB(db);
      sendJSONWithHeaders(res, 201, { method: pm }, headers);
      return;
    }
  }

  // PUT /api/payment-methods/:id
  const pmMatch = pathname.match(/^\/api\/payment-methods\/(.+)$/);
  if (pmMatch && req.method === 'PUT') {
    const id = pmMatch[1];
    const idx = db.payment_methods.findIndex(m => m.id === id && m.user_email === user.email);
    if (idx === -1) {
      sendJSONWithHeaders(res, 404, { error: 'Not found' }, headers);
      return;
    }
    const update = JSON.parse(body);
    db.payment_methods[idx] = { ...db.payment_methods[idx], ...update, id, user_email: user.email };
    saveDB(db);
    sendJSONWithHeaders(res, 200, { method: db.payment_methods[idx] }, headers);
    return;
  }

  if (pmMatch && req.method === 'DELETE') {
    const id = pmMatch[1];
    const before = db.payment_methods.length;
    db.payment_methods = db.payment_methods.filter(m => !(m.id === id && m.user_email === user.email));
    if (db.payment_methods.length === before) {
      sendJSONWithHeaders(res, 404, { error: 'Not found' }, headers);
      return;
    }
    saveDB(db);
    sendJSONWithHeaders(res, 200, { deleted: true }, headers);
    return;
  }

  // ─── Withdraw ──────────────────────────────────────────
  if (pathname === '/api/withdraw' && req.method === 'POST') {
    const { amount, payment_method_id } = JSON.parse(body);

    if (!amount || amount <= 0) {
      sendJSONWithHeaders(res, 400, { error: 'Invalid amount' }, headers);
      return;
    }
    if (amount < 10) {
      sendJSONWithHeaders(res, 400, { error: 'Minimum withdrawal is ¥10' }, headers);
      return;
    }

    const pm = db.payment_methods.find(m => m.id === payment_method_id && m.user_email === user.email);
    if (!pm) {
      sendJSONWithHeaders(res, 400, { error: 'Payment method not found' }, headers);
      return;
    }

    const withdrawal = {
      id: 'wdl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      user_email: user.email,
      amount: parseFloat(amount),
      payment_method: pm,
      status: 'pending', // pending | processing | completed | failed
      created_at: new Date().toISOString(),
      processed_at: null,
      remark: ''
    };

    db.withdrawals.push(withdrawal);
    saveDB(db);

    // Attempt ZPay transfer (async, don't block response)
    let account, accountName;
    if (pm.type === 'alipay') {
      account = pm.accountId;
      accountName = pm.accountName;
    } else if (pm.type === 'wechat') {
      account = pm.accountId;
      accountName = pm.accountName;
    } else if (pm.type === 'bank') {
      account = pm.cardNumber.replace(/\s/g, '');
      accountName = pm.cardholder;
    } else {
      withdrawal.status = 'failed';
      withdrawal.remark = 'Unsupported payment method type: ' + pm.type;
      saveDB(db);
      sendJSONWithHeaders(res, 400, { error: '仅支持支付宝/微信/银行卡提现' }, headers);
      return;
    }

    // Transfer via ZPay
    try {
      const result = await zpayTransfer(account, accountName, amount, pm.type === 'bank' ? 'bank' : pm.type);
      if (result && result.code === 1) {
        withdrawal.status = 'completed';
        withdrawal.processed_at = new Date().toISOString();
        withdrawal.remark = result.trade_no || 'Transfer successful';
      } else {
        withdrawal.status = 'failed';
        withdrawal.remark = (result && result.msg) || 'Transfer failed';
      }
    } catch (e) {
      withdrawal.status = 'failed';
      withdrawal.remark = e.message;
    }
    saveDB(db);

    sendJSONWithHeaders(res, 200, {
      withdrawal,
      message: withdrawal.status === 'completed'
        ? '提现申请已提交，预计2小时内到账'
        : '提现申请已记录，请等待审核处理'
    }, headers);
    return;
  }

  // ─── Withdrawal History ────────────────────────────────
  if (pathname === '/api/withdrawals' && req.method === 'GET') {
    const list = db.withdrawals
      .filter(w => w.user_email === user.email)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    sendJSONWithHeaders(res, 200, { withdrawals: list }, headers);
    return;
  }

  // 404
  sendJSONWithHeaders(res, 404, { error: 'Not found' }, headers);
}

function sendJSONWithHeaders(res, status, data, customHeaders) {
  const h = {
    'Content-Type': 'application/json',
    ...customHeaders
  };
  // Node.js native HTTP - set headers before writing
  res.writeHead(status, h);
  res.end(JSON.stringify(data));
}

// ─── Start Server ──────────────────────────────────────────
// Monkey-patch res to support writeHead before calling handleRequest
const server = http.createServer((req, res) => {
  // Collect response data
  const originalEnd = res.end.bind(res);
  const originalWriteHead = res.writeHead.bind(res);

  let _status = 200;
  let _headers = {};

  res.writeHead = function(status, headers) {
    _status = status;
    _headers = { ..._headers, ...headers };
    if (arguments.length === 1 && typeof status === 'number') {
      _status = status;
    }
    return res;
  };

  res.setHeader = function(k, v) {
    _headers[k] = v;
    return res;
  };

  res.end = function(data) {
    originalWriteHead(_status, _headers);
    originalEnd(data);
  };

  handleRequest(req, res).catch(err => {
    console.error('Server error:', err);
    try {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    } catch (_) {}
  });
});

server.listen(PORT, () => {
  console.log(`[Payment Server] Running on port ${PORT}`);
  console.log(`[Payment Server] ZPay PID: ${ZPAY_PID}`);
  console.log(`[Payment Server] DB: ${DB_FILE}`);
});
