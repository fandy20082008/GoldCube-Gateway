// VOZEB PRO redesign · shared interactions
(function(){
  const $ = (s, r) => (r||document).querySelector(s);
  const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));
  const EYE = { on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>', off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="m1 1 22 22"/></svg>' };

  // ---- toast ----
  window.toast = function(msg, type){
    type = type || 'ok';
    let wrap = $('#toasts');
    if(!wrap){ wrap = document.createElement('div'); wrap.className='toast-wrap'; wrap.id='toasts'; document.body.appendChild(wrap); }
    const icon = type==='ok' ? '<svg viewBox="0 0 24 24" fill="none" stroke="#12B886" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : type==='warn' ? '<svg viewBox="0 0 24 24" fill="none" stroke="#F59F00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>';
    const t = document.createElement('div'); t.className='toast '+type; t.innerHTML = icon + '<span>'+msg+'</span>';
    wrap.appendChild(t);
    setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(), 320); }, 2600);
  };

  // ---- modal ----
  window.openModal = id => { const o=$('#'+id); if(o){ o.classList.add('open'); o.setAttribute('aria-hidden','false'); } };
  window.closeModal = id => { const o=$('#'+id); if(o) o.classList.remove('open'); };
  document.addEventListener('click', e => { const t = e.target.closest('[data-modal]'); if (t) window.openModal(t.dataset.modal); });
  $$('.overlay').forEach(ov => {
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('open'); });
    $$('.close', ov).forEach(c => c.addEventListener('click', () => ov.classList.remove('open')));
    const btn = $('[data-confirm]', ov);
    if(btn) btn.addEventListener('click', () => ov.classList.remove('open'));
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') $$('.overlay.open').forEach(o => o.classList.remove('open')); });

  // ---- collapsible panel ----
  window.toggleCollapse = function(id){ var p = document.getElementById(id); if(!p) return; p.classList.toggle('collapsed'); var c = p.querySelector('.collapse-caret'); if(c) c.style.transform = p.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)'; };

  // ---- avatar dropdown ----
  const av = $('#userMenuBtn'), dd = $('#userMenu');
  if(av && dd){
    av.addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
    document.addEventListener('click', e => { if(dd.classList.contains('open') && !dd.contains(e.target) && e.target!==av && !av.contains(e.target)) dd.classList.remove('open'); });
  }

  // ---- password visibility ----
  $$('.pw-toggle').forEach(b => b.addEventListener('click', () => {
    const i = $('input', b.parentElement);
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.innerHTML = show ? EYE.off : EYE.on;
  }));

  // ---- generic: chips fill input in same panel ----
  $$('.chips').forEach(chipWrap => chipWrap.addEventListener('click', e => {
    const chip = e.target.closest('.chip'); if(!chip) return;
    const box = chipWrap.closest('.chip-input');
    if(box){ const inp = $('input', box); if(inp){ inp.value = chip.dataset.t || chip.textContent.trim(); inp.focus(); } }
  }));
})();


