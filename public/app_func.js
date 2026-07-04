
function buildLangMenu(){
  let h='';
  for(let k in LANG_FLAGS) h+=`<div class="lmi${k===curLang?' ac':''}" onclick="setLang('${k}')">${LANG_FLAGS[k]} ${k.toUpperCase()}</div>`;
  document.getElementById('lm').innerHTML=h;
}
function setLang(l){
  curLang=l; localStorage.setItem('nexus_lang',l);
  document.getElementById('cln').textContent=l.toUpperCase();
  document.getElementById('lm').classList.remove('show');
  buildLangMenu(); applyI18N(); rAll();
}

// ============ NOTIFICATIONS ============
function notify(msg, icon){ let d=document.getElementById('tc'); let e=document.createElement('div'); e.className='toast'; e.innerHTML=(icon||'&#x2705;')+' '+msg; d.appendChild(e); setTimeout(()=>e.remove(),2800); }
function toast(msg){ notify(msg); }

// ============ MODAL ============
function oam(type){
  document.querySelectorAll('.mo').forEach(m=>m.classList.remove('show'));
  if(type==='login') document.getElementById('mo-login').classList.add('show');
  else if(type==='register') document.getElementById('mo-register').classList.add('show');
  else if(type==='reset') document.getElementById('mo-reset').classList.add('show');
}
function cma(){ document.querySelectorAll('.mo').forEach(m=>m.classList.remove('show')); }
function togNav(forceClose){
  let nls=document.getElementById('nls');
  if(forceClose){nls.classList.remove('show');return;}
  nls.classList.toggle('show');
}
function spm(){
  if(!curUser){oam('login');return;}
  document.getElementById('profile-name').value=curUser.name||'';
  document.getElementById('profile-email').value=curUser.email||'';
  document.getElementById('profile-wallet').value=curUser.wallet||'';
  document.getElementById('profile-bio').value=curUser.bio||'';
  document.getElementById('profile-avatar-name').textContent=curUser.avatar?'✅ Uploaded':'';
  document.getElementById('profile-sigimg-name').textContent=curUser.sig_image?'✅ Uploaded':'';
  document.getElementById('profile-sigvid-name').textContent=curUser.sig_video?'✅ Uploaded':'';
  document.getElementById('mo-profile').classList.add('show');
  updateI18n();
}
function startKYC(){
  if(!curUser){oam('login');return;}
  document.getElementById('mo-kyc').classList.add('show');
}

// ============ AUTH ============
async function doRegister(){
  let n=document.getElementById('reg-name').value.trim();
  let e=document.getElementById('reg-email').value.trim().toLowerCase();
  let p=document.getElementById('reg-pass').value;
  let ref=document.getElementById('reg-ref').value.trim();
  if(!n||!e||!p){notify('Please fill all fields','&#x26A0;');return;}
  if(p.length<6){notify('Password must be at least 6 characters','&#x26A0;');return;}
  try{await API.register(n,e,p);}catch(err){notify('Server registration failed: '+err.message,'&#x26A0;');return;}
  users[e]={name:n,email:e,pass:p,wallet:'',bal:1000,holds:{NEXUS:1000},txs:[{type:'deposit',token:'CNY',amt:1000,time:new Date().toISOString()}],kyc:'Bronze',bio:'',joined:new Date().toISOString().split('T')[0],ref:ref};
  saveLS('nexus_users',users);
  // Sync initial balance to backend
  syncUserToBackend(e,p,1000,{NEXUS:1000});
  notify(t('rgs'),'&#x2705;'); cma(); doLogin_email(e,p); saveSession();
}
function doLogin(){
  let e=document.getElementById('login-email').value.trim().toLowerCase();
  let p=document.getElementById('login-pass').value;
  doLogin_email(e,p);
}
async function doLogin_email(e,p){
  if(!users[e]||users[e].pass!==p){notify('Invalid email or password','&#x26A0;');return;}
  curUser={...users[e]}; curUser._email=e;
  document.getElementById('aa').style.display='none';
  document.getElementById('ud').style.display='block';
  document.getElementById('ual').textContent=(curUser.name||'U')[0].toUpperCase();
  document.getElementById('udn').textContent=curUser.name;
  saveSession(); cma();
  // Fetch balance from backend and sync
  let bb=await fetchBalanceFromBackend(e);
  if(bb){curUser.bal=bb.bal;curUser.holds=curUser.holds||{};curUser.holds['NEXUS']=bb.nexus;users[e].bal=bb.bal;users[e].holds=users[e].holds||{};users[e].holds['NEXUS']=bb.nexus;saveLS('nexus_users',users);saveSession();}
  // Sync local to backend on login
  syncUserToBackend(e,p,curUser.bal,curUser.holds);
  notify('Welcome back, '+curUser.name+'!','&#x1F44B;'); rAll();
}
function doLogout(){ curUser=null; apiToken=null; try{localStorage.removeItem('nexus_api_token');}catch(e){} document.getElementById('aa').style.display='block'; document.getElementById('ud').style.display='none'; rAll(); notify('Logged out'); }
function doReset(){
  let e=document.getElementById('reset-email').value.trim().toLowerCase();
  if(!e){notify('Enter email','&#x26A0;');return;}
  notify(t('prs')+' '+e,'&#x2709;'); cma();
}
// ========== UPLOAD FUNCTIONS ==========
async function uploadFile(type){
  const map={avatar:'profile-avatar',sigimg:'profile-sigimg',sigvid:'profile-sigvid'};
  const apiMap={avatar:'uploadAvatar',sigimg:'uploadImage',sigvid:'uploadVideo'};
  const input=document.getElementById(map[type]);
  if(!input||!input.files||!input.files[0]){notify(t('mnofile'),'&#x26A0;');return;}
  const file=input.files[0];
  const nameSpan=document.getElementById(map[type]+'-name');
  if(nameSpan)nameSpan.innerHTML='<span class="spinner"></span>'+t('mup_loading');
  try{
    const res=await API[apiMap[type]](file);
    if(curUser){
      if(type==='avatar')curUser.avatar=res.path||res.url||'';
      else if(type==='sigimg')curUser.sig_image=res.path||res.url||'';
      else curUser.sig_video=res.path||res.url||'';
      users[curUser._email]={...users[curUser._email],
        avatar:curUser.avatar||users[curUser._email].avatar||'',
        sig_image:curUser.sig_image||users[curUser._email].sig_image||'',
        sig_video:curUser.sig_video||users[curUser._email].sig_video||''};
      saveLS('nexus_users',users);saveSession();
    }
    if(nameSpan)nameSpan.innerHTML='✅ '+file.name;
    notify(t('mup_success'),'✅');
  }catch(e){
    if(nameSpan)nameSpan.innerHTML='❌ '+e.message;
    notify(t('mup_fail')+': '+e.message,'❌');
  }
}
function clearUpload(type){
  const map={avatar:'profile-avatar',sigimg:'profile-sigimg',sigvid:'profile-sigvid'};
  const input=document.getElementById(map[type]);
  if(input)input.value='';
  const nameSpan=document.getElementById(map[type]+'-name');
  if(nameSpan)nameSpan.textContent='';
  if(curUser){
    if(type==='avatar')curUser.avatar='';
    else if(type==='sigimg')curUser.sig_image='';
    else curUser.sig_video='';
    users[curUser._email]={...users[curUser._email],
      avatar:type==='avatar'?'':(users[curUser._email].avatar||''),
      sig_image:type==='sigimg'?'':(users[curUser._email].sig_image||''),
      sig_video:type==='sigvid'?'':(users[curUser._email].sig_video||'')};
    saveLS('nexus_users',users);saveSession();
  }
}

