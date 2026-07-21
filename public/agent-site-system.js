/**
 * AI Nexus - Dual-Channel Agent Sub-Site System
 * Domestic: Huifu (汇付天下斗拱平台)
 * International: Payoneer
 * 
 * Four-level agent hierarchy with subdomain routing
 */

(function() {
'use strict';

// ==================== CONFIGURATION ====================

const AGENT_SITE_CONFIG = {
  domestic: {
    suffix: 'agent.ai-nexus.cn',
    provider: 'huifu',
    provider_name: '汇付天下',
    currency: 'CNY',
    currency_symbol: '¥',
    levels: [
      { key: 'national',  name: '全国代理',    commission: 5,   sub_prefix: '' },
      { key: 'province',  name: '省级代理',    commission: 10,  sub_prefix: '{province}' },
      { key: 'city',      name: '市级代理',    commission: 30,  sub_prefix: '{city}.{province}' },
      { key: 'district',  name: '普通代理',    commission: 40,  sub_prefix: '{district}.{city}.{province}' }
    ],
    payment_fields: [
      { key: 'huifu_merchant_id', label: '汇付商户号', placeholder: '输入汇付商户号' },
      { key: 'huifu_sub_merchant_id', label: '子商户号', placeholder: '输入子商户号（可选）' },
      { key: 'bank_name', label: '开户银行', placeholder: '输入银行名称' },
      { key: 'bank_account', label: '银行账号', placeholder: '输入银行账号' },
      { key: 'bank_holder', label: '开户人姓名', placeholder: '输入开户人姓名' }
    ],
    fee_rate: '按支付商实际费率',
    withdraw_limit: 50000
  },
  international: {
    suffix: 'agent.ai-nexus.io',
    provider: 'payoneer',
    provider_name: 'Payoneer',
    currency: 'USD',
    currency_symbol: '$',
    levels: [
      { key: 'global',    name: '全球代理',    commission: 5,   sub_prefix: '' },
      { key: 'country',   name: '国家代理',    commission: 10,  sub_prefix: '{country}' },
      { key: 'state',     name: '洲省代理',    commission: 30,  sub_prefix: '{state}.{country}' },
      { key: 'city',      name: '普通代理',    commission: 40,  sub_prefix: '{city}.{state}.{country}' }
    ],
    payment_fields: [
      { key: 'payoneer_account', label: 'Payoneer 账户邮箱', placeholder: '输入 Payoneer 账户邮箱' },
      { key: 'payoneer_payee_id', label: 'Payee ID', placeholder: '输入 Payee ID (可选)' },
      { key: 'bank_name', label: '收款银行', placeholder: '输入银行名称' },
      { key: 'bank_account', label: '银行账号/IBAN', placeholder: '输入银行账号或 IBAN' },
      { key: 'bank_holder', label: '账户持有人姓名', placeholder: '输入姓名（英文）' }
    ],
    fee_rate: '按支付商实际费率',
    withdraw_limit: 10000
  }
};

// ==================== STATE ====================

let currentAgentSite = null;  // 'domestic' | 'international' | null
let agentChannelConfig = null;

// ==================== HOST DETECTION ====================

function detectAgentSite() {
  const host = location.hostname.toLowerCase();
  
  // Check domestic first (more specific)
  if (host.endsWith('.agent.ai-nexus.cn') || host === 'agent.ai-nexus.cn') {
    return 'domestic';
  }
  if (host.endsWith('.agent.ai-nexus.io') || host === 'agent.ai-nexus.io') {
    return 'international';
  }
  
  // Check if main domain but with agent query param
  const urlAgent = new URLSearchParams(location.search).get('agent_site');
  if (urlAgent === 'cn') return 'domestic';
  if (urlAgent === 'io') return 'international';
  
  return null;
}

function parseAgentLevel(host) {
  const domesticSuffix = 'agent.ai-nexus.cn';
  const intlSuffix = 'agent.ai-nexus.io';
  
  let suffix, channel;
  if (host.endsWith('.' + domesticSuffix) || host === domesticSuffix) {
    suffix = domesticSuffix;
    channel = 'domestic';
  } else if (host.endsWith('.' + intlSuffix) || host === intlSuffix) {
    suffix = intlSuffix;
    channel = 'international';
  } else {
    return null;
  }
  
  if (host === suffix) {
    return { channel, level: 0, subdomain: '' };
  }
  
  const sub = host.replace('.' + suffix, '');
  const parts = sub.split('.');
  const config = AGENT_SITE_CONFIG[channel];
  
  return {
    channel,
    level: parts.length - 1,
    subdomain: sub,
    parts
  };
}

// ==================== INITIALIZATION ====================

function initAgentSystem() {
  const channel = detectAgentSite();
  if (!channel) {
    // Not an agent sub-site, check if user is logged in agent
    checkAgentDashboardAccess();
    return;
  }
  
  currentAgentSite = channel;
  agentChannelConfig = AGENT_SITE_CONFIG[channel];
  const parsed = parseAgentLevel(location.hostname);
  
  if (parsed) {
    initAgentSubSite(parsed);
  }
}

function checkAgentDashboardAccess() {
  // If user is logged in and has agent role, show agent dashboard button
  const user = getCurrentUser();
  if (user && user.agent_role) {
    addAgentDashboardEntry(user);
  }
}

function getCurrentUser() {
  try {
    const stored = localStorage.getItem('ai_nexus_user');
    return stored ? JSON.parse(stored) : null;
  } catch(e) { return null; }
}

function addAgentDashboardEntry(user) {
  // Add "Agent Console" link to nav if on main site
  const nav = document.getElementById('nls');
  if (!nav) return;
  
  if (document.getElementById('nav-agent-console')) return;
  
  const a = document.createElement('a');
  a.id = 'nav-agent-console';
  a.style.cssText = 'color:#8b5cf6;font-weight:600';
  a.setAttribute('data-key', 'agconsole');
  a.textContent = '🎯 ';
  a.onclick = function(e) {
    e.preventDefault();
    openAgentConsole();
  };
  nav.appendChild(a);
}

// ==================== AGENT SUB-SITE INIT ====================

function initAgentSubSite(parsed) {
  const config = agentChannelConfig;
  const levelInfo = config.levels[parsed.level] || config.levels[0];
  
  // Hide main site content
  const mainContent = document.getElementById('main-content');
  if (mainContent) mainContent.style.display = 'none';
  
  // Hide nav
  const nav = document.querySelector('.nb');
  if (nav) nav.style.display = 'none';
  
  // Inject agent dashboard
  injectAgentDashboard(parsed, config, levelInfo);
  
  // Update document title
  document.title = levelInfo.name + ' - AI Nexus ' + config.provider_name;
  
  // Add agent bar at top
  showAgentSiteBar(parsed, config, levelInfo);
}

function showAgentSiteBar(parsed, config, levelInfo) {
  const bar = document.getElementById('agent-territory-bar');
  if (!bar) return;
  
  bar.style.display = 'block';
  const text = document.getElementById('agent-territory-text');
  if (text) {
    text.innerHTML = levelInfo.name + ' · ' + parsed.subdomain + ' · ' +
      config.provider_name + ' · ' + config.currency_symbol;
  }
}

// ==================== AGENT DASHBOARD HTML ====================

function injectAgentDashboard(parsed, config, levelInfo) {
  // Remove existing page content
  const existingPages = document.querySelectorAll('.pg');
  existingPages.forEach(p => p.style.display = 'none');
  
  const dashboard = document.getElementById('agent-console-dashboard');
  if (dashboard) {
    dashboard.style.display = 'block';
    renderAgentDashboardContent(parsed, config, levelInfo);
    return;
  }
  
  const html = `
  <div id="agent-console-dashboard" style="padding:16px;max-width:1100px;margin:0 auto">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <div>
        <div style="font-size:.7rem;color:var(--t3);margin-bottom:2px">${config.provider_name} · ${levelInfo.name}</div>
        <h1 style="font-size:1.4rem;font-weight:800;margin:0;background:linear-gradient(135deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${parsed.subdomain || levelInfo.name}</h1>
        <div style="font-size:.7rem;color:var(--t2)">佣金比例 ${levelInfo.commission}% · 货币 ${config.currency}</div>
      </div>
      <div style="display:flex;gap:8px">
        ${parsed.level < 3 ? `<button class="btn bg bs" onclick="window.agentSiteCreateSub()" style="font-size:.7rem;padding:6px 12px">+ 创建下级代理</button>` : ''}
        <button class="btn bo bs" onclick="window.agentSiteLogout()" style="font-size:.7rem;padding:6px 12px">退出</button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px">
      <div class="card" style="padding:14px">
        <div style="font-size:.65rem;color:var(--t3);text-transform:uppercase">可用余额</div>
        <div id="as-balance" style="font-size:1.6rem;font-weight:800;font-family:var(--fm);color:#10b981">${config.currency_symbol}0.00</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:.65rem;color:var(--t3);text-transform:uppercase">累计佣金</div>
        <div id="as-total-commission" style="font-size:1.6rem;font-weight:800;font-family:var(--fm);color:#8b5cf6">${config.currency_symbol}0.00</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:.65rem;color:var(--t3);text-transform:uppercase">下级代理数</div>
        <div id="as-sub-agents" style="font-size:1.6rem;font-weight:800;font-family:var(--fm);color:#f59e0b">0</div>
      </div>
      <div class="card" style="padding:14px">
        <div style="font-size:.65rem;color:var(--t3);text-transform:uppercase">佣金比例</div>
        <div id="as-commission-rate" style="font-size:1.6rem;font-weight:800;font-family:var(--fm);color:#06b6d4">${levelInfo.commission}%</div>
      </div>
    </div>

    <!-- Payment Channel & Withdraw -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <!-- Payment Channel Card -->
      <div class="card" style="padding:14px">
        <div class="ch" style="margin-bottom:10px">
          <div class="ct" style="font-size:.85rem">收款通道 · ${config.provider_name}</div>
          <button class="btn bo bs" onclick="window.agentSiteBindPayment()" style="font-size:.65rem;padding:4px 10px">${window.__agentPaymentBound ? '修改绑定' : '+ 绑定通道'}</button>
        </div>
        <div id="as-payment-info">
          <div style="color:var(--t3);font-size:.7rem;text-align:center;padding:12px" id="as-payment-empty">尚未绑定收款通道，请先绑定以接收佣金</div>
          <div id="as-payment-details" style="display:none;font-size:.72rem"></div>
        </div>
      </div>

      <!-- Withdraw Card -->
      <div class="card" style="padding:14px">
        <div class="ch" style="margin-bottom:10px">
          <div class="ct" style="font-size:.85rem">提现到银行账户</div>
        </div>
        <div style="margin-bottom:10px">
          <label style="font-size:.68rem;color:var(--t2)">提现金额 (${config.currency_symbol})</label>
          <input type="number" id="as-withdraw-amount" placeholder="最小 ${config.currency_symbol}10.00" 
            min="10" max="${config.withdraw_limit}" 
            style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--t1);font-size:.85rem;margin-top:4px">
          <div style="font-size:.6rem;color:var(--t3);margin-top:4px">单笔限额 ${config.currency_symbol}${config.withdraw_limit.toLocaleString()} · ${config.provider_name}代发</div>
        </div>
        <button class="btn bg bw" onclick="window.agentSiteWithdraw()" style="width:100%">立即提现</button>
      </div>
    </div>

    <!-- Commission History -->
    <div class="card" style="padding:14px;margin-bottom:16px">
      <div class="ch" style="margin-bottom:10px">
        <div class="ct" style="font-size:.85rem">佣金记录</div>
        <select id="as-comm-filter" onchange="window.agentSiteFilterCommission()" style="font-size:.68rem;padding:4px 8px;border-radius:6px;border:1px solid var(--bd);background:var(--bg);color:var(--t1)">
          <option value="all">全部</option>
          <option value="pending">待处理</option>
          <option value="paid">已到账</option>
          <option value="withdrawn">已提现</option>
        </select>
      </div>
      <div id="as-commission-list" style="max-height:300px;overflow-y:auto;font-size:.72rem">
        <div style="color:var(--t3);text-align:center;padding:16px">暂无佣金记录</div>
      </div>
    </div>

    <!-- Sub-Agent Management (if not L4) -->
    ${parsed.level < 3 ? `
    <div class="card" style="padding:14px">
      <div class="ch" style="margin-bottom:10px">
        <div class="ct" style="font-size:.85rem">下级代理管理</div>
      </div>
      <div id="as-sub-agent-list" style="font-size:.72rem">
        <div style="color:var(--t3);text-align:center;padding:16px">暂无下级代理</div>
      </div>
    </div>` : ''}
  </div>`;

  // Inject
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container.firstElementChild);
  
  // Load data
  loadAgentData(parsed, config, levelInfo);
}

function renderAgentDashboardContent(parsed, config, levelInfo) {
  loadAgentData(parsed, config, levelInfo);
}

// ==================== AGENT CONSOLE (main site entry) ====================

function openAgentConsole() {
  const user = getCurrentUser();
  if (!user || !user.agent_role) {
    alert('请先登录代理账户');
    return;
  }
  
  // Determine channel from user's agent settings
  const channel = user.agent_channel || 'international';
  const config = AGENT_SITE_CONFIG[channel];
  currentAgentSite = channel;
  agentChannelConfig = config;
  
  // Find user's level
  const levelIdx = user.agent_level || 0;
  const levelInfo = config.levels[levelIdx];
  
  const parsed = {
    channel,
    level: levelIdx,
    subdomain: user.agent_subdomain || '',
    parts: user.agent_subdomain ? user.agent_subdomain.split('.') : []
  };
  
  injectAgentDashboard(parsed, config, levelInfo);
}

// ==================== DATA LOADING ====================

function loadAgentData(parsed, config, levelInfo) {
  const user = getCurrentUser();
  const key = 'agent_data_' + (user ? user.id : 'guest') + '_' + parsed.channel;
  
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key) || '{}');
  } catch(e) { data = {}; }
  
  // Update stats
  const balance = data.balance || 0;
  const totalCommission = data.total_commission || 0;
  const subAgents = data.sub_agents || [];
  
  setElText('as-balance', config.currency_symbol + balance.toFixed(2));
  setElText('as-total-commission', config.currency_symbol + totalCommission.toFixed(2));
  setElText('as-sub-agents', subAgents.length);
  
  // Payment channel
  if (data.payment_bound) {
    const empty = document.getElementById('as-payment-empty');
    const details = document.getElementById('as-payment-details');
    if (empty) empty.style.display = 'none';
    if (details) {
      details.style.display = 'block';
      details.innerHTML = config.payment_fields.map(f => 
        `<div style="margin-bottom:4px"><span style="color:var(--t3)">${f.label}:</span> <strong>${maskSensitive(data.payment_info[f.key] || '-')}</strong></div>`
      ).join('');
    }
    window.__agentPaymentBound = true;
  }
  
  // Commission list
  renderCommissionList(data.commissions || [], config);
  
  // Sub-agent list
  renderSubAgentList(subAgents, config, parsed);
}

