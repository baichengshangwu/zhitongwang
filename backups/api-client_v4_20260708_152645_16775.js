// Nexus Social - Express Backend API Client
const API_BASE = '';
var apiToken = null;
// Restore token from localStorage on page load
(function(){ try{ let t=localStorage.getItem('nexus_api_token'); if(t) apiToken=t; }catch(e){} })();

function authHeaders() {
  return apiToken ? { 'Authorization': 'Bearer ' + apiToken } : {};
}

async function apiFetch(url, options) {
  options = options || {};
  options.headers = {
    'Content-Type': 'application/json',
    'serveo-skip-browser-warning': 'true',
    ...authHeaders(),
    ...options.headers
  };
  // 15s timeout with AbortController fallback
  var timedOut = false;
  var controller = null;
  var timer = null;
  try {
    if (typeof AbortController === 'function') {
      controller = new AbortController();
      timer = setTimeout(function() { timedOut = true; controller.abort(); }, 15000);
      options.signal = controller.signal;
    } else {
      timer = setTimeout(function() { timedOut = true; }, 15000);
    }
  } catch(_) {}
  try {
    var res = await fetch(url, options);
    clearTimeout(timer);
    if (timedOut) throw new Error('Request timeout — please try again');
    var text = await res.text();
    if (!text || text.trim() === '') throw new Error('Empty response from server — please try again');
    var data;
    try { data = JSON.parse(text); } catch(_) {
      throw new Error('Server returned invalid response (HTTP ' + res.status + ')');
    }
    if (!res.ok) { var e = new Error(data.error || 'Request failed (status ' + res.status + ')'); e.status = res.status; throw e; }
    return data;
  } catch(e) {
    clearTimeout(timer);
    if (timedOut) throw new Error('Request timeout — please try again');
    if (e.name === 'AbortError') throw new Error('Request timeout — please try again');
    throw e;
  }
}

