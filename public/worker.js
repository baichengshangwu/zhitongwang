// Nexus Payment API Worker - Cloudflare Workers backend
// Handles all /api/* routes for user auth, trading, payments, P2P, agents

// --- In-memory storage (loses data on worker restart, migrate to D1 later) ---
let users = {};          // email -> { email, password, balance_cny, balance_nexus, createdAt }
let transactions = {};   // email -> [{ id, type, amount, currency, timestamp, status }]
let p2pListings = [];    // [{ id, seller_email, type, amount_nexus, price_cny, duration_hours, createdAt, status }]
let agents = {};         // email -> { email, paypal_txn_id, payment_amount, receipt_code, qr_data_url, status, approvedAt }
let agentPaypalConfigs = {}; // email -> [{ id, hosted_button_id, button_name, createdAt }]
let agentCommissions = {};   // email -> [{ id, amount_total, paypal_txn_id, timestamp }]
let marketOrders = [];       // [{ id, type, amount_nexus, price_cny, email, timestamp }]

let nextUserId = 0;
let nextTxnId = 0;
let nextListingId = 0;
let nextPaypalId = 0;
let nextCommissionId = 0;
let nextOrderId = 0;

function generateId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function error(msg, status = 400) {
  return json({ error: msg }, status);
}

// --- Router ---
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  try {
    // --- User endpoints ---
    if (path === '/api/user/register' && method === 'POST') {
      const { email, password } = await request.json();
      if (!email || !password) return error('Email and password required');
      if (users[email]) return error('User already exists');
      users[email] = {
        email, password,
        balance_cny: 0,
        balance_nexus: 0,
        createdAt: new Date().toISOString()
      };
      transactions[email] = [];
      return json({ success: true, email });
    }

    if (path === '/api/user/login' && method === 'POST') {
      const { email, password } = await request.json();
      const user = users[email];
      if (!user || user.password !== password) return error('Invalid credentials', 401);
      return json({ success: true, email, balance_cny: user.balance_cny, balance_nexus: user.balance_nexus });
    }

    if (path === '/api/user/balance' && method === 'GET') {
      const email = url.searchParams.get('email');
      if (!email) return error('Email required');
      const user = users[email];
      if (!user) return error('User not found', 404);
      return json({ balance_cny: user.balance_cny, balance_nexus: user.balance_nexus });
    }

    if (path === '/api/user/transactions' && method === 'GET') {
      const email = url.searchParams.get('email');
      if (!email) return error('Email required');
      return json({ transactions: transactions[email] || [] });
    }

    if (path === '/api/user/sync' && method === 'POST') {
      const { email, password, balance_cny, balance_nexus } = await request.json();
      if (!email) return error('Email required');
      if (!users[email]) {
        users[email] = { email, password: password || '', balance_cny: balance_cny || 0, balance_nexus: balance_nexus || 0, createdAt: new Date().toISOString() };
        transactions[email] = [];
      } else {
        if (balance_cny !== undefined) users[email].balance_cny = balance_cny;
        if (balance_nexus !== undefined) users[email].balance_nexus = balance_nexus;
      }
      return json({ success: true });
    }

    // --- Payment endpoints ---
    if (path === '/api/payment/deposit' && method === 'POST') {
      const { email, amount } = await request.json();
      if (!email || !amount) return error('Email and amount required');
      if (!users[email]) return error('User not found', 404);
      const orderId = generateId('DEP');
      return json({ success: true, orderId, amount_cny: amount });
    }

    if (path === '/api/payment/deposit/confirm' && method === 'POST') {
      const { orderId } = await request.json();
      // In production, verify with payment provider
      return json({ success: true, orderId, status: 'confirmed' });
    }

    if (path === '/api/payment/withdraw' && method === 'POST') {
      const { email, amount } = await request.json();
      if (!email || !amount) return error('Email and amount required');
      const user = users[email];
      if (!user) return error('User not found', 404);
      if (user.balance_cny < amount) return error('Insufficient balance');
      user.balance_cny -= amount;
      const txn = { id: generateId('TXN'), type: 'withdraw', amount, currency: 'CNY', timestamp: new Date().toISOString(), status: 'completed' };
      transactions[email].push(txn);
      return json({ success: true, transaction: txn });
    }

    // --- Trade endpoints ---
    if (path === '/api/trade/buy' && method === 'POST') {
      const { email, amount_nexus, price_cny } = await request.json();
      const user = users[email];
      if (!user) return error('User not found', 404);
      const total = amount_nexus * price_cny;
      if (user.balance_cny < total) return error('Insufficient CNY balance');
      user.balance_cny -= total;
      user.balance_nexus += amount_nexus;
      const order = { id: generateId('BUY'), type: 'buy', amount_nexus, price_cny, email, timestamp: new Date().toISOString() };
      marketOrders.push(order);
      const txn = { id: generateId('TXN'), type: 'buy', amount: amount_nexus, currency: 'NEXUS', price_cny, total_cny: total, timestamp: new Date().toISOString(), status: 'completed' };
      transactions[email].push(txn);
      return json({ success: true, order, balance_cny: user.balance_cny, balance_nexus: user.balance_nexus });
    }

    if (path === '/api/trade/sell' && method === 'POST') {
      const { email, amount_nexus, price_cny } = await request.json();
      const user = users[email];
      if (!user) return error('User not found', 404);
      if (user.balance_nexus < amount_nexus) return error('Insufficient NEXUS balance');
      user.balance_nexus -= amount_nexus;
      user.balance_cny += amount_nexus * price_cny;
      const order = { id: generateId('SELL'), type: 'sell', amount_nexus, price_cny, email, timestamp: new Date().toISOString() };
      marketOrders.push(order);
      const txn = { id: generateId('TXN'), type: 'sell', amount: amount_nexus, currency: 'NEXUS', price_cny, total_cny: amount_nexus * price_cny, timestamp: new Date().toISOString(), status: 'completed' };
      transactions[email].push(txn);
      return json({ success: true, order, balance_cny: user.balance_cny, balance_nexus: user.balance_nexus });
    }

    if (path === '/api/trade/market' && method === 'GET') {
      return json({ orders: marketOrders.slice(-50) });
    }

    // --- P2P endpoints ---
    if (path === '/api/trade/p2p/create' && method === 'POST') {
      const { email, type, amount_nexus, price_cny, duration_hours } = await request.json();
      if (!email || !type || !amount_nexus || !price_cny) return error('Missing required fields');
      if (!users[email]) return error('User not found', 404);
      const listing = {
        id: generateId('P2P'), seller_email: email, type,
        amount_nexus, price_cny, duration_hours: duration_hours || 24,
        createdAt: new Date().toISOString(), status: 'active'
      };
      if (type === 'sell') {
        if (users[email].balance_nexus < amount_nexus) return error('Insufficient NEXUS');
        users[email].balance_nexus -= amount_nexus;
      }
      p2pListings.push(listing);
      return json({ success: true, listing });
    }

    if (path === '/api/trade/p2p/listings' && method === 'GET') {
      return json({ listings: p2pListings.filter(l => l.status === 'active') });
    }

    if (path === '/api/trade/p2p/buy' && method === 'POST') {
      const { buyer_email, listing_id } = await request.json();
      const listing = p2pListings.find(l => l.id === listing_id);
      if (!listing) return error('Listing not found', 404);
      if (listing.status !== 'active') return error('Listing no longer active');
      const buyer = users[buyer_email];
      if (!buyer) return error('Buyer not found', 404);
      const total = listing.amount_nexus * listing.price_cny;
      if (buyer.balance_cny < total) return error('Insufficient CNY balance');
      buyer.balance_cny -= total;
      buyer.balance_nexus += listing.amount_nexus;
      users[listing.seller_email].balance_cny += total;
      listing.status = 'completed';
      return json({ success: true, listing, buyer_balance: { cny: buyer.balance_cny, nexus: buyer.balance_nexus } });
    }

    // --- Agent endpoints ---
    if (path === '/api/agent/register' && method === 'POST') {
      const { email, paypal_txn_id, payment_amount, receipt_code, qr_data_url } = await request.json();
      if (!email) return error('Email required');
      agents[email] = {
        email, paypal_txn_id, payment_amount, receipt_code, qr_data_url,
        status: 'pending', createdAt: new Date().toISOString()
      };
      return json({ success: true, agent: agents[email] });
    }

    if (path === '/api/agent/status' && method === 'GET') {
      const email = url.searchParams.get('email');
      const agent = agents[email];
      if (!agent) return json({ registered: false });
      return json({ registered: true, agent });
    }

    if (path === '/api/agent/paypal/bind' && method === 'POST') {
      const { email, hosted_button_id, button_name } = await request.json();
      if (!email) return error('Email required');
      const config = { id: generateId('PPC'), hosted_button_id, button_name, createdAt: new Date().toISOString() };
      if (!agentPaypalConfigs[email]) agentPaypalConfigs[email] = [];
      agentPaypalConfigs[email].push(config);
      return json({ success: true, config });
    }

    if (path.startsWith('/api/agent/paypal/') && method === 'PUT') {
      const parts = path.split('/');
      const configId = parts[parts.length - 1];
      const { email, hosted_button_id, button_name } = await request.json();
      const configs = agentPaypalConfigs[email] || [];
      const idx = configs.findIndex(c => c.id === configId);
      if (idx === -1) return error('Config not found', 404);
      configs[idx].hosted_button_id = hosted_button_id;
      configs[idx].button_name = button_name;
      return json({ success: true, config: configs[idx] });
    }

    if (path.startsWith('/api/agent/paypal/') && method === 'DELETE') {
      const parts = path.split('/');
      const configId = parts[parts.length - 2]; // /paypal/:id
      const email = url.searchParams.get('email');
      const configs = agentPaypalConfigs[email] || [];
      const idx = configs.findIndex(c => c.id === configId);
      if (idx === -1) return error('Config not found', 404);
      configs.splice(idx, 1);
      return json({ success: true });
    }

    if (path === '/api/agent/commission/record' && method === 'POST') {
      const { agent_email, amount_total, paypal_txn_id } = await request.json();
      const commission = {
        id: generateId('COM'), agent_email, amount_total, paypal_txn_id,
        timestamp: new Date().toISOString()
      };
      if (!agentCommissions[agent_email]) agentCommissions[agent_email] = [];
      agentCommissions[agent_email].push(commission);
      return json({ success: true, commission });
    }

    if (path === '/api/agent/earnings' && method === 'GET') {
      const email = url.searchParams.get('email');
      const commissions = agentCommissions[email] || [];
      const total = commissions.reduce((s, c) => s + (c.amount_total || 0), 0);
      return json({ commissions, total_earned: total });
    }

    if (path === '/api/agent/paypal/public' && method === 'GET') {
      const all = [];
      for (const [email, configs] of Object.entries(agentPaypalConfigs)) {
        for (const c of configs) all.push({ ...c, agent_email: email });
      }
      return json({ configs: all });
    }

    // --- 404 ---
    return error('Not found: ' + method + ' ' + path, 404);

  } catch (e) {
    return error('Server error: ' + e.message, 500);
  }
}

// --- Worker entry ---
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};