function renderCommissionList(commissions, config) {
  const container = document.getElementById('as-commission-list');
  if (!container) return;
  
  if (!commissions.length) {
    container.innerHTML = '<div style="color:var(--t3);text-align:center;padding:16px">暂无佣金记录</div>';
    return;
  }
  
  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid var(--bd)">
        <th style="padding:8px;text-align:left;font-size:.68rem;color:var(--t3)">时间</th>
        <th style="padding:8px;text-align:left;font-size:.68rem;color:var(--t3)">来源</th>
        <th style="padding:8px;text-align:right;font-size:.68rem;color:var(--t3)">金额</th>
        <th style="padding:8px;text-align:center;font-size:.68rem;color:var(--t3)">状态</th>
      </tr></thead>
      <tbody>
        ${commissions.map(c => `
          <tr style="border-bottom:1px solid var(--bd);font-size:.7rem">
            <td style="padding:8px">${new Date(c.time).toLocaleDateString()}</td>
            <td style="padding:8px">${c.source || '-'}</td>
            <td style="padding:8px;text-align:right;color:#10b981;font-weight:600">${config.currency_symbol}${c.amount.toFixed(2)}</td>
            <td style="padding:8px;text-align:center"><span class="as-status as-status-${c.status}">${statusLabel(c.status)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function renderSubAgentList(subAgents, config, parsed) {
  const container = document.getElementById('as-sub-agent-list');
  if (!container) return;
  
  if (!subAgents.length) {
    container.innerHTML = '<div style="color:var(--t3);text-align:center;padding:16px">暂无下级代理</div>';
    return;
  }
  
  container.innerHTML = subAgents.map(sa => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-bottom:1px solid var(--bd);gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:150px">
        <div style="font-weight:600;font-size:.75rem">${sa.name || sa.email || '-'}</div>
        <div style="font-size:.65rem;color:var(--t3)">${sa.subdomain || '-'} · ${config.levels[sa.level] ? config.levels[sa.level].name : '-'}</div>
      </div>
      <div style="font-size:.7rem;color:#10b981;font-weight:600">${config.currency_symbol}${(sa.total_commission || 0).toFixed(2)}</div>
      <div style="font-size:.65rem;color:var(--t2)">${sa.user_count || 0} 用户</div>
    </div>
  `).join('');
}

// ==================== ACTIONS ====================

function agentSiteBindPayment() {
  const config = agentChannelConfig;
  if (!config) return;
  
  // Build form
  const fieldsHtml = config.payment_fields.map(f => `
    <div class="ig" style="margin-bottom:10px">
      <label style="font-size:.72rem;color:var(--t2);display:block;margin-bottom:4px">${f.label}</label>
      <input type="text" id="as-bind-${f.key}" placeholder="${f.placeholder}" 
        style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--t1);font-size:.8rem">
    </div>
  `).join('');
  
  const modalHtml = `
  <div class="mo show" id="as-bind-modal"><div class="mod" style="max-width:420px">
    <h3 style="font-size:1rem;margin-bottom:4px">绑定收款通道</h3>
    <div style="font-size:.7rem;color:var(--t3);margin-bottom:12px">${config.provider_name} · ${config.currency} 结算</div>
    ${fieldsHtml}
    <div style="font-size:.65rem;color:var(--t3);margin-bottom:12px;padding:8px;background:rgba(139,92,246,.08);border-radius:6px">
      佣金将自动分账到您绑定的 ${config.provider_name} 账户，支持手动提现到银行卡。
    </div>
    <button class="btn bg bw" onclick="window.agentSiteSavePayment()" style="width:100%">保存绑定</button>
    <div style="text-align:center;margin-top:8px">
      <button class="btn bo" onclick="document.getElementById('as-bind-modal').remove()" style="font-size:.75rem">取消</button>
    </div>
  </div></div>`;
  
  const existing = document.getElementById('as-bind-modal');
  if (existing) existing.remove();
  
  const div = document.createElement('div');
  div.innerHTML = modalHtml;
  document.body.appendChild(div.firstElementChild);
}

function agentSiteSavePayment() {
  const config = agentChannelConfig;
  if (!config) return;
  
  const info = {};
  for (const f of config.payment_fields) {
    const el = document.getElementById('as-bind-' + f.key);
    info[f.key] = el ? el.value.trim() : '';
  }
  
  const user = getCurrentUser();
  const key = 'agent_data_' + (user ? user.id : 'guest') + '_' + currentAgentSite;
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key) || '{}');
  } catch(e) { data = {}; }
  
  data.payment_bound = true;
  data.payment_info = info;
  localStorage.setItem(key, JSON.stringify(data));
  
  document.getElementById('as-bind-modal').remove();
  
  // Refresh display
  const parsed = parseAgentLevel(location.hostname) || { channel: currentAgentSite, level: 0, subdomain: '' };
  const levelInfo = config.levels[parsed.level] || config.levels[0];
  loadAgentData(parsed, config, levelInfo);
}