// ========== API Object ==========
const API = {
  async register(name, email, password, retries) {
    retries = (retries === undefined) ? 2 : retries;
    var lastErr = null;
    for (var i = 0; i <= retries; i++) {
      try {
        if (i > 0) await new Promise(function(r) { setTimeout(r, 1000 * i); }); // backoff
        const data = await apiFetch(API_BASE + '/api/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });
        if (data.token) { apiToken = data.token; try{localStorage.setItem('nexus_api_token',apiToken);}catch(e){} }
        return data;
      } catch(e) {
        lastErr = e;
        if (e.status === 409) break; // don't retry 409
        if (i < retries) console.log('Register retry ' + (i+1) + '/' + retries + ': ' + e.message);
      }
    }
    throw lastErr || new Error('Registration failed');
  },
  async login(email, password) {
    const data = await apiFetch(API_BASE + '/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) { apiToken = data.token; try{localStorage.setItem('nexus_api_token',apiToken);}catch(e){} }
    return data;
  },
  async saveProfile(name, wallet, bio, avatar, sig_image, sig_video) {
    return await apiFetch(API_BASE + '/api/profile', {
      method: 'POST',
      body: JSON.stringify({ name, wallet, bio, avatar, sig_image, sig_video })
    });
  },

  // File upload helpers — use FormData (no JSON), with timeout
  _uploadWithTimeout(url, fd) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var done = false;
      var controller = null;
      try {
        if (typeof AbortController === 'function') {
          controller = new AbortController();
        }
      } catch(_) {}
      // 120s timeout — abort the fetch, not just reject
      var timer = setTimeout(function() {
        if (done) return;
        done = true;
        if (controller) { try { controller.abort(); } catch(_) {} }
        reject(new Error('Upload timeout — please try again'));
      }, 120000);
      // Pre-check: ensure auth token is available
      var hdrs = authHeaders();
      if (!hdrs.Authorization) {
        done = true;
        clearTimeout(timer);
        reject(new Error('Not logged in — please login first'));
        return;
      }
      fetch(url, { method: 'POST', headers: hdrs, body: fd, signal: controller ? controller.signal : undefined })
        .then(function(res) {
          clearTimeout(timer);
          if (done) return;
          done = true;
          // Non-JSON response (like 502 HTML) — bail early
          var ct = res.headers.get('content-type') || '';
          if (ct.indexOf('application/json') === -1) {
            if (res.status === 413) reject(new Error('File too large — max 50MB'));
            else if (res.status === 401) reject(new Error('Session expired — please login again'));
            else reject(new Error('Server error (HTTP ' + res.status + ') — please try again'));
            return;
          }
          return res.json().then(function(data) {
            if (!res.ok) throw new Error(data.error || 'Upload failed (status ' + res.status + ')');
            resolve(data);
          });
        })
        .catch(function(e) {
          clearTimeout(timer);
          if (done) return;
          done = true;
          // Map common errors to user-friendly messages
          if (e.name === 'AbortError') {
            reject(new Error('Upload cancelled — please try again'));
          } else if (e.message && e.message.indexOf('Failed to fetch') !== -1) {
            reject(new Error('Network error — server may be restarting, please try again'));
          } else if (e.message && e.message.indexOf('NetworkError') !== -1) {
            reject(new Error('Network error — server may be restarting, please try again'));
          } else {
            reject(e);
          }
        });
    });
  },
  // Get LHR tunnel URL for upload fallback
  async _getLhrUrl() {
    if (this._lhrUrl === undefined) {
      try {
        var r = await apiFetch(API_BASE + '/api/lhr-url');
        this._lhrUrl = r.url || null;
        this._lhrFetched = true;
      } catch(e) { this._lhrUrl = null; }
    }
    return this._lhrUrl;
  },
  // Compress image to target max size (KB), returns a Blob
  async _compressImage(file, maxKB, maxW) {
    return new Promise(function(resolve, reject) {
      if (!file.type.match(/^image\//)) { resolve(file); return; }
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function() {
        URL.revokeObjectURL(url);
        var w = img.width, h = img.height;
        if (maxW && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Binary search quality to fit maxKB
        var lo = 0.1, hi = 0.9, best = null;
        function tryQuality(q) {
          canvas.toBlob(function(blob) {
            if (!blob) { resolve(file); return; }
            if (blob.size <= maxKB * 1024 || hi - lo < 0.05) {
              resolve(blob.size < file.size ? blob : file);
            } else if (blob.size > maxKB * 1024) {
              hi = q; tryQuality((lo + hi) / 2);
            } else {
              lo = q; best = blob; tryQuality((lo + hi) / 2);
            }
          }, 'image/jpeg', q);
        }
        tryQuality(0.6);
      };
      img.onerror = function() { resolve(file); };
      img.src = url;
    });
  },
  // Upload with LHR fallback for 502 errors
  async _uploadWithFallback(url, fd, isImage) {
    var self = this;
    try {
      return await this._uploadWithTimeout(url, fd);
    } catch(e) {
      // If 502 from serveo, retry via LHR
      if (e.message && e.message.indexOf('HTTP 502') !== -1) {
        var lhr = await self._getLhrUrl();
        if (lhr) {
          // Rebuild FormData (it's consumed)
          var fd2 = new FormData();
          for (var p of fd.entries()) fd2.append(p[0], p[1]);
          var lhrUrl = url.replace(/https?:\/\/[^\/]+/, lhr);
          lhrUrl = lhrUrl.replace(/^http:/, 'https:');
          return await self._uploadWithTimeout(lhrUrl, fd2);
        }
      }
      throw e;
    }
  },
  async uploadAvatar(file) {
    var compressed = await this._compressImage(file, 300, 800);
    var fd = new FormData(); fd.append('file', compressed, file.name);
    return await this._uploadWithFallback(API_BASE + '/api/upload/avatar', fd, true);
  },
  async uploadImage(file) {
    var compressed = await this._compressImage(file, 300, 1200);
    var fd = new FormData(); fd.append('file', compressed, file.name);
    return await this._uploadWithFallback(API_BASE + '/api/upload/image', fd, true);
  },
  async uploadVideo(file) {
    var fd = new FormData(); fd.append('file', file);
    return await this._uploadWithFallback(API_BASE + '/api/upload/video', fd, false);
  }
};

// ========== Social API Functions ==========
async function apiSearchUser(email) {
  return await apiFetch(API_BASE + '/api/users/search?email=' + encodeURIComponent(email));
}

async function apiSendFriendRequest(to_email) {
  return await apiFetch(API_BASE + '/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ to_email })
  });
}

async function apiGetFriendRequests() {
  return await apiFetch(API_BASE + '/api/friends/requests');
}

async function apiAcceptFriendRequest(request_id) {
  return await apiFetch(API_BASE + '/api/friends/accept', {
    method: 'POST',
    body: JSON.stringify({ request_id })
  });
}

async function apiRejectFriendRequest(request_id) {
  return await apiFetch(API_BASE + '/api/friends/reject', {
    method: 'POST',
    body: JSON.stringify({ request_id })
  });
}

async function apiGetFriends() {
  return await apiFetch(API_BASE + '/api/friends');
}

async function apiSendMessage(to_email, text) {
  return await apiFetch(API_BASE + '/api/messages', {
    method: 'POST',
    body: JSON.stringify({ to_email, text })
  });
}

// ========== WebSocket Manager ==========
var __wsCallbacks = {};
var __ws = null;
var __wsReconnectTimer = null;

function setWSCallback(event, cb) {
  __wsCallbacks[event] = cb;
}

function connectWS() {
  if (__ws && __ws.readyState === WebSocket.OPEN) return;
  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = proto + '//' + location.host;
  try {
    __ws = new WebSocket(wsUrl);
    __ws.onopen = function() {
      if (apiToken) __ws.send(JSON.stringify({ type: 'auth', token: apiToken }));
    };
    __ws.onmessage = function(ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'new_message' && __wsCallbacks.onMessage) {
          __wsCallbacks.onMessage(msg);
        } else if (msg.type === 'friend_request' && __wsCallbacks.onFriendRequest) {
          __wsCallbacks.onFriendRequest(msg);
        } else if (msg.type === 'request_accepted' && __wsCallbacks.onRequestAccepted) {
          __wsCallbacks.onRequestAccepted(msg);
        } else if (msg.type === 'friend_status' && __wsCallbacks.onFriendStatus) {
          __wsCallbacks.onFriendStatus(msg);
        }
      } catch (e) {}
    };
    __ws.onclose = function() {
      if (__wsReconnectTimer) clearTimeout(__wsReconnectTimer);
      __wsReconnectTimer = setTimeout(function() { if (apiToken) connectWS(); }, 5000);
    };
  } catch (e) {}
}