// ---- GoldCube 0.2 backend bridge ----
(function(){
  const json = async (url, init) => {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store', ...(init || {}) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.msg || payload.error || '请求失败');
    return payload;
  };
  const api = {
    request: json,
    register: (body) => json('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    session: () => json('/api/auth/session'),
    logout: () => json('/api/auth/logout', { method: 'POST' }),
    overview: () => json('/api/create/overview'),
    points: (q) => json('/api/points?' + new URLSearchParams(q || {})),
    assets: (q) => json('/api/library-assets?' + new URLSearchParams(q || { page: 1, pageSize: 100 })),
    canvas: (q) => json('/api/canvas/projects?' + new URLSearchParams(q || { page: 1, pageSize: 100 })),
    drama: (q) => json('/api/drama/projects?' + new URLSearchParams(q || { page: 1, pageSize: 100 })),
    works: (q) => json('/api/works?' + new URLSearchParams(q || { page: 1, pageSize: 100 })),
    gallery: (q) => json('/api/public/gallery?' + new URLSearchParams(q || { limit: 12 })),
    prompts: (q) => json('/api/prompts?' + new URLSearchParams(q || { page: 1, pageSize: 100 })),
    myPrompts: (q) => json('/api/my-prompts?' + new URLSearchParams(q || { page: 1, pageSize: 100 })),
    createPrompt: (body) => json('/api/my-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    skills: () => json('/api/agent/skills'),
    logicalModels: () => json('/api/site/logical-models'),
    optimize: (prompt, options) => json('/api/agent/prompt-optimization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: (options && options.requestId) || ('goldcube-opt-' + Date.now()), prompt: prompt, mode: (options && options.mode) || 'agent' }) }),
    createRun: (body) => json('/api/agent/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    getRun: (id) => json('/api/agent/runs/' + encodeURIComponent(id)),
    createCanvas: (body) => json('/api/canvas/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    createDrama: (body) => json('/api/drama/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    saveAsset: (body) => json('/api/library-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    uploadReference: (body) => json('/api/reference-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    deleteAsset: (id) => json('/api/library-assets/' + encodeURIComponent(id), { method: 'DELETE' }),
    profile: (body) => json('/api/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    billingProducts: () => json('/api/billing/products'),
    billingCoupons: () => json('/api/billing/coupons'),
    billingOrders: (q) => json('/api/billing/orders?' + new URLSearchParams(q || { page: 1, pageSize: 20 })),
    createOrder: (body) => json('/api/billing/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    checkout: (id, body) => json('/api/billing/orders/' + encodeURIComponent(id) + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }),
    cancelOrder: (id) => json('/api/billing/orders/' + encodeURIComponent(id) + '/cancel', { method: 'POST' }),
  };
  window.gcApi = api;
  window.gcSession = null;

  function initials(user){ return ((user && (user.displayName || user.username)) || 'GC').trim().split(/\s+/).map(function(x){ return x[0]; }).join('').slice(0,2).toUpperCase(); }
  function setText(selector, value){ document.querySelectorAll(selector).forEach(function(el){ el.textContent = String(value); }); }
  function formatDate(value){ try { return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit'}).format(new Date(value)); } catch { return ''; } }
  function showError(message){ if(window.toast) window.toast(message || '请求失败','error'); }

  async function hydrateCommon(){
    const privatePages = {
      'create.html':1,'canvas.html':1,'canvas-detail.html':1,'drama.html':1,'drama-detail.html':1,
      'assets.html':1,'works.html':1,'community.html':1,'prompts.html':1,'my-prompts.html':1,
      'me.html':1,'profile.html':1,'billing.html':1,'billing-checkout.html':1,
      'billing-success.html':1,'billing-cancel.html':1,'help.html':1
    };
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    try {
      const payload = await api.session();
      window.gcSession = payload;
      const user = payload && payload.user;
      if(!user){
        if(privatePages[page]){
          const next = page + location.search + location.hash;
          location.replace('login.html?next=' + encodeURIComponent(next));
        }
        return null;
      }
      setText('.points-pill', '✦ ' + (user.pointsBalance == null ? 0 : user.pointsBalance));
      document.querySelectorAll('.avatar').forEach(function(el){ el.textContent = initials(user); el.title = user.displayName || user.username || ''; });
      document.querySelectorAll('.tb-search input').forEach(function(el){ el.setAttribute('aria-label','搜索'); });
      document.querySelectorAll('.dd-item.danger').forEach(function(btn){
        if(btn.dataset.gcBound) return; btn.dataset.gcBound='1';
        btn.addEventListener('click', async function(e){ e.preventDefault(); try { await api.logout(); window.gcSession=null; toast('已安全退出登录','ok'); setTimeout(function(){ location.href='login.html'; },350); } catch(err){ showError(err.message); } });
      });
      return user;
    } catch(err){ return null; }
  }

  function renderAssetCard(asset){
    const kind = asset.kind || 'image'; const data = asset.data || {}; const url = asset.coverUrl || data.serverUrl || data.url || data.remoteUrl || data.dataUrl || '';
    const media = url ? (kind === 'video' ? '<video muted playsinline src="'+url+'"></video>' : kind === 'audio' ? '<div class="art a5"></div>' : '<img loading="lazy" src="'+url+'" alt="">') : '<div class="art a1"></div>';
    const meta = [data.mimeType || kind, data.bytes ? Math.ceil(data.bytes/1024)+' KB' : ''].filter(Boolean).join(' · ');
    return '<div class="item-card gc-real-asset" data-asset-id="'+(asset.id||'')+'"><div class="item-thumb" style="aspect-ratio:1">'+media+'</div><div class="item-body"><div class="t">'+(asset.title||'未命名素材')+'</div><div class="m">'+(meta || formatDate(asset.createdAt))+'</div></div></div>';
  }

  async function hydrateCreate(){
    const p = await api.overview().catch(function(){ return null; }); if(!p || !p.data || !p.data.overview) return;
    const o=p.data.overview;
    const stats=document.querySelectorAll('.stat-row .stat-card');
    if(stats[1] && window.gcSession && window.gcSession.user){ stats[1].querySelector('b').textContent=window.gcSession.user.pointsBalance || 0; stats[1].querySelector('span:last-child').textContent='今日 '+(window.gcSession.user.dailyPointsBalance||0)+' · 永久 '+(window.gcSession.user.permanentPointsBalance||0); }
    if(stats[2]) stats[2].querySelector('b').textContent=(o.recentAssets||[]).length;
    if(stats[3]) stats[3].querySelector('b').textContent=o.latestProject ? '1' : '0';
    const grid=document.getElementById('genGrid');
    if(grid && Array.isArray(o.recentAssets) && o.recentAssets.length){ grid.innerHTML=o.recentAssets.map(renderAssetCard).join(''); }
    const latest=document.querySelector('.panel .item-card .t');
    if(latest && o.latestProject) latest.textContent=o.latestProject.title;
    // 模型下拉：从云端 logicalModels 动态渲染
    await hydrateModelList();
  }

  function renderModelButton(model, isDefault){
    var cap = (model.capability || 'text');
    var name = model.name || model.id;
    var desc = (cap === 'image') ? '图片模型' : (cap === 'video') ? '视频模型' : (cap === 'audio') ? '音频模型' : (cap === 'text') ? '文本模型' : (cap + ' 模型');
    var bindingCount = (model.bindings || []).length;
    var binding = bindingCount ? (' · ' + bindingCount + ' 渠道') : '';
    return '<button class="opt' + (isDefault ? ' on' : '') + '" data-m="' + (model.id || '') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4-4-7 7"/></svg>'
      + name + '<span style="margin-left:auto;font-size:11px;color:var(--ink-3)">' + desc + binding + '</span></button>';
  }

  function wireModelPop(){
    var pop = document.getElementById('modelPop'); if(!pop) return;
    pop.querySelectorAll('.opt').forEach(function(o){
      o.addEventListener('click', function(){
        pop.querySelectorAll('.opt').forEach(function(x){ x.classList.remove('on'); });
        o.classList.add('on');
        var btn = document.getElementById('modelBtn');
        if(btn) btn.innerHTML = '智能模型 <span class="mono" style="font-size:11px;color:var(--ink-3)">· ' + (o.dataset.m || '') + ' ▾</span>';
        if(window.toast) window.toast('已切换模型：' + (o.dataset.m || ''), 'ok');
        pop.classList.remove('open');
      });
    });
  }

  async function hydrateModelList(){
    var list = document.getElementById('modelList');
    if(!list) return;
    var payload;
    try { payload = await api.logicalModels(); } catch(err){
      list.innerHTML = '<div class="empty" style="padding:18px"><div class="t">模型列表加载失败</div><div class="s">' + (err && err.message ? err.message : '稍后重试') + '</div></div>';
      return;
    }
    var data = (payload && payload.data) || payload;
    var models = (data && data.logicalModels) || [];
    var defaults = (data && data.defaultModels) || {};
    var enabled = models.filter(function(m){ return m && m.enabled !== false; });
    if(!enabled.length){
      list.innerHTML = '<div class="empty" style="padding:18px"><div class="t">暂无可用模型</div><div class="s">请到云端后台启用模型</div></div>';
      return;
    }
    // 默认选 defaultModels.textModel（或 imageModel 当 text 不可用）
    var defaultId = defaults.textModel || defaults.imageModel || defaults.videoModel || defaults.audioModel || enabled[0].id;
    list.innerHTML = enabled.map(function(m){ return renderModelButton(m, m.id === defaultId); }).join('');
    wireModelPop();
  }

  async function hydrateAssets(){
    const grid=document.querySelector('main.page > .grid4'); if(!grid) return;
    const p=await api.assets({page:1,pageSize:100}).catch(function(){return null;}); if(!p || !p.data) return;
    const list=p.data.assets||[];
    const stats=document.querySelectorAll('.stat-row .stat-card'); const counts={image:0,video:0,audio:0}; list.forEach(function(a){if(counts[a.kind]!=null)counts[a.kind]++;});
    if(stats[0]) stats[0].querySelector('b').textContent=counts.image; if(stats[1]) stats[1].querySelector('b').textContent=counts.video; if(stats[2]) stats[2].querySelector('b').textContent=counts.audio;
    grid.innerHTML=list.length ? list.map(renderAssetCard).join('') : '<div class="empty" style="grid-column:1/-1;padding:60px 20px"><div class="t">暂无素材</div><div class="s">上传或生成内容后会显示在这里</div></div>';
  }

  function renderProjectCard(p, type){
    const href=type==='canvas'?'canvas-detail.html?id='+encodeURIComponent(p.id):'drama-detail.html?id='+encodeURIComponent(p.id);
    return '<a class="item-card gc-real-project" href="'+href+'" style="display:block"><div class="item-thumb"><div class="art '+(type==='canvas'?'a3':'a5')+'"></div></div><div class="item-body"><div class="t">'+(p.title||'未命名项目')+'</div><div class="m">'+(p.nodeCount!=null?p.nodeCount+' 个节点 · ':'')+formatDate(p.updatedAt||p.createdAt)+'</div></div></a>';
  }
  async function hydrateProjects(type){
    const grid=document.querySelector('main.page .grid3'); if(!grid) return;
    const p=await (type==='canvas'?api.canvas():api.drama()).catch(function(){return null;}); if(!p || !p.data) return;
    const list=p.data.projects||[]; grid.innerHTML=list.length?list.map(function(x){return renderProjectCard(x,type);}).join(''):'<div class="empty" style="grid-column:1/-1;padding:60px 20px"><div class="t">暂无项目</div><div class="s">点击右上角新建项目开始创作</div></div>';
  }
  async function hydratePrompts(my){
    const grid=document.querySelector('main.page .grid4, main.page .grid3'); if(!grid) return;
    const p=await (my?api.myPrompts():api.prompts()).catch(function(){return null;}); if(!p) return;
    const list=(p.items||p.data&&p.data.items||[]); if(!list.length) return;
    grid.innerHTML=list.map(function(x){return '<div class="item-card gc-real-prompt" data-prompt="'+encodeURIComponent(x.prompt||'')+'"><div class="item-thumb"><img loading="lazy" src="'+(x.coverUrl||'')+'" alt=""></div><div class="item-body"><div class="t">'+(x.title||'未命名提示词')+'</div><div class="m">'+(x.category||'提示词')+' · '+formatDate(x.updatedAt||x.createdAt)+'</div></div></div>';}).join('');
  }
  async function hydrateBilling(){
    const p=await api.billingProducts().catch(function(){return null;});
    const products=p && (p.products||p.data&&p.data.products)||[];
    document.querySelectorAll('[data-product-id]').forEach(function(el){var id=el.dataset.productId;var x=products.find(function(a){return a.id===id;});if(x){var price=el.querySelector('[data-price]');if(price)price.textContent='¥'+(x.amountCents/100).toFixed(2);}});
    const o=await api.billingOrders({page:1,pageSize:20}).catch(function(){return null;});
    const orders=o && (o.orders||o.data&&o.data.orders)||[]; const body=document.getElementById('billingOrdersBody');
    if(body){body.innerHTML=orders.length?orders.map(function(x){var prod=products.find(function(p0){return p0.id===x.productId});var status=x.status==='paid'?'支付成功':x.status==='pending'?'待确认':x.status==='canceled'?'已取消':x.status==='closed'?'已关闭':x.status;return '<tr><td><b>'+((prod&&prod.name)||x.subject||'套餐')+'</b></td><td class="mono">'+(x.orderNo||'—')+'</td><td>'+((x.provider||'manual')==='manual'?'人工确认':x.provider)+'</td><td>¥'+((x.amountCents||0)/100).toFixed(2)+'</td><td>'+((x.pointsAmount||0).toLocaleString())+' 积分 · '+(x.periodDays||0)+' 天</td><td><span class="badge '+(x.status==='paid'?'badge-ok':x.status==='pending'?'badge-warn':'badge-muted')+'">'+status+'</span></td><td class="mono">'+formatDate(x.createdAt)+'</td></tr>';}).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--ink-3);padding:24px">暂无订单</td></tr>';}
  }
  async function hydrateProfile(){
    const user=window.gcSession&&window.gcSession.user; if(!user)return;
    document.querySelectorAll('[data-profile-name]').forEach(function(el){el.textContent=user.displayName||user.username;});
    document.querySelectorAll('[data-profile-username]').forEach(function(el){el.textContent='@'+user.username;});
  }

  document.addEventListener('click', function(e){
    const promptCard=e.target.closest('.gc-real-prompt'); if(promptCard){ const p=decodeURIComponent(promptCard.dataset.prompt||''); if(p && document.getElementById('ideaInput')){document.getElementById('ideaInput').value=p; toast('已填入提示词','ok');}}
  });
  (async function(){
    const user=await hydrateCommon(); if(!user) return;
    const title=(document.querySelector('main h1')||{}).textContent||'';
    if(location.pathname.endsWith('create.html')) await hydrateCreate();
    else if(location.pathname.endsWith('assets.html')) await hydrateAssets();
    else if(location.pathname.endsWith('canvas.html')) await hydrateProjects('canvas');
    else if(location.pathname.endsWith('drama.html')) await hydrateProjects('drama');
    else if(location.pathname.endsWith('prompts.html')) await hydratePrompts(false);
    else if(location.pathname.endsWith('my-prompts.html')) await hydratePrompts(true);
    else if(location.pathname.endsWith('billing.html')) await hydrateBilling();
    else if(location.pathname.endsWith('profile.html')) await hydrateProfile();
  })();
})();


// ---- GoldCube 0.2 real mutations and page wiring ----
(function(){
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function setBusy(btn,busy,label){ if(!btn)return; btn.disabled=busy; if(busy){btn.dataset.gcLabel=btn.textContent;btn.textContent=label||'处理中…';}else if(btn.dataset.gcLabel){btn.textContent=btn.dataset.gcLabel;delete btn.dataset.gcLabel;} }
  function fileToDataUrl(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result||''));};r.onerror=reject;r.readAsDataURL(file);});}

  // Keep prompt state when entering the workspace from a prompt card.
  if(location.pathname.endsWith('create.html')){
    var idea=document.getElementById('ideaInput'); var qp=new URLSearchParams(location.search).get('prompt');
    if(idea && qp && !idea.value) idea.value=qp;
  }

  // Load real library assets into the create-page reference picker and preserve selected IDs.
  if(location.pathname.endsWith('create.html') && document.getElementById('assetsOv')){
    window.gcSelectedAssetIds=window.gcSelectedAssetIds||[];
    (async function(){
      try{
        var picker=document.getElementById('assetsOv'), grid=picker.querySelector('.modal-body .grid4');
        var result=await window.gcApi.assets({page:1,pageSize:100});
        var list=result&&result.data&&result.data.assets||[];
        if(grid && list.length){
          grid.innerHTML=list.map(renderAssetCard).join('');
          grid.addEventListener('click',function(e){
            var card=e.target.closest('.gc-real-asset'); if(!card)return;
            var id=card.dataset.assetId; if(!id)return;
            var pos=window.gcSelectedAssetIds.indexOf(id);
            if(pos>=0){window.gcSelectedAssetIds.splice(pos,1);card.style.outline='';toast('已取消引用：'+(card.querySelector('.t')||{}).textContent,'ok');}
            else{window.gcSelectedAssetIds.push(id);card.style.outline='2px solid var(--accent)';toast('已加入引用：'+(card.querySelector('.t')||{}).textContent,'ok');}
          });
        }
      }catch(e){}
    })();
  }

  // Upload a persistent library asset through the same reference-asset backend used by VOZEB.
  var uploadBtn=document.getElementById('uploadAssetBtn');
  if(uploadBtn){
    var fileInput=document.createElement('input'); fileInput.type='file'; fileInput.accept='image/*,video/*,audio/*'; fileInput.hidden=true; document.body.appendChild(fileInput);
    uploadBtn.addEventListener('click',function(){fileInput.click();});
    fileInput.addEventListener('change',async function(){var file=fileInput.files&&fileInput.files[0];if(!file)return;try{setBusy(uploadBtn,true,'上传中…');var type=file.type.indexOf('video/')===0?'video':file.type.indexOf('audio/')===0?'audio':'image';var dataUrl=await fileToDataUrl(file);var uploaded=await window.gcApi.uploadReference({dataUrl:dataUrl,type:type,persistent:true,originalName:file.name});await window.gcApi.saveAsset({kind:type,title:file.name,source:'user-upload',tags:[],data:{storageKey:uploaded.key||uploaded.token,serverUrl:uploaded.url,bytes:uploaded.bytes||file.size,mimeType:uploaded.mimeType||file.type}});toast('素材已上传并加入素材库','ok');if(location.pathname.endsWith('assets.html')||location.pathname.endsWith('create.html'))location.reload();}catch(e){toast(e.message||'素材上传失败','error');}finally{setBusy(uploadBtn,false);fileInput.value='';}});
  }

  // Save a prompt from the public prompt library to the real personal library.
  document.addEventListener('click',async function(e){
    var save=e.target.closest('[data-save]'); if(save && !save.dataset.gcBound){save.dataset.gcBound='1';e.preventDefault();e.stopImmediatePropagation();var card=save.closest('.item-card');var title=card&&card.querySelector('.t')?card.querySelector('.t').textContent.replace(/\s+/g,' ').trim():'未命名提示词';var body=card&&card.dataset.prompt?decodeURIComponent(card.dataset.prompt):title;try{setBusy(save,true,'保存中…');await window.gcApi.createPrompt({title:title,prompt:body,category:'品牌内容',tags:[]});toast('已加入我的词库','ok');}catch(err){toast(err.message||'保存提示词失败','error');}finally{setBusy(save,false);}}
  });

  // Create a personal prompt from the add-prompt modal.
  var apSave=document.getElementById('apSave'); if(apSave){apSave.addEventListener('click',async function(){var n=(document.getElementById('apName').value||'').trim()||'未命名提示词';var body=(document.getElementById('apBody').value||'').trim();if(!body){toast('请填写提示词内容','warn');return;}try{setBusy(apSave,true,'保存中…');await window.gcApi.createPrompt({title:n,prompt:body,category:'品牌内容',tags:[]});closeModal('addPromptOv');toast('已保存到词库：'+n,'ok');}catch(e){toast(e.message||'保存提示词失败','error');}finally{setBusy(apSave,false);}});}

  // Real project creation is handled by the modal scripts; this keeps list reloads consistent.
  var refresh=document.querySelector('.page-actions .btn-ghost'); if(refresh && (location.pathname.endsWith('canvas.html')||location.pathname.endsWith('drama.html')||location.pathname.endsWith('billing.html'))){refresh.addEventListener('click',function(){location.reload();});}
})();


// ---- Billing checkout / order lifecycle ----
(function(){
  if(location.pathname.endsWith('billing-checkout.html')){
    var query=new URLSearchParams(location.search), productId=query.get('productId')||'creator-monthly';
    var confirmBtn=document.getElementById('confirmPay'), cancelLink=document.getElementById('cancelOrderLink');
    (async function(){try{var data=await window.gcApi.billingProducts();var products=data.products||data.data&&data.data.products||[];var product=products.find(function(x){return x.id===productId})||products[0];if(product){var name=document.querySelector('.item-card .t');var meta=document.querySelector('.item-card .m');var amounts=document.querySelectorAll('.panel-body > div[style*="justify-content"] span:last-child');if(name)name.textContent=product.name;if(meta)meta.textContent=(product.pointsAmount||0).toLocaleString()+' 创作积分 · '+(product.periodDays||0)+' 天权益';if(amounts[1])amounts[1].textContent='¥ '+((product.amountCents||0)/100).toFixed(2);if(amounts[2])amounts[2].textContent='¥ '+((product.amountCents||0)/100).toFixed(2);}}catch(e){toast(e.message||'套餐信息加载失败','error');}})();
    if(confirmBtn)confirmBtn.addEventListener('click',async function(){var selected=document.querySelector('input[name="pay"]:checked');var all=Array.from(document.querySelectorAll('input[name="pay"]'));var provider=(selected&&all.indexOf(selected)===0)?'manual':'';if(!provider){toast('当前仅支持人工确认支付','warn');return;}try{setBusy(confirmBtn,true,'下单中…');var created=await window.gcApi.createOrder({productId:productId,provider:provider,quantity:1});var order=created&&created.order||created&&created.data&&created.data.order;if(!order)throw new Error('订单创建失败');await window.gcApi.checkout(order.id,{provider:provider});location.href='billing.html?orderId='+encodeURIComponent(order.id);}catch(e){toast(e.message||'创建订单失败','error');}finally{setBusy(confirmBtn,false);}});
    if(cancelLink)cancelLink.addEventListener('click',function(e){var orderId=query.get('orderId');if(orderId){e.preventDefault();window.gcApi.cancelOrder(orderId).then(function(){location.href='billing.html?canceled=1';}).catch(function(err){toast(err.message||'取消订单失败','error');});}});
  }
  if(location.pathname.endsWith('billing.html')){var q2=new URLSearchParams(location.search);if(q2.get('orderId'))setTimeout(function(){toast('订单已创建，等待人工确认开通','ok');},500);if(q2.get('canceled'))setTimeout(function(){toast('订单已取消，未产生扣费','ok');},500);}
})();