function agentSiteWithdraw() {
  const config = agentChannelConfig;
  if (!config) return;
  
  const user = getCurrentUser();
  const key = 'agent_data_' + (user ? user.id : 'guest') + '_' + currentAgentSite;
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key) || '{}');
  } catch(e) { data = {}; }
  
  if (!data.payment_bound) {
    alert('请先绑定' + config.provider_name + '收款通道');
    return;
  }
  
  const amountEl = document.getElementById('as-withdraw-amount');
  const amount = parseFloat(amountEl ? amountEl.value : 0);
  
  if (!amount || amount < 10) {
    alert('提现金额不能低于 ' + config.currency_symbol + '10.00');
    return;
  }
  
  if (amount > config.withdraw_limit) {
    alert('单笔提现不能超过 ' + config.currency_symbol + config.withdraw_limit.toLocaleString());
    return;
  }
  
  if (amount > (data.balance || 0)) {
    alert('余额不足，当前可用余额: ' + config.currency_symbol + (data.balance || 0).toFixed(2));
    return;
  }
  
  // Process withdrawal
  data.balance = (data.balance || 0) - amount;
  if (!data.commissions) data.commissions = [];
  data.commissions.unshift({
    time: Date.now(),
    source: '提现到银行卡',
    amount: -amount,
    status: 'pending'
  });
  
  localStorage.setItem(key, JSON.stringify(data));
  
  // Refresh
  const parsed = parseAgentLevel(location.hostname) || { channel: currentAgentSite, level: 0, subdomain: '' };
  const levelInfo = config.levels[parsed.level] || config.levels[0];
  loadAgentData(parsed, config, levelInfo);
  
  alert('提现申请已提交！' + config.provider_name + '将在1-3个工作日内处理到账。');
}