function saveProfile(){
  if(!curUser)return;
  curUser.name=document.getElementById('profile-name').value.trim()||curUser.name;
  curUser.wallet=document.getElementById('profile-wallet').value.trim();
  curUser.bio=document.getElementById('profile-bio').value.trim();
  users[curUser._email]={...users[curUser._email],name:curUser.name,wallet:curUser.wallet,bio:curUser.bio};
  saveLS('nexus_users',users); saveSession();
  document.getElementById('ual').textContent=curUser.name[0].toUpperCase();
  document.getElementById('udn').textContent=curUser.name;
  cma(); notify(t('mpsaved'),'&#x2705;'); rAll();
  // Sync to backend if authenticated
  if(typeof apiToken!=='undefined'&&apiToken){ API.saveProfile(curUser.name,curUser.wallet,curUser.bio,curUser.avatar||null,curUser.sig_image||null,curUser.sig_video||null).catch(e=>console.error('backend sync:',e)); }
}
function saveWallet(){
  if(!curUser){oam('login');return;}
  let addr=document.getElementById('wallet-addr').value.trim();
  curUser.wallet=addr; users[curUser._email].wallet=addr;
  saveLS('nexus_users',users); saveSession();
  notify('Wallet saved','&#x2705;');
}
function submitKYC(){
  if(!curUser)return;
  let level='Silver'; curUser.kyc=level; users[curUser._email].kyc=level;
  saveLS('nexus_users',users); saveSession();
  cma(); notify('KYC upgraded to '+level,'&#x2705;'); rAll();
}
function confirmDialog(title,msg,cb){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  confirmCB=cb;
  document.getElementById('confirm-yes-btn').onclick=()=>{cma();if(confirmCB)confirmCB();};
  document.getElementById('mo-confirm').classList.add('show');
}

// ============ AGENT FUNCTIONS ============
async function loadAgentDashboard(){
  if(!curUser) return;
  try{
    const status = await API.agentStatus(curUser._email);
    if(!status.is_agent){
      document.getElementById('agent-not-registered').style.display='';
      document.getElementById('agent-dashboard').style.display='none';
      return;
    }
    document.getElementById('agent-not-registered').style.display='none';
    document.getElementById('agent-dashboard').style.display='';
    const boxes = document.getElementById('agent-info-boxes');
    boxes.innerHTML = '<div class="ag-info-box"><div class="ag-il" data-key="agid">Agent ID</div><div class="ag-iv" style="font-size:.85rem">'+status.agent_id+'</div></div><div class="ag-info-box"><div class="ag-il" data-key="agte">Total Earnings</div><div class="ag-iv" style="color:var(--ag)">$'+(status.total_earnings||0).toFixed(2)+'</div></div><div class="ag-info-box"><div class="ag-il" data-key="agrate">Commission Rate</div><div class="ag-iv">'+(status.commission_rate||50)+'%</div></div><div class="ag-info-box"><div class="ag-il" data-key="agstat">Status</div><div class="ag-iv" style="color:var(--ag);font-size:.85rem">'+status.status+'</div></div>';
    renderAgentPaypalList(status.paypal_configs||[]);
    const earnings = await API.agentEarnings(curUser._email);
    renderAgentCommissions(earnings.commissions||[], earnings.summary);
    renderLivePaypalButtons();
    updateI18n();
  } catch(e){ console.error('loadAgentDashboard:',e); }
}
function payToBecomeAgent(){
  if(!curUser){ showToast(t('noauth'),'w'); oam('login'); return; }
  openPaypalBtn(0);
}
async function confirmAgentRegistration(paypal_txn_id){
  if(!curUser) return;
  try{
    const res = await API.agentRegister(curUser._email, paypal_txn_id, 199);
    if(res.success){ showToast(t('agregok')||'Agent registration successful!','s'); loadAgentDashboard(); }
  } catch(e){ showToast(e.message,'e'); }
}
function renderAgentPaypalList(configs){
  const container = document.getElementById('agent-paypal-list');
  if(!configs||configs.length===0){ container.innerHTML='<div style="color:var(--t3);font-size:.7rem;text-align:center;padding:16px" data-key="agnopp">No PayPal buttons bound yet</div>'; updateI18n(); return; }
  container.innerHTML = configs.map(c=>'<div class="ag-pp-item"><div><div class="ag-pp-name">'+(c.button_name||'PayPal Button')+'</div><div class="ag-pp-id">'+c.hosted_button_id+'</div></div><button class="btn bo" style="font-size:.62rem;padding:3px 8px;color:var(--ar)" onclick="deletePaypalConfig(\''+c.id+'\')">&times;</button></div>').join('');
}
async function deletePaypalConfig(configId){
  if(!curUser) return;
  if(!confirm(t('agdelcf')||'Delete this PayPal button?')) return;
  try{ await API.agentDeletePaypal(curUser._email, configId); loadAgentDashboard(); } catch(e){ showToast(e.message,'e'); }
}
function renderAgentCommissions(commissions, summary){
  const container = document.getElementById('agent-commission-list');
  if(!commissions||commissions.length===0){ container.innerHTML='<div style="color:var(--t3);font-size:.7rem;text-align:center;padding:16px" data-key="agnocomm">No commission records yet</div>'; updateI18n(); return; }
  let html='';
  if(summary){ html+='<div style="display:flex;gap:12px;padding:6px 8px;background:var(--bg2);border-radius:7px;margin-bottom:6px;font-size:.68rem;flex-wrap:wrap"><span><span data-key="agtxns">Txns</span>: <b>'+(summary.total_txns||0)+'</b></span><span><span data-key="agrev">Revenue</span>: <b>$'+(summary.total_revenue||0).toFixed(2)+'</b></span><span><span data-key="agearn">Earned</span>: <b style="color:var(--ag)">$'+(summary.agent_earnings||0).toFixed(2)+'</b></span></div>'; }
  html += commissions.slice(0,20).map(c=>{ var d=new Date(c.created_at); return '<div class="ag-tx-item"><span>'+d.toLocaleDateString()+'</span><span class="ag-tx-amt pos">$'+Number(c.amount_agent||0).toFixed(2)+'</span></div>'; }).join('');
  container.innerHTML = html;
}
async function renderLivePaypalButtons(){
  const container = document.getElementById('agent-live-btns');
  try{
    const data = await API.agentPublicPaypal();
    const configs = data.configs||[];
    if(configs.length===0){ container.innerHTML='<div style="color:var(--t3);font-size:.7rem;text-align:center;padding:16px" data-key="agnolive">No live buttons available</div>'; updateI18n(); return; }
    container.innerHTML = configs.map(c=>'<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg2);border-radius:7px;margin-bottom:4px;flex-wrap:wrap"><span style="font-weight:600;font-size:.73rem">'+(c.button_name||'Button')+'</span><span style="font-size:.62rem;color:var(--t3);font-family:var(--fm)">'+c.hosted_button_id+'</span><span style="font-size:.62rem;color:var(--t3)">Agent: '+c.agent_id+'</span></div>').join('');
  } catch(e){ console.error('renderLivePaypalButtons:',e); }
}
function showBindPaypalModal(){
  if(!curUser){ showToast(t('noauth'),'w'); return; }
  document.getElementById('bind-pp-name').value='';
  document.getElementById('bind-pp-id').value='';
  document.getElementById('mo-bind-paypal').classList.add('show');
}
async function bindPaypalButton(){
  const name = document.getElementById('bind-pp-name').value.trim();
  const id = document.getElementById('bind-pp-id').value.trim();
  if(!name||!id){ showToast(t('agfill')||'Please fill all fields','w'); return; }
  try{
    await API.agentBindPaypal(curUser._email, id, name);
    document.getElementById('mo-bind-paypal').classList.remove('show');
    showToast(t('agbinds')||'PayPal button bound!','s');
    loadAgentDashboard();
  } catch(e){ showToast(e.message,'e'); }
}
// ============ PAYPAL DROPDOWN ============
let paypalCurrent = 0;
function togPaypalDd(e){
  e.stopPropagation();
  document.getElementById('paypal-menu').classList.toggle('show');
}
function openPaypalBtn(n){
  paypalCurrent = n;
  document.getElementById('paypal-menu').classList.remove('show');
  document.getElementById('paypal-donate-modal').classList.add('show');
}
document.addEventListener('click',function(e){
  const m = document.getElementById('paypal-menu');
  if(m&&!m.contains(e.target)&&!e.target.closest('#agent-pay-btn')){ m.classList.remove('show'); }
});
// ============ MARKET AGENT CARD ============
function renderAgentCard(){
  const hero = document.querySelector('#page-market .hero');
  if(!hero||document.getElementById('agent-promo-card')) return;
  const card = document.createElement('div');
  card.id = 'agent-promo-card';
  card.className = 'card';
  card.style.cssText = 'margin-top:10px;background:linear-gradient(135deg,rgba(139,92,246,.1),rgba(59,130,246,.1));border-color:rgba(139,92,246,.3)';
  card.innerHTML = '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="font-size:2rem">&#x1F91D;</div><div style="flex:1;min-width:200px"><div style="font-weight:800;font-size:.95rem;margin-bottom:3px" data-key="agpcard">Become AI Alliance Agent</div><div style="color:var(--t2);font-size:.72rem" data-key="agpcardd">Pay to join &rarr; Get sub-accounts &rarr; Earn 50% recurring commission on every sale through your PayPal buttons.</div></div><button class="btn bg bw" onclick="sp(\'agent\')" style="white-space:nowrap" data-key="agpjoin">Join Now</button></div>';
  hero.insertAdjacentElement('afterend', card);
}

