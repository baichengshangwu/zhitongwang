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