function agentSiteCreateSub() {
  const config = agentChannelConfig;
  if (!config) return;
  
  const parsed = parseAgentLevel(location.hostname) || { channel: currentAgentSite, level: 0, subdomain: '' };
  const nextLevel = parsed.level + 1;
  
  if (nextLevel >= config.levels.length) {
    alert('已达到最低代理层级，无法再创建下级');
    return;
  }
  
  const nextLevelInfo = config.levels[nextLevel];
  
  const html = `
  <div class="mo show" id="as-create-sub-modal"><div class="mod" style="max-width:420px">
    <h3 style="font-size:1rem;margin-bottom:4px">创建${nextLevelInfo.name}</h3>
    <div style="font-size:.72rem;color:var(--t3);margin-bottom:12px">
      佣金 ${nextLevelInfo.commission}% · 上级 ${parsed.subdomain || '根代理'}
    </div>
    <div class="ig" style="margin-bottom:10px">
      <label style="font-size:.72rem;color:var(--t2);display:block;margin-bottom:4px">区域标识</label>
      <input type="text" id="as-sub-region" placeholder="例如: beijing / tokyo / ny" 
        style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--t1);font-size:.8rem">
    </div>
    <div class="ig" style="margin-bottom:10px">
      <label style="font-size:.72rem;color:var(--t2);display:block;margin-bottom:4px">代理邮箱</label>
      <input type="email" id="as-sub-email" placeholder="agent@example.com" 
        style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--t1);font-size:.8rem">
    </div>
    <div style="font-size:.65rem;color:var(--t3);margin-bottom:12px;padding:8px;background:rgba(6,182,212,.08);border-radius:6px">
      子域名: <strong id="as-sub-preview"></strong>
    </div>
    <button class="btn bg bw" onclick="window.agentSiteDoCreateSub(${nextLevel})" style="width:100%">确认创建</button>
    <div style="text-align:center;margin-top:8px">
      <button class="btn bo" onclick="document.getElementById('as-create-sub-modal').remove()" style="font-size:.75rem">取消</button>
    </div>
  </div></div>`;
  
  const existing = document.getElementById('as-create-sub-modal');
  if (existing) existing.remove();
  
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstElementChild);
  
  // Update subdomain preview on input
  document.getElementById('as-sub-region').addEventListener('input', function() {
    const region = this.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const prefix = parsed.subdomain ? region + '.' + parsed.subdomain : region;
    document.getElementById('as-sub-preview').textContent = prefix + '.' + config.suffix;
  });
}