// ============ PAGE NAV ============
function sp(page){
  curPage=page;
  document.querySelectorAll('.nls a').forEach(a=>a.classList.remove('active'));
  document.querySelector('.nls a[data-page="'+page+'"]').classList.add('active');
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('active'));
  let el=document.getElementById('page-'+page); if(el)el.classList.add('active');
  rAll();
}
function t(k){var d=LANG[curLang]||LANG['en'];return d[k]||LANG['en'][k]||k;}
function applyI18N(){
  document.querySelectorAll('[data-key]').forEach(el=>{let k=el.getAttribute('data-key'); if(el.tagName==='INPUT'&&el.type==='text')el.placeholder=t(k); else if(!el.hasAttribute('data-html'))el.textContent=t(k);});
}

// ============ SOCIAL / COMMUNITY ============
let scState = {
  tab: 'friends',
  chatTarget: null,
  chatTargetName: '',
  chats: JSON.parse(localStorage.getItem('nexus_social_chats')||'{}')
};
let scFriends = JSON.parse(localStorage.getItem('nexus_social_friends')||'[]');
let scGroups = JSON.parse(localStorage.getItem('nexus_social_groups')||'[]');
let scRequests = JSON.parse(localStorage.getItem('nexus_social_requests')||'[]');

// Demo data initialization
if(scFriends.length===0){
  scFriends = [
    {id:'f1',name:'AI Nexus Bot',avatar:'\ud83e\udd16',status:'online',bioKey:'scbio_bot'},
    {id:'f2',name:'CryptoTrader',avatar:'\ud83d\udcc8',status:'online',bioKey:'scbio_trader'},
    {id:'f3',name:'DevMaster',avatar:'\ud83d\udcbb',status:'offline',bioKey:'scbio_dev'},
    {id:'f4',name:'TokenQueen',avatar:'\ud83d\udc51',status:'online',bioKey:'scbio_queen'},
    {id:'f5',name:'AgentPro',avatar:'\ud83e\udd35',status:'offline',bioKey:'scbio_agent'},
    {id:'f6',name:'NewbieAI',avatar:'\ud83c\udf31',status:'online',bioKey:'scbio_newbie'}
  ];
  saveSocialFriends();
}
if(scGroups.length===0){
  scGroups = [
    {id:'g1',name:'NEXUS Holders',avatar:'\ud83d\udcb0',members:128,descKey:'scgdesc_holders'},
    {id:'g2',name:'AI Developers',avatar:'\ud83e\udde0',members:56,descKey:'scgdesc_devs'},
    {id:'g3',name:'P2P Traders',avatar:'\ud83e\udd1d',members:89,descKey:'scgdesc_p2p'},
    {id:'g4',name:'Agent Network',avatar:'\ud83c\udf10',members:42,descKey:'scgdesc_agent'}
  ];
  saveSocialGroups();
}
if(scRequests.length===0){
  scRequests = [
    {id:'r1',name:'AliceAI',avatar:'\ud83c\udf38',msgKey:'screqmsg_hi'},
    {id:'r2',name:'TokenMaster',avatar:'\ud83c\udfc6',msgKey:'screqmsg_trade'}
  ];
  saveSocialRequests();
}

function saveSocialFriends(){ localStorage.setItem('nexus_social_friends', JSON.stringify(scFriends)); }
function saveSocialGroups(){ localStorage.setItem('nexus_social_groups', JSON.stringify(scGroups)); }
function saveSocialRequests(){ localStorage.setItem('nexus_social_requests', JSON.stringify(scRequests)); }
function saveSocialChats(){ localStorage.setItem('nexus_social_chats', JSON.stringify(scState.chats)); }

function scTab(tab){
  scState.tab = tab; scState.chatTarget = null;
  document.querySelectorAll('.sc-tab').forEach(b=>b.classList.remove('active'));
  var btns = document.querySelectorAll('.sc-tab');
  var idx = {friends:0, groups:1, requests:2}[tab]||0;
  if(btns[idx]) btns[idx].classList.add('active');
  scRender();
}

function scRender(){
  var el = document.getElementById('sc-content'); if(!el) return;
  scUpdateReqBadge();
  if(scState.chatTarget){
    scRenderChat(el); updateI18n(el); return;
  }
  if(scState.tab==='friends') scRenderFriends(el);
  else if(scState.tab==='groups') scRenderGroups(el);
  else if(scState.tab==='requests') scRenderRequests(el);
  updateI18n(el);
}

function scRenderFriends(el){
  var h = '<div class="sc-search-bar"><input type="email" id="sc-search-input" data-key-placeholder="scsearchph" onkeydown="if(event.key===\'Enter\')scSearchFriend()"><button onclick="scSearchFriend()" data-key="scsearchemail">'+t('scsearchemail')+'</button></div>';
  h += '<div id="sc-search-result" style="display:none"></div>';
  h += '<div class="sc-list">';
  scFriends.forEach(f=>{
    var statusKey = f.status==='online'?'sconline':'scoffline';
    h += '<div class="sc-friend" onclick="scOpenChat(\''+f.id+'\',\''+f.name+'\')">';
    h += '<div class="sc-avatar">'+f.avatar+'</div>';
    h += '<div class="sc-info"><div class="sc-name">'+f.name+'</div><div class="sc-status" data-key="'+f.bioKey+'">'+t(f.bioKey)+'</div></div>';
    h += '<div class="sc-badge '+f.status+'"><span data-key="'+statusKey+'">'+t(statusKey)+'</span></div>';
    h += '</div>';
  });
  h += '</div>';
  el.innerHTML = h;
}

function scRenderGroups(el){
  var h = '<div class="sc-create-group"><input type="text" id="sc-new-group-name" data-key-placeholder="scgroupname"><button onclick="scCreateGroup()" data-key="sccreate">'+t('sccreate')+'</button></div>';
  h += '<div class="sc-list">';
  scGroups.forEach(g=>{
    h += '<div class="sc-group" onclick="scOpenGroupChat(\''+g.id+'\',\''+g.name+'\')">';
    h += '<div class="sc-avatar">'+g.avatar+'</div>';
    h += '<div class="sc-info"><div class="sc-name">'+g.name+'</div><div class="sc-status">'+g.members+' <span data-key="scmember">'+t('scmember')+'</span></div></div>';
    h += '<span class="sc-badge group"><span data-key="scgroupbadge">'+t('scgroupbadge')+'</span></span>';
    h += '</div>';
  });
  h += '</div>';
  el.innerHTML = h;
}