// ========== Balance / Sync helpers ==========
async function fetchBalanceFromBackend(email) {
  try {
    const data = await apiFetch('/api/users/search?email=' + encodeURIComponent(email));
    if (data && data.user) return { bal: data.user.balance, nexus: data.user.nexus };
  } catch(e) {}
  return null;
}

// ========== P2P API ==========
API.p2pListings = async function() {
  return await apiFetch(API_BASE + '/api/p2p/listings');
};
API.p2pCreateListing = async function(toolId, toolName, toolIcon, toolColor, price, qty, dur, saleMode, powerSource, region, slaTier, computeUnit, tokenPerMwh) {
  return await apiFetch(API_BASE + '/api/p2p/listings', {
    method: 'POST',
    body: JSON.stringify({ tool_id: toolId, tool_name: toolName, tool_icon: toolIcon, tool_color: toolColor, price: price, qty: qty, dur: dur, sale_mode: saleMode, power_source: powerSource, region: region, sla_tier: slaTier, compute_unit: computeUnit, token_per_mwh: tokenPerMwh })
  });
};
API.p2pDeleteListing = async function(id) {
  return await apiFetch(API_BASE + '/api/p2p/listings/' + encodeURIComponent(id), { method: 'DELETE' });
};
API.p2pBuyListing = async function(id) {
  return await apiFetch(API_BASE + '/api/p2p/listings/' + encodeURIComponent(id) + '/buy', { method: 'POST' });
};
API.toolSubscribe = async function(toolId, toolName, price) {
  return await apiFetch(API_BASE + '/api/tools/subscribe', {
    method: 'POST',
    body: JSON.stringify({ tool_id: toolId, tool_name: toolName, price: price })
  });
};
API.toolSubscriptions = async function() {
  return await apiFetch(API_BASE + '/api/tools/subscriptions');
};
API.userData = async function() {
  return await apiFetch(API_BASE + '/api/user/data');
};