function agentSiteDoCreateSub(nextLevel) {
  const config = agentChannelConfig;
  const region = document.getElementById('as-sub-region').value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const email = document.getElementById('as-sub-email').value.trim();
  
  if (!region || !email) {
    alert('请填写区域标识和代理邮箱');
    return;
  }
  
  const parsed = parseAgentLevel(location.hostname) || { channel: currentAgentSite, level: 0, subdomain: '' };
  const subdomain = parsed.subdomain ? region + '.' + parsed.subdomain : region;
  
  const user = getCurrentUser();
  const key = 'agent_data_' + (user ? user.id : 'guest') + '_' + currentAgentSite;
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key) || '{}');
  } catch(e) { data = {}; }
  
  if (!data.sub_agents) data.sub_agents = [];
  
  data.sub_agents.push({
    name: region,
    email: email,
    level: nextLevel,
    subdomain: subdomain,
    total_commission: 0,
    user_count: 0,
    created_at: Date.now()
  });
  
  localStorage.setItem(key, JSON.stringify(data));
  document.getElementById('as-create-sub-modal').remove();
  
  loadAgentData(parsed, config, config.levels[parsed.level]);
}

function agentSiteFilterCommission() {
  const filter = document.getElementById('as-comm-filter')?.value || 'all';
  const config = agentChannelConfig;
  if (!config) return;
  
  const user = getCurrentUser();
  const key = 'agent_data_' + (user ? user.id : 'guest') + '_' + currentAgentSite;
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key) || '{}');
  } catch(e) { data = {}; }
  
  const commissions = (data.commissions || []).filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });
  
  renderCommissionList(commissions, config);
}