function scRenderRequests(el){
  var h = '<div class="sc-list">';
  if(scRequests.length===0){
    h += '<div style="text-align:center;color:var(--t3);padding:24px;font-size:.8rem" data-key="scnoreq">'+t('scnoreq')+'</div>';
  }
  scRequests.forEach(r=>{
    h += '<div class="sc-req"><div class="sc-avatar">'+r.avatar+'</div>';
    h += '<div class="sc-info"><div class="sc-name">'+r.name+'</div><div class="sc-status" data-key="'+r.msgKey+'">'+t(r.msgKey)+'</div></div>';
    h += '<div class="sc-req-btns"><button class="sc-accept" onclick="scAccept(\''+r.id+'\')" data-key="scaccept">'+t('scaccept')+'</button>';
    h += '<button class="sc-reject" onclick="scReject(\''+r.id+'\')" data-key="screject">'+t('screject')+'</button></div>';
    h += '</div>';
  });
  h += '</div>';
  el.innerHTML = h;
}

function scOpenChat(id, name){
  scState.chatTarget = id; scState.chatTargetName = name;
  if(!scState.chats[id]) scState.chats[id] = [];
  scRender();
}

function scOpenGroupChat(id, name){
  scState.chatTarget = 'group_'+id; scState.chatTargetName = '#'+name;
  if(!scState.chats['group_'+id]) scState.chats['group_'+id] = [];
  scRender();
}

function scRenderChat(el){
  var id = scState.chatTarget;
  var msgs = scState.chats[id]||[];
  var h = '<div class="sc-chat-area">';
  h += '<div class="sc-chat-header"><span class="sc-back" onclick="scBack()">&larr;</span>';
  h += '<div class="sc-chat-name">'+scState.chatTargetName+'</div></div>';
  h += '<div class="sc-chat-msgs" id="sc-msgs">';
  msgs.forEach(m=>{
    var cls = m.from==='me'?'me':'other';
    h += '<div class="sc-msg '+cls+'"><div>'+m.text+'</div><div class="sc-time">'+m.time+'</div></div>';
  });
  if(msgs.length===0){
    h += '<div style="text-align:center;color:var(--t3);padding:24px;font-size:.75rem" data-key="scchatstart">'+t('scchatstart')+'</div>';
  }
  h += '</div>';
  h += '<div class="sc-chat-input"><input type="text" id="sc-chat-input" data-key-placeholder="scchatph" onkeydown="if(event.key===\'Enter\')scSend()"><button onclick="scSend()" data-key="scsend">'+t('scsend')+'</button></div>';
  h += '</div>';
  el.innerHTML = h;
  // Scroll to bottom
  var msgsEl = document.getElementById('sc-msgs');
  if(msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  // Focus input
  setTimeout(function(){var inp=document.getElementById('sc-chat-input');if(inp)inp.focus();},100);
}

function scBack(){ scState.chatTarget = null; scRender(); }

async function scSend(){
  var input = document.getElementById('sc-chat-input');
  var text = (input.value||'').trim();
  if(!text) return;
  var id = scState.chatTarget;
  if(!scState.chats[id]) scState.chats[id] = [];
  var now = new Date();
  var time = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  scState.chats[id].push({from:'me',text:text,time:time});
  saveSocialChats();
  // Send to API
  var friendEmail = id.startsWith('group_') ? null : id;
  if(friendEmail && apiToken){
    try { await apiSendMessage(friendEmail, text); } catch(e) {}
  }
  scRender();
  input.value = '';
}

async function scAccept(reqId){
  var req = scRequests.find(r=>r.id===reqId);
  if(!req) return;
  try {
    await apiAcceptFriendRequest(reqId);
    scFriends.push({id:req.id,name:req.name,avatar:req.avatar,status:'online',bioKey:'scbio_new'});
    saveSocialFriends();
  } catch(e) { notify(e.message,'!'); return; }
  scRequests = scRequests.filter(r=>r.id!==reqId);
  saveSocialRequests();
  scUpdateReqBadge();
  scRender();
  notify(t('scaccept'),'\u2705');
}

async function scReject(reqId){
  try {
    await apiRejectFriendRequest(reqId);
  } catch(e) {}
  scRequests = scRequests.filter(r=>r.id!==reqId);
  saveSocialRequests();
  scRender();
}

function scCreateGroup(){
  var inp = document.getElementById('sc-new-group-name');
  var name = (inp.value||'').trim();
  if(!name) return;
  var id = 'g'+Date.now();
  var emojis = ['\ud83d\udcb0','\ud83e\udde0','\ud83e\udd1d','\ud83c\udf10','\ud83d\ude80','\ud83d\udca1','\ud83c\udf1f','\ud83d\udd25'];
  scGroups.push({id:id,name:name,avatar:emojis[Math.floor(Math.random()*emojis.length)],members:1,descKey:'scgdesc_new'});
  saveSocialGroups();
  scRender();
}

function scUpdateReqBadge(){
  var badge = document.getElementById('sc-req-count');
  if(badge){
    badge.textContent = scRequests.length;
    badge.style.display = scRequests.length>0?'inline':'none';
  }
}

async function scSearchFriend(){
  var inp = document.getElementById('sc-search-input');
  var email = (inp.value||'').trim().toLowerCase();
  var resultEl = document.getElementById('sc-search-result');
  if(!email){ resultEl.style.display = 'none'; return; }
  if(curUser && curUser._email && curUser._email.toLowerCase()===email){
    resultEl.style.display = 'block';
    resultEl.innerHTML = '<div class="sc-search-result-box" style="text-align:center;color:var(--t3);padding:12px;font-size:.75rem" data-key="sccantaddself">'+t('sccantaddself')+'</div>';
    return;
  }
  try {
    var data = await apiSearchUser(email);
    var u = data.user;
    if(data.isFriend){
      resultEl.style.display = 'block';
      resultEl.innerHTML = '<div class="sc-search-result-box" style="text-align:center;color:var(--t3);padding:12px;font-size:.75rem" data-key="scalreadyfriend">'+t('scalreadyfriend')+'</div>';
      return;
    }
    var avatar = (u.name||'U')[0].toUpperCase();
    var h = '<div class="sc-search-result-box">';
    h += '<div class="sc-avatar">'+avatar+'</div>';
    h += '<div class="sc-info"><div class="sc-name">'+u.name+'</div>';
    h += '<div class="sc-status"><span data-key="scuseremail">'+t('scuseremail')+'</span>: '+email+'</div>';
    if(u.bio) h += '<div class="sc-status">'+u.bio+'</div>';
    if(u.joined) h += '<div class="sc-status"><span data-key="scuserjoined">'+t('scuserjoined')+'</span>: '+u.joined+'</div>';
    h += '</div>';
    h += '<button class="sc-add-btn" onclick="scSendFriendRequest(\''+email+'\')" data-key="scaddbtn">'+t('scaddbtn')+'</button>';
    h += '</div>';
    resultEl.style.display = 'block';
    resultEl.innerHTML = h;
    updateI18n(resultEl);
  } catch(e) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = '<div class="sc-search-result-box" style="text-align:center;color:var(--t3);padding:12px;font-size:.75rem" data-key="scnouser">'+t('scnouser')+'</div>';
  }
}

async function scSendFriendRequest(email){
  if(!curUser){notify('Please login first','!');return;}
  try {
    await apiSendFriendRequest(email);
    var resultEl = document.getElementById('sc-search-result');
    if(resultEl){
      resultEl.style.display = 'block';
      resultEl.innerHTML = '<div class="sc-search-result-box" style="text-align:center;padding:12px;font-size:.75rem;color:var(--green)">'+t('screqsent')+'</div>';
    }
    scUpdateReqBadge();
    notify(t('screqsent'),'\u2705');
  } catch(e) {
    notify(e.message || t('scalreadyfriend'),'!');
  }
}

function socInit(){
  loadSocialFromAPI();
  setupWSCallbacks();
  if(apiToken) connectWS();
  scRender();
}

async function loadSocialFromAPI(){
  if(!apiToken) return;
  try {
    // Load friend requests
    var reqs = await apiGetFriendRequests();
    scRequests = [];
    reqs.incoming.forEach(function(fr){
      scRequests.push({id:fr.id, name:fr.from_name, avatar:(fr.from_name||'?')[0].toUpperCase(), email:fr.from_email, msgKey:'screqmsg_hi'});
    });
    saveSocialRequests();
    scUpdateReqBadge();
    // Load friends list
    var fdata = await apiGetFriends();
    scFriends = fdata.friends.map(function(f){
      return {id:f.email, name:f.name, avatar:(f.name||'?')[0].toUpperCase(), email:f.email, status:f.online?'online':'offline', bioKey:'scbio_new'};
    });
    saveSocialFriends();
  } catch(e) {}
}