API.userCreations = async function() {
  return await apiFetch(API_BASE + '/api/user/tools');
};
API.createTool = async function(name, icon, cat, desc, price, color) {
  return await apiFetch(API_BASE + '/api/user/tools', {
    method: 'POST',
    body: JSON.stringify({ name, icon, cat, desc, price, color })
  });
};
API.eventCreations = async function() {
  return await apiFetch(API_BASE + '/api/user/events');
};
API.createEvent = async function(title, emoji, date, loc, desc, tokens, price, status) {
  return await apiFetch(API_BASE + '/api/user/events', {
    method: 'POST',
    body: JSON.stringify({ title, emoji, date, loc, desc, tokens, price, status })
  });
};

// ========== Backend sync for user data ==========
async function syncBalanceFromBackend() {
  if (!curUser || !apiToken) return;
  try {
    var d = await API.userData();
    if (d && d.user) {
      curUser.bal = d.user.balance;
      if (!curUser.holds) curUser.holds = {};
      curUser.holds['NEXUS'] = d.user.nexus;
      if (d.subscriptions && d.subscriptions.length > 0) {
        d.subscriptions.forEach(function(s) { curUser.holds['TOOL_' + s.tool_id] = (curUser.holds['TOOL_' + s.tool_id] || 0) + 1; });
      }
      if (d.transactions) {
        curUser.txs = d.transactions.map(function(t) { return { type: t.type, token: t.token, amt: t.amount, time: t.created_at }; });
      }
      if (users[curUser._email]) {
        users[curUser._email].bal = curUser.bal;
        users[curUser._email].holds = curUser.holds;
        users[curUser._email].txs = curUser.txs;
        saveLS('nexus_users', users);
      }
      saveSession();
    }
  } catch(e) { console.error('syncBalance failed', e); }
}

async function syncUserToBackend(email, password, balance, holds) {
  // Try login first — user may already have backend account
  try {
    const loginRes = await API.login(email, password);
    if (loginRes && loginRes.user) {
      // Update local with backend data
      curUser.bal = loginRes.user.balance || 1000;
      curUser.holds = curUser.holds || {};
      curUser.holds['NEXUS'] = loginRes.user.nexus || 1000;
      curUser.avatar = loginRes.user.avatar || '';
      curUser.sig_image = loginRes.user.sig_image || '';
      curUser.sig_images = curUser.sig_image ? curUser.sig_image.split(',').filter(Boolean) : [];
      curUser.sig_video = loginRes.user.sig_video || '';
      curUser.bio = loginRes.user.bio || curUser.bio;
      curUser.wallet = loginRes.user.wallet || curUser.wallet;
      if (!users[email]) users[email] = {};
      users[email].bal = curUser.bal;
      users[email].holds = curUser.holds;
      users[email].avatar = curUser.avatar;
      users[email].sig_image = curUser.sig_image;
      users[email].sig_images = curUser.sig_images;
      users[email].sig_video = curUser.sig_video;
      users[email].bio = curUser.bio;
      users[email].wallet = curUser.wallet;
      saveLS('nexus_users', users);
      saveSession();
      return;
    }
  } catch(e) {}
  // Register new backend account
  try {
    const name = (users[email] && users[email].name) || email.split('@')[0];
    const regRes = await API.register(name, email, password);
    if (regRes && regRes.user) {
      if (!users[email]) users[email] = {};
      users[email].name = name;
      users[email].bal = regRes.user.balance || 1000;
      if (!users[email].holds) users[email].holds = {};
      users[email].holds['NEXUS'] = regRes.user.nexus || 1000;
      users[email].wallet = regRes.user.wallet || '';
      users[email].bio = regRes.user.bio || '';
      saveLS('nexus_users', users);
      saveSession();
    }
  } catch(e) {
    console.error('syncUserToBackend register failed', e);
  }
}