function agentSiteLogout() {
  if (confirm('确定退出代理控制台？')) {
    location.href = 'https://ai-nexus.io';
  }
}

// ==================== UTILITIES ====================

function maskSensitive(val) {
  if (!val || val.length <= 4) return val;
  return val.slice(0, 2) + '****' + val.slice(-2);
}

function statusLabel(status) {
  const map = {
    'pending': '待处理',
    'paid': '已到账',
    'withdrawn': '已提现',
    'failed': '失败'
  };
  return map[status] || status;
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ==================== EXPORT TO WINDOW ====================

window.agentSiteBindPayment = agentSiteBindPayment;
window.agentSiteSavePayment = agentSiteSavePayment;
window.agentSiteWithdraw = agentSiteWithdraw;
window.agentSiteCreateSub = agentSiteCreateSub;
window.agentSiteDoCreateSub = agentSiteDoCreateSub;
window.agentSiteFilterCommission = agentSiteFilterCommission;
window.agentSiteLogout = agentSiteLogout;
window.AGENT_SITE_CONFIG = AGENT_SITE_CONFIG;
window.detectAgentSite = detectAgentSite;

// ==================== CSS INJECTION ====================

const agentStyles = `
.as-status {
  display:inline-block;
  padding:2px 8px;
  border-radius:10px;
  font-size:.62rem;
  font-weight:600;
}
.as-status-pending { background:rgba(245,158,11,.15); color:#f59e0b; }
.as-status-paid { background:rgba(16,185,129,.15); color:#10b981; }
.as-status-withdrawn { background:rgba(107,114,128,.15); color:#6b7280; }
.as-status-failed { background:rgba(239,68,68,.15); color:#ef4444; }
`;

const styleEl = document.createElement('style');
styleEl.textContent = agentStyles;
document.head.appendChild(styleEl);

// ==================== AUTO INIT ====================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAgentSystem);
} else {
  initAgentSystem();
}

})();