function setupWSCallbacks(){
  setWSCallback('onMessage', function(msg){
    var chatId = msg.from_email;
    if(!scState.chats[chatId]) scState.chats[chatId] = [];
    scState.chats[chatId].push({from:'other', text:msg.text, time:new Date(msg.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
    saveSocialChats();
    if(scState.chatTarget === chatId) scRender();
  });
  setWSCallback('onFriendRequest', function(msg){
    scRequests.push({id:msg.id, name:msg.from_name, avatar:(msg.from_name||'?')[0].toUpperCase(), email:msg.from_email, msgKey:'screqmsg_hi'});
    saveSocialRequests();
    scUpdateReqBadge();
    if(curPage==='social' && scState.chatTarget===null) scRender();
  });
  setWSCallback('onRequestAccepted', function(msg){
    notify('Friend request accepted!','\u2705');
    loadSocialFromAPI();
  });
  setWSCallback('onFriendStatus', function(msg){
    var f = scFriends.find(function(ff){return ff.email===msg.email;});
    if(f){ f.status = msg.status; }
    if(curPage==='social' && scState.chatTarget===null) scRender();
  });
}


// ============ RENDER ALL ============

function updateI18n(container){
  if(!container) return;
  container.querySelectorAll('[data-key]').forEach(el=>{
    let k=el.getAttribute('data-key');
    var tag=el.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'){el.placeholder=t(k); return;}
    if(!el.hasAttribute('data-html'))el.textContent=t(k);
  });
  container.querySelectorAll('[data-key-placeholder]').forEach(el=>{
    el.placeholder=t(el.getAttribute('data-key-placeholder'));
  });
}

function rAll(){
  applyI18N();
  if(curPage==='market'){rTicker(); rTrending(); rRecentTxs(); drPriceChart();}
  else if(curPage==='tools') rTools();
  else if(curPage==='p2p') rP2P();
  else if(curPage==='trade') rTrade();
  else if(curPage==='events') rEvents();
  else if(curPage==='dashboard') rDashboard();
  else if(curPage==='agent'){ loadAgentDashboard(); renderAgentCard(); }
  else if(curPage==='social'){ socInit(); }
}
function rTicker(){
  let h='';
  for(let i=0;i<TICKERS.length;i++){
    let t=TICKERS[i];
    h+=`<div class="ti"><span class="tn">${t.n}</span><span class="tp">$${t.p}</span><span class="tc ${t.u?'up':'dn'}">${t.u?'+':''}${t.c}</span></div>`;
  }
  document.getElementById('tsc').innerHTML=h+h+h;
}
function rTrending(){
  let tools=initTools.sort((a,b)=>b.use-a.use).slice(0,8);
  let h='';
  tools.forEach(t=>{
    h+=`<div class="tpc${t.badge?' ft':''}" data-badge="${t.badge}" onclick="sp('tools')">
      <div class="pi" style="background:${t.color}20;color:${t.color};font-size:1.3rem">${t.icon}</div>
      <div class="pn">${t.name}</div><div class="ps2">${t.desc.slice(0,50)}</div>
      <div class="pp">$${t.price}<span class="pc2 up">/mo</span></div>
      <div class="pm"><span>${t.use} users</span><span class="up">APY ${t.apy}%</span></div></div>`;
  });
  document.getElementById('trending-packages').innerHTML=h;
}
function rRecentTxs(){
  let allTxs=[];
  for(let e in users){let u=users[e]; if(u.txs)allTxs=allTxs.concat(u.txs.map(t=>({...t,user:u.name,email:e})));}
  allTxs.sort((a,b)=>new Date(b.time)-new Date(a.time)); allTxs=allTxs.slice(0,12);
  if(allTxs.length===0){document.getElementById('recent-txs').innerHTML='<div style="padding:20px;text-align:center;color:var(--t3)">No transactions yet</div>';return;}
  let h='';
  allTxs.forEach(tx=>{
    let c=tx.type==='buy'||tx.type==='deposit'?'ob':'oa';
    h+=`<div class="or"><span style="max-width:80px;overflow:hidden;text-overflow:ellipsis">${tx.user}</span><span>${tx.type} ${tx.token||''}</span><span class="${c}">$${tx.amt}</span></div>`;
  });
  document.getElementById('recent-txs').innerHTML=h;
}
function drPriceChart(){
  setTimeout(()=>{
    let canvas=document.getElementById('priceChart'); if(!canvas)return;
    let ctx=canvas.getContext('2d'); let W=canvas.parentElement.clientWidth-36; canvas.width=W; canvas.height=280;
    let pts=[]; let v=0.35; for(let i=0;i<80;i++){v+=Math.random()*0.04-0.02; v=Math.max(0.1,v); pts.push(v);}
    let pad={t:30,r:20,b:40,l:50}; let pw=W-pad.l-pad.r, ph=280-pad.t-pad.b;
    let min=Math.min(...pts)*0.9, max=Math.max(...pts)*1.1, rng=max-min;
    ctx.clearRect(0,0,W,280);
    ctx.strokeStyle='rgba(139,92,246,0.08)'; ctx.lineWidth=1;
    for(let i=0;i<5;i++){let y=pad.t+(ph/4)*i; ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();}
    let grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ph); grad.addColorStop(0,'rgba(139,92,246,0.4)'); grad.addColorStop(1,'rgba(139,92,246,0.02)');
    ctx.beginPath(); ctx.moveTo(pad.l,pad.t+ph-((pts[0]-min)/rng)*ph);
    for(let i=1;i<pts.length;i++){let x=pad.l+(i/(pts.length-1))*pw; let y=pad.t+ph-((pts[i]-min)/rng)*ph; ctx.lineTo(x,y);}
    ctx.lineTo(pad.l+(pts.length-1)/(pts.length-1)*pw,pad.t+ph); ctx.lineTo(pad.l,pad.t+ph); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(pad.l,pad.t+ph-((pts[0]-min)/rng)*ph); ctx.strokeStyle='#8b5cf6'; ctx.lineWidth=2;
    for(let i=1;i<pts.length;i++){let x=pad.l+(i/(pts.length-1))*pw; let y=pad.t+ph-((pts[i]-min)/rng)*ph; ctx.lineTo(x,y);}
    ctx.stroke();
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--t3').trim(); ctx.font='9px monospace';
    for(let i=0;i<5;i++){let vv=min+(rng/4)*(4-i); ctx.fillText('$$'+vv.toFixed(4),4,pad.t+(ph/4)*i+4);}
    let dates=['Jan','Feb','Mar','Apr','May','Jun'];
    for(let i=0;i<6;i++){ctx.fillText(dates[i],pad.l+(pw/5)*i-10,280-6);}
    ctx.fillStyle='#8b5cf6'; ctx.beginPath(); ctx.arc(pad.l+(pts.length-1)/(pts.length-1)*pw,pad.t+ph-((pts[pts.length-1]-min)/rng)*ph,4,0,Math.PI*2); ctx.fill();
  },100);
}

// ============ TOOLS ============
function rTools(){
  let tools=[...initTools];
  let cat=document.getElementById('tool-cat')?.value||'all';
  let search=(document.getElementById('tool-search')?.value||'').toLowerCase();
  let sort=document.getElementById('tool-sort')?.value||'pop';
  if(cat!=='all') tools=tools.filter(t=>t.cat===cat);
  if(search) tools=tools.filter(t=>t.name.toLowerCase().includes(search)||t.desc.toLowerCase().includes(search));
  if(sort==='pop') tools.sort((a,b)=>b.use-a.use);
  else if(sort==='new') tools.sort((a,b)=>b.id.localeCompare(a.id));
  else if(sort==='price') tools.sort((a,b)=>a.price-b.price);
  else if(sort==='apy') tools.sort((a,b)=>b.apy-a.apy);
  let h='';
  tools.forEach(t=>{
    h+=`<div class="tpc"><div class="pi" style="background:${t.color}20;color:${t.color};font-size:1.3rem">${t.icon}</div>
      <div class="pn">${t.name}</div><div class="ps2">${t.desc.slice(0,60)}</div>
      <div class="pp">$${t.price}<span class="pc2" style="color:var(--t2)">/mo</span></div>
      <div class="pm"><span>${t.use} users</span><span class="up">APY ${t.apy}%</span><span>&#x2B50;${t.rating}</span></div>
      <button class="btn bg bs bw" style="margin-top:8px" onclick="subscribeTool('${t.id}')">${t('sub')} - $${t.price} CNY</button></div>`;
  });
  document.getElementById('tools-grid').innerHTML=h||'<div style="text-align:center;padding:30px;color:var(--t3);grid-column:1/-1">No tools found</div>';
}
function subscribeTool(toolId){
  if(!curUser){oam('login');return;}
  let tool=initTools.find(t=>t.id===toolId); if(!tool)return;
  if(curUser.bal<tool.price){notify('Insufficient balance','&#x26A0;');return;}
  curUser.bal-=tool.price;
  let hk='TOOL_'+toolId; curUser.holds[hk]=(curUser.holds[hk]||0)+1;
  curUser.txs.push({type:'buy',token:tool.name,amt:tool.price,time:new Date().toISOString()});
  users[curUser._email]={...curUser,holds:{...curUser.holds},txs:[...curUser.txs],bal:curUser.bal};
  saveLS('nexus_users',users); saveSession();
  notify(t('bs'),'&#x2705;'); rAll();
}

// ============ P2P ============
function p2pTab(tab){ p2pTabV=tab;
  document.getElementById('p2p-buy-btn').classList.toggle('active',tab==='buy');
  document.getElementById('p2p-sell-btn').classList.toggle('active',tab==='sell');
  document.getElementById('p2p-buy').style.display=tab==='buy'?'block':'none';
  document.getElementById('p2p-sell').style.display=tab==='sell'?'block':'none';
  rP2P();
}
function rP2P(){
  let ls=[...listings].filter(l=>l.qty>0);
  let search=(document.getElementById('p2p-search')?.value||'').toLowerCase();
  let toolF=(document.getElementById('p2p-tool')?.value||'all');
  let sort=document.getElementById('p2p-sort')?.value||'price-low';
  if(search) ls=ls.filter(l=>l.toolName.toLowerCase().includes(search)||l.seller.toLowerCase().includes(search));
  if(toolF!=='all') ls=ls.filter(l=>l.toolId===toolF);
  if(sort==='price-low') ls.sort((a,b)=>a.price-b.price);
  else if(sort==='price-high') ls.sort((a,b)=>b.price-a.price);
  else if(sort==='new') ls.sort((a,b)=>b.created-a.created);
  // Populate tool filter
  let tfs='<option value="all">All Tools</option>';
  let seen=new Set(); initTools.forEach(t=>{if(!seen.has(t.id)){seen.add(t.id);tfs+=`<option value="${t.id}">${t.name}</option>`;}});
  let sel=document.getElementById('p2p-tool'); if(sel)sel.innerHTML=tfs;
  // Populate sell tool selector
  let sellSel=document.getElementById('p2p-sell-tool'); if(sellSel){ sellSel.innerHTML=initTools.map(t=>`<option value="${t.id}">${t.name} ($${t.price}/mo)</option>`).join('');}
  // Render buy list
  let h='';
  ls.forEach(l=>{
    h+=`<div class="lc" onclick="openListing('${l.id}')">
      <div class="lct"><span class="ltk">${l.toolName}</span><span class="lcd">$${l.price}</span></div>
      <div class="lci"><span>${t('sell')}: ${l.seller}</span><span>${t('rating')}: ${l.sellerRating}</span><span>${t('sold2')}: ${l.sold}</span></div>
      <div class="lcp">$${l.price} CNY <span style="font-size:.65rem;color:var(--t3);font-weight:400">| ${l.dur} ${t('days')}</span></div></div>`;
  });
  document.getElementById('p2p-buy-list').innerHTML=h||'<div style="text-align:center;padding:20px;color:var(--t3);grid-column:1/-1">No listings</div>';
  // Render sell list (own)
  if(curUser){
    let own=ls.filter(l=>l.seller===curUser.email);
    let sh='';
    own.forEach(l=>{
      sh+=`<div class="lc"><div class="lct"><span class="ltk">${l.toolName}</span><span class="lcd">$${l.price}</span></div>
        <div style="font-size:.65rem;color:var(--t3)">Qty: ${l.qty} | ${l.dur} days | Sold: ${l.sold}</div>
        <button class="btn bd2 bx" onclick="cancelListing('${l.id}')">Cancel</button></div>`;
    });
    document.getElementById('p2p-sell-list').innerHTML=sh||'<div style="text-align:center;padding:10px;color:var(--t3);grid-column:1/-1">No active listings</div>';
  }
}
function openListing(id){
  let l=listings.find(x=>x.id===id); if(!l)return;
  curListing=l;
  document.getElementById('listing-title').textContent=l.toolName+' - $'+l.price+' CNY';
  document.getElementById('listing-seller').textContent='Seller: '+l.seller;
  document.getElementById('listing-rating').textContent='Rating: '+l.sellerRating;
  document.getElementById('listing-sold').textContent='Sold: '+l.sold;
  document.getElementById('listing-price').textContent='$'+l.price+' CNY';
  document.getElementById('mo-listing').classList.add('show');
}
function buyListing(){
  if(!curUser){oam('login');cma();return;}
  if(!curListing)return;
  if(curUser.bal<parseFloat(curListing.price)){notify('Insufficient balance','&#x26A0;');cma();return;}
  curUser.bal-=parseFloat(curListing.price);
  let hk='TOOL_'+curListing.toolId; curUser.holds[hk]=(curUser.holds[hk]||0)+1;
  curUser.txs.push({type:'buy',token:curListing.toolName,amt:parseFloat(curListing.price),time:new Date().toISOString()});
  users[curUser._email]={...curUser,holds:{...curUser.holds},txs:[...curUser.txs],bal:curUser.bal};
  let li=listings.find(x=>x.id===curListing.id); if(li){li.qty--;li.sold++;}
  saveLS('nexus_users',users); saveLS('nexus_p2p_listings',listings); saveSession();
  cma(); notify(t('bs'),'&#x2705;'); rAll();
}
function p2pCreateListing(){
  if(!curUser){oam('login');return;}
  let toolId=document.getElementById('p2p-sell-tool').value;
  let price=parseFloat(document.getElementById('p2p-sell-price').value)||0;
  let qty=parseInt(document.getElementById('p2p-sell-qty').value)||1;
  let dur=parseInt(document.getElementById('p2p-sell-dur').value)||30;
  if(!price||price<=0){notify('Enter valid price','&#x26A0;');return;}
  let tool=initTools.find(t=>t.id===toolId);
  listings.push({id:'p2p_'+Date.now(),toolId,toolName:tool.name,toolIcon:tool.icon,toolColor:tool.color,seller:curUser.email,sellerRating:'5.0',price:price,qty,dur,sold:0,created:Date.now()});
  saveLS('nexus_p2p_listings',listings);
  notify(t('pln'),'&#x2705;'); rP2P();
}
function cancelListing(id){ listings=listings.filter(l=>l.id!==id); saveLS('nexus_p2p_listings',listings); rP2P(); }

// ============ TRADE ============
function tradeSide(s){ tradeSideV=s;
  document.getElementById('trade-buy-btn').classList.toggle('active',s==='buy');
  document.getElementById('trade-sell-btn').classList.toggle('active',s==='sell');
  document.getElementById('trade-exec-btn').textContent=s==='buy'?t('tbuy2'):'Sell NEXUS';
  rTrade();
}
function tradeType(){ tradeTypeV=document.querySelector('input[name="ttype"]:checked').value;
  document.getElementById('trade-price').readOnly=(tradeTypeV==='market');
}
function setPct(pct){ if(!curUser)return; let bal=curUser.bal||0; let price=parseFloat(document.getElementById('trade-price').value)||0.4; let amt=Math.floor((bal*pct/100)/price); document.getElementById('trade-amount').value=amt; updTradeTotal(); }
function updTradeTotal(){ let amt=parseFloat(document.getElementById('trade-amount').value)||0; let price=parseFloat(document.getElementById('trade-price').value)||0; document.getElementById('trade-total').textContent=(amt*price).toFixed(2)+' CNY'; }
function rTrade(){
  if(curUser) document.getElementById('trade-bal').textContent=curUser.bal.toFixed(2)+' CNY';
  document.getElementById('trade-exec-btn').textContent=tradeSideV==='buy'?t('tbuy2'):'Sell NEXUS';
  rOrderBook(); rTradeHistory(); drTradeChart();
}
function rOrderBook(){
  let bids=[], asks=[];
  let base=0.42;
  for(let i=0;i<10;i++){bids.push({p:(base-(i+1)*0.003).toFixed(4),a:Math.floor(Math.random()*8000+2000)});asks.push({p:(base+(i+1)*0.003).toFixed(4),a:Math.floor(Math.random()*7000+1000)});}
  let h='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2px;font-size:.68rem;font-family:var(--fm)"><div style="color:var(--t3);padding:3px">Price</div><div style="color:var(--t3);text-align:right;padding:3px">Amt</div><div style="color:var(--t3);text-align:right;padding:3px">Total</div>';
  asks.reverse().forEach(a=>h+=`<div style="color:var(--ar)">${a.p}</div><div style="text-align:right">${a.a}</div><div style="text-align:right;color:var(--t3)">${(a.p*a.a).toFixed(0)}</div>`);
  h+=`<div style="color:var(--ag);font-weight:700;padding:4px 0;grid-column:1/-1;text-align:center;border-top:1px solid var(--bd);border-bottom:1px solid var(--bd)">$${base.toFixed(4)}</div>`;
  bids.forEach(b=>h+=`<div style="color:var(--ag)">${b.p}</div><div style="text-align:right">${b.a}</div><div style="text-align:right;color:var(--t3)">${(b.p*b.a).toFixed(0)}</div>`);
  h+='</div>';
  document.getElementById('orderbook').innerHTML=h;
}
function rTradeHistory(){
  let txs=[]; for(let i=0;i<12;i++){let p=(0.42+(Math.random()-0.5)*0.02).toFixed(4);let a=Math.floor(Math.random()*500+100);txs.push({p,a,up:Math.random()>0.5,time:new Date(Date.now()-i*300000).toLocaleTimeString()});}
  let h='';
  txs.forEach(tx=>h+=`<div class="or"><span style="font-size:.65rem;color:var(--t3)">${tx.time}</span><span class="${tx.up?'ob':'oa'}">$${tx.p}</span><span>${tx.a}</span></div>`);
  document.getElementById('trade-history').innerHTML=h;
}
function drTradeChart(){
  setTimeout(()=>{
    let canvas=document.getElementById('tradeChart'); if(!canvas)return;
    let ctx=canvas.getContext('2d'); let W=canvas.parentElement.clientWidth-36; canvas.width=W; canvas.height=280;
    let pts=[]; let v=0.42; for(let i=0;i<100;i++){v+=(Math.random()-0.48)*0.015;v=Math.max(0.15,v);pts.push(v);}
    let pad={t:20,r:15,b:35,l:50}; let pw=W-pad.l-pad.r, ph=280-pad.t-pad.b;
    let min=Math.min(...pts)*0.98, max=Math.max(...pts)*1.02, rng=max-min;
    ctx.clearRect(0,0,W,280);
    ctx.strokeStyle='rgba(139,92,246,0.06)'; ctx.lineWidth=1;
    for(let i=0;i<5;i++){let y=pad.t+(ph/4)*i;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();}
    let grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ph);grad.addColorStop(0,'rgba(139,92,246,0.35)');grad.addColorStop(1,'rgba(139,92,246,0.02)');
    ctx.beginPath();ctx.moveTo(pad.l,pad.t+ph-((pts[0]-min)/rng)*ph);
    for(let i=1;i<pts.length;i++){let x=pad.l+(i/(pts.length-1))*pw;let y=pad.t+ph-((pts[i]-min)/rng)*ph;ctx.lineTo(x,y);}
    ctx.lineTo(pad.l+(pts.length-1)/(pts.length-1)*pw,pad.t+ph);ctx.lineTo(pad.l,pad.t+ph);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    ctx.beginPath();ctx.moveTo(pad.l,pad.t+ph-((pts[0]-min)/rng)*ph);ctx.strokeStyle='#8b5cf6';ctx.lineWidth=2;
    for(let i=1;i<pts.length;i++){let x=pad.l+(i/(pts.length-1))*pw;let y=pad.t+ph-((pts[i]-min)/rng)*ph;ctx.lineTo(x,y);}
    ctx.stroke();
    ctx.fillStyle='#6a6a82';ctx.font='9px monospace';
    for(let i=0;i<5;i++){let vv=min+(rng/4)*(4-i);ctx.fillText('$'+vv.toFixed(4),2,pad.t+(ph/4)*i+4);}
  },100);
}
async function execTrade(){
  if(!curUser){oam('login');return;}
  confirmDialog(tradeSideV==='buy'?'Confirm Buy':'Confirm Sell','Execute trade?',async ()=>{
    let price=parseFloat(document.getElementById('trade-price').value)||0.42;
    let amt=parseInt(document.getElementById('trade-amount').value)||0;
    if(amt<=0){notify('Enter valid amount','&#x26A0;');return;}
    try{
      if(tradeSideV==='buy'){
        let res=await API.buy(curUser._email,amt,price);
        curUser.bal=res.balance_cny; curUser.holds=curUser.holds||{}; curUser.holds['NEXUS']=res.balance_nexus;
        curUser.txs.push({type:'buy',token:'NEXUS',amt:res.total_cny,time:new Date().toISOString()});
      }else{
        let res=await API.sell(curUser._email,amt,price);
        curUser.bal=res.balance_cny; curUser.holds=curUser.holds||{}; curUser.holds['NEXUS']=res.balance_nexus;
        curUser.txs.push({type:'sell',token:'NEXUS',amt:res.total_cny,time:new Date().toISOString()});
      }
      users[curUser._email]={...curUser,holds:{...curUser.holds},txs:[...curUser.txs],bal:curUser.bal};
      saveLS('nexus_users',users); saveSession();
      notify(tradeSideV==='buy'?t('bs'):t('ss'),'&#x2705;'); rAll();
    }catch(err){notify('Trade failed: '+err.message,'&#x26A0;');}
  });
}
function tradeTF(tf,ev){ tradeTFVal=tf;
  document.querySelectorAll('#page-trade .ttab').forEach(b=>b.classList.remove('active'));
  (ev||event).target.classList.add('active'); drTradeChart();
}

// ============ EVENTS ============
function rEvents(){
  let h='';
  initEvents.forEach(ev=>{
    let st=ev.status==='live'?'tlive':(ev.status==='upcoming'?'tv':'tsb');
    h+=`<div class="ec"><div class="eci" style="background:linear-gradient(135deg,var(--bgch),var(--bg2))"><span class="et ${st}">${ev.status.toUpperCase()}</span><span class="ee">${ev.emoji}</span></div>
      <div class="ecb"><h3>${ev.title}</h3><div class="ei"><span>&#x1F4C5; ${ev.date}</span><span>&#x1F4CD; ${ev.loc}</span><span>&#x1F465; ${ev.attendees.toLocaleString()}</span></div>
      <p style="font-size:.68rem;color:var(--t2);margin-bottom:6px">${ev.desc}</p>
      <div class="etp"><span>${ev.tokens.toLocaleString()} Tokens</span><span style="font-weight:800;color:var(--ap)">${ev.price}</span></div></div></div>`;
  });
  document.getElementById('events-grid').innerHTML=h;
}

// ============ PAYMENT ============
let paymentMode='deposit'; let pendingOrderId=null;
function startDeposit(){
  if(!curUser){oam('login');return;}
  paymentMode='deposit';
  document.getElementById('payment-title').textContent='Deposit CNY';
  document.getElementById('payment-btn').textContent='Confirm Deposit';
  document.getElementById('payment-info').textContent='Enter amount to top up your balance. Test mode: instant credit.';
  document.getElementById('payment-amount').value='100';
  document.getElementById('mo-payment').classList.add('show');
}
function startWithdraw(){
  if(!curUser){oam('login');return;}
  paymentMode='withdraw';
  document.getElementById('payment-title').textContent='Withdraw CNY';
  document.getElementById('payment-btn').textContent='Confirm Withdraw';
  document.getElementById('payment-info').textContent='Available: '+curUser.bal.toFixed(2)+' CNY. Withdrawal is processed instantly.';
  document.getElementById('payment-amount').value='';
  document.getElementById('mo-payment').classList.add('show');
}
async function execPayment(){
  let amt=parseFloat(document.getElementById('payment-amount').value)||0;
  if(amt<=0){notify('Enter valid amount','&#x26A0;');return;}
  try{
    if(paymentMode==='deposit'){
      let res=await API.deposit(curUser._email,amt);
      if(res.testMode){
        // Auto-confirm in test mode
        let cres=await API.depositConfirm(res.orderId);
        curUser.bal=cres.balance;
        notify('Deposited '+amt+' CNY! New balance: '+cres.balance.toFixed(2)+' CNY','&#x2705;');
      }else if(res.url){
        window.open(res.url,'_blank');
        notify('Redirecting to payment page...','&#x1F4B3;');
      }
    }else{
      let res=await API.withdraw(curUser._email,amt);
      curUser.bal=res.balance;
      notify('Withdrawn '+amt+' CNY! New balance: '+res.balance.toFixed(2)+' CNY','&#x2705;');
    }
    users[curUser._email].bal=curUser.bal;
    saveLS('nexus_users',users); saveSession();
    cma(); rAll();
  }catch(err){notify('Payment failed: '+err.message,'&#x26A0;');}
}

// ============ DASHBOARD ============
function rDashboard(){
  if(!curUser){
    document.getElementById('dash-assets').innerHTML='<div style="padding:20px;text-align:center;color:var(--t3)">Please login</div>';
    document.getElementById('dash-holdings').innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--t3)">--</td></tr>';
    document.getElementById('dash-tx').innerHTML='<div style="padding:20px;text-align:center;color:var(--t3)">--</div>';
    return;
  }
  let totalVal=curUser.bal;
  if(curUser.holds) for(let k in curUser.holds){
    if(k==='NEXUS') totalVal+=curUser.holds[k]*0.42;
    else totalVal+=curUser.holds[k]*10;
  }
  document.getElementById('dash-assets').innerHTML=`
    <div class="ac"><div class="al">Total Value</div><div class="av">$${totalVal.toFixed(2)}</div><div class="as">USD</div></div>
    <div class="ac"><div class="al">Balance</div><div class="av">$${curUser.bal.toFixed(2)}</div><div class="as">CNY</div></div>
    <div class="ac"><div class="al">KYC Level</div><div class="av">${curUser.kyc||'Bronze'}</div><div class="as">Verification</div></div>`;
  // Holdings table
  let hh='';
  if(curUser.holds) for(let k in curUser.holds){
    let val=k==='NEXUS'?curUser.holds[k]*0.42:curUser.holds[k]*10;
    let pnl=((Math.random()-0.3)*20).toFixed(1);
    hh+=`<tr><td>${k}</td><td>${curUser.holds[k]}</td><td>$${val.toFixed(2)}</td><td style="color:${parseFloat(pnl)>=0?'var(--ag)':'var(--ar)'}">${pnl}%</td></tr>`;
  }
  document.getElementById('dash-holdings').innerHTML=hh||'<tr><td colspan="4" style="text-align:center;color:var(--t3)">No holdings</td></tr>';
  // TX history
  let th='';
  let txs=[...(curUser.txs||[])].reverse().slice(0,15);
  txs.forEach(tx=>{
    let c=tx.type==='buy'||tx.type==='deposit'?'ob':'oa';
    let label=tx.type==='deposit'?'Deposit':tx.type==='withdraw'?'Withdraw':tx.type==='buy'?'Buy':tx.type==='sell'?'Sell':tx.type;
    th+=`<div class="or"><span>${label}</span><span>${tx.token||''}</span><span class="${c}">$${tx.amt}</span><span style="font-size:.63rem;color:var(--t3)">${new Date(tx.time).toLocaleDateString()}</span></div>`;
  });
  document.getElementById('dash-tx').innerHTML=th||'<div style="padding:15px;text-align:center;color:var(--t3)">No transactions</div>';
  // KYC
  document.getElementById('kyc-level').textContent=curUser.kyc||'Bronze';
  document.getElementById('kyc-level').style.background=(curUser.kyc==='Platinum'?'rgba(139,92,246,.2)':curUser.kyc==='Gold'?'rgba(245,158,11,.15)':curUser.kyc==='Silver'?'rgba(59,130,246,.12)':'rgba(16,185,129,.08)');
  document.getElementById('kyc-level').style.color=(curUser.kyc==='Platinum'?'var(--ap)':curUser.kyc==='Gold'?'var(--ao)':curUser.kyc==='Silver'?'var(--ab)':'var(--ag)');
  // Wallet
  document.getElementById('wallet-addr').value=curUser.wallet||'';
  // Payment balance
  document.getElementById('pay-balance').textContent=curUser.bal.toFixed(2)+' CNY';
}

// ============ PARTICLES ============
function initParticles(){
  let c=document.getElementById('pcs'); let frag=document.createDocumentFragment();
  for(let i=0;i<30;i++){let d=document.createElement('div');d.className='pc';let s=2+Math.random()*4;d.style.cssText=`width:${s}px;height:${s}px;left:${Math.random()*100}%;background:${['#8b5cf6','#3b82f6','#ec4899','#06b6d4'][i%4]};animation-duration:${8+Math.random()*18}s;animation-delay:${Math.random()*10}s;box-shadow:0 0 ${s*3}px currentColor`;frag.appendChild(d);}
  c.appendChild(frag);
}

// ============ TOGGLES ============
function togLm(){document.getElementById('lm').classList.toggle('show');}
function togUm(){document.getElementById('um').classList.toggle('show');}
function togN(){
  let np=document.getElementById('np');
  let h='<div class="nemp">Notifications</div>';
  h+='<div class="ni2">Market update: NEXUS +5.2%</div><div class="ni2">New listing: GPT-4 @ $12</div><div class="ni2">Event: AI DevCon tickets available</div>';
  np.innerHTML=h; np.classList.toggle('show');
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded',()=>{
  initParticles();
  curLang=localStorage.getItem('nexus_lang')||'zh';
  document.getElementById('cln').textContent=curLang.toUpperCase();
  document.getElementById('clf').innerHTML=LANG_FLAGS[curLang]||'';
  buildLangMenu();
  let saved=localStorage.getItem('nexus_cur_user_email');
  if(saved&&users[saved]){curUser={...users[saved]};curUser._email=saved;document.getElementById('aa').style.display='none';document.getElementById('ud').style.display='block';document.getElementById('ual').textContent=(curUser.name||'U')[0].toUpperCase();document.getElementById('udn').textContent=curUser.name;}
  applyI18N(); rAll();
  // Auto-save logged in user
  setInterval(()=>{if(curUser){localStorage.setItem('nexus_cur_user_email',curUser._email);}},5000);
  // Save on page unload
  window.addEventListener('beforeunload',()=>{saveSession();});
  // Close dropdowns on outside click
  document.addEventListener('click',(e)=>{if(!e.target.closest('.ld'))document.getElementById('lm').classList.remove('show');if(!e.target.closest('.ud'))document.getElementById('um').classList.remove('show');if(!e.target.closest('.nfb'))document.getElementById('np').classList.remove('show');});
});
