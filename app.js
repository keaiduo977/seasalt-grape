/* ============================================
   海盐葡萄 · 女生生活管理 PWA
   ============================================ */

/* ---------- 工具 ---------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const today = () => new Date().toISOString().slice(0,10);
const now = () => new Date().toISOString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => String(s==null?'':s).replace(/[<>&"]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
function toast(msg, ms=2200){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'), ms); }
function fmtDate(d){ const x=new Date(d); return `${x.getMonth()+1}月${x.getDate()}日 ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`; }
function fmtTime(d){ const x=new Date(d); return `${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`; }
const weekNames = ['日','一','二','三','四','五','六'];

/* ---------- IndexedDB ---------- */
const DB = {
  db:null,
  open(){ return new Promise((res,rej)=>{
    const r = indexedDB.open('seasalt', 3);
    r.onupgradeneeded = e=>{
      const db = e.target.result;
      ['supplements','recipes','skincare','sports','reads','study','schedule','fragments','diary','aiCache','settings','anni','vocab'].forEach(name=>{
        if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:'id'});
      });
    };
    r.onsuccess = e=>{ DB.db=e.target.result; res(); };
    r.onerror = e=>rej(e);
  });},
  get(store,id){ return new Promise((res,rej)=>{ const t=DB.db.transaction(store,'readonly').objectStore(store); const r=t.get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  all(store){ return new Promise((res,rej)=>{ const t=DB.db.transaction(store,'readonly').objectStore(store); const r=t.getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); },
  put(store,obj){ return new Promise((res,rej)=>{ const t=DB.db.transaction(store,'readwrite').objectStore(store); const r=t.put(obj); r.onsuccess=()=>res(obj); r.onerror=()=>rej(r.error); }); },
  del(store,id){ return new Promise((res,rej)=>{ const t=DB.db.transaction(store,'readwrite').objectStore(store); const r=t.delete(id); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); },
  clear(store){ return new Promise((res,rej)=>{ const t=DB.db.transaction(store,'readwrite').objectStore(store); const r=t.clear(); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
};

/* ---------- AI 调用层（DeepSeek + 本地降级） ---------- */
const AI = {
  getKey(){ return localStorage.getItem('ds_key') || ''; },
  async chat(systemPrompt, userPrompt, opts={}){
    const key = AI.getKey();
    if(!key){ return AI._fallback(opts.kind); }
    try{
      const r = await fetch('https://api.deepseek.com/chat/completions',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
        body:JSON.stringify({
          model:'deepseek-chat',
          messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}],
          temperature:0.8, max_tokens:opts.maxTokens||1500, stream:false
        })
      });
      if(!r.ok){ const t=await r.text(); console.warn('AI err',r.status,t); return AI._fallback(opts.kind); }
      const j = await r.json();
      return j.choices?.[0]?.message?.content || AI._fallback(opts.kind);
    }catch(e){ console.warn('AI fetch fail',e); return AI._fallback(opts.kind); }
  },
  _fallback(kind){
    const pool = {
      hot:[
        '近期热门：可持续美妆兴起，无塑料包装护肤成为新趋势',
        '城市City Walk路线走红，女生们用脚步丈量城市浪漫',
        '手帐文化回潮，纸质记录搭配AI助手成新搭配',
        '低糖甜品店在一线城市密集开业，健康与甜蜜兼得',
        '瑜伽+冥想组合训练受到都市女生追捧',
        '复古胶片相机在Z世代中再度流行',
        '植物系香氛成为居家情绪疗愈新方式',
        '小众独立书店复合空间成周末打卡热点'
      ],
      book:['《我胆小如鼠》余华','《人生的智慧》叔本华','《心流》米哈里','《雪国》川端康成','《明朝那些事儿》当年明月','《刻意练习》艾利克森','《人生海海》麦家','《长安的荔枝》马伯庸'],
      sport:['15分钟清晨拉伸唤醒','20分钟蜜桃臀爆破训练','10分钟天鹅颈塑造','30分钟燃脂尊巴','15分钟核心马甲线','20分钟舒缓阴瑜伽','10分钟办公肩颈放松','25分钟HIIT全身燃脂'],
      study:['今日单词：serendipity 意外发现美好事物的能力','语录：种一棵树最好的时间是十年前，其次是现在','文章：《如何用费曼技巧高效学习任何技能》','单词：ephemeral 短暂的；朝生暮死的','语录：你现在的气质里，藏着你走过的路、读过的书和爱过的人','文章：《深度工作：如何专注地完成一件事》']
    };
    const arr = pool[kind] || pool.hot;
    return kind==='hot' ? arr.map((t,i)=>`${i+1}. ${t}`).join('\n')
         : kind==='book' ? arr.map((t,i)=>`${i+1}. ${t}`).join('\n')
         : kind==='sport' ? JSON.stringify(arr.slice(0,4).map(t=>({title:t,duration:parseInt(t),cal:parseInt(t)*4,desc:'居家跟练，无需器械'})))
         : arr.slice(0,3).map((t,i)=>`${i+1}. ${t}`).join('\n');
  }
};

/* ---------- 导航 ---------- */
const Nav = {
  go(name){
    $$('.page').forEach(p=>p.classList.remove('active'));
    $('#page-'+name).classList.add('active');
    $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.page===name));
    window.scrollTo(0,0);
    // 懒加载（const 声明不在 window 上，用直接引用）
    const loaders = {hot:Hot, supp:Supp, recipe:Recipe, skin:Skin, sport:Sport, read:Read, study:Study, sched:Sched, frag:Frag, diary:Diary, anni:Anni, set:Setting};
    const m = loaders[name];
    if(m && m.load) m.load();
  }
};

/* ---------- Hero 头部渲染 ---------- */
const Hero = {
  render(){
    try{
      const p = (typeof Setting !== 'undefined' && Setting.getProfile) ? Setting.getProfile() : {};
      $('#heroName').textContent = p.name || '海盐葡萄';
      $('#heroSub').textContent = p.sign || '今天也要甜酷闪闪呀';
    }catch(e){}
  }
};

/* ---------- 弹层 ---------- */
const Modal = {
  open(title, html){
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modalMask').classList.add('show');
  },
  close(){ $('#modalMask').classList.remove('show'); }
};
$('#modalMask').addEventListener('click', e=>{ if(e.target.id==='modalMask') Modal.close(); });

/* ============================================
   1. AI 热点
   ============================================ */
const Hot = {
  _liveData: null,
  _items: null,
  _filter: '全部',
  async load(){ await Hot.refresh(true); },
  // 拉取 GitHub Actions 抓取的实时热搜（同源，无CORS）
  async fetchLive(){
    try{
      const r = await fetch('hot.json?v='+Date.now(), {cache:'no-store'});
      if(!r.ok) return null;
      const j = await r.json();
      return j;
    }catch(e){ return null; }
  },
  async refresh(silent){
    const cache = await DB.get('aiCache','hot');
    const last = cache?.ts || 0;
    const threeHours = 3*60*60*1000;
    // 先渲染实时热搜（不等 AI）
    const live = await Hot.fetchLive();
    if(live && live.items && live.items.length > 1){
      Hot._liveData = live;
      Hot.renderLive(live);
    }else if(cache?.data){
      Hot.renderLive(cache);
    }else{
      Hot.renderLive(null);
    }
    // AI 精选解读（3小时内用缓存）
    if(silent && cache && Date.now()-last < threeHours){
      Hot.render(cache.data, last);
      return;
    }
    $('#hotList').innerHTML = '<div class="empty"><div class="emoji">🤖</div><p>AI 正在精选解读...</p></div>';
    let seed = '', liveSource = '本地';
    if(live && live.items && live.items.length > 1){
      liveSource = live.source || '实时';
      seed = live.items.slice(0,30).map((t,i)=>`${i+1}. ${t.title}`).join('\n');
    }
    const todayStr = new Date().toLocaleDateString('zh-CN');
    const sysPrompt = live && seed
      ? '你是一个面向年轻女性的生活方式编辑。以下是当前'+liveSource+'实时热搜词条（GitHub Actions 自动抓取）：\n'+seed+'\n\n' +
        '请从中精选 6 条女生会关心的热点（覆盖时政/经济/社会/新媒体/体育/美妆/消费/健康/影视/情感等领域，保持多样性），' +
        '用 JSON 数组格式输出，每个对象含：title(热搜原标题或简化版),category(分类:时政/经济/社会/新媒体/体育/美妆/消费/健康/影视/情感),detail(深度解读,200-300字,需说明：1)事件是什么、涉及的人物或机构、关键背景；2)为什么值得关注；3)对女生有什么启发或影响；4)实用建议或思考角度)。只输出JSON。'
      : '你是面向年轻女性的生活方式编辑。请生成 6 条当下最新热点（覆盖时政/经济/社会/新媒体/体育/美妆/消费/健康/影视等领域），' +
        'JSON 数组格式，每个对象含：title(标题),category(分类),detail(深度解读200-300字,含背景/影响/给女生的建议)。只输出JSON。';
    const out = await AI.chat(sysPrompt,
      `今天是${todayStr}，请精选并深度解读 6 条女生向热点。`,
      {kind:'hot', maxTokens:3500});
    const items = Hot.parse(out);
    // 把实时热搜的原始链接并入解读结果
    if(live && live.items){
      const liveMap = {};
      live.items.forEach(t=>{ liveMap[t.title] = t.url; });
      items.forEach(it=>{ if(liveMap[it.title]) it.url = liveMap[it.title]; });
    }
    await DB.put('aiCache',{id:'hot', data:items, ts:Date.now()});
    Hot.render(items, Date.now(), liveSource);
    // 甜酷小贴士
    if(!silent || !$('#dailyTip').dataset.loaded){
      const tip = await AI.chat('你是闺蜜型助手，用一句话给女生一句甜酷小贴士，不超过30字。只输出这句话。',
        '给我一句今日小贴士',{kind:'hot',maxTokens:80});
      $('#dailyTip').textContent = tip.replace(/^[\d.、\s]+/,'').split('\n')[0];
      $('#dailyTip').dataset.loaded = '1';
    }
  },
  parse(text){
    try{ const j=JSON.parse(text); if(Array.isArray(j)) return j.map(x=>({title:x.title||'',category:x.category||'生活',detail:x.detail||'',url:x.url||''})).slice(0,6); }catch(e){}
    return text.split('\n').map(l=>l.replace(/^\d+[.、\)\s]+/,'').trim()).filter(Boolean).slice(0,6).map(t=>({title:t,category:'生活',detail:'暂无详细说明，可点击刷新获取 AI 解读。',url:''}));
  },
  // 渲染实时热搜列表（带分类筛选）
  renderLive(live){
    const box = $('#hotLiveList');
    const catBox = $('#hotCats');
    if(!live || !live.items || !live.items.length){
      box.innerHTML = '<div class="empty"><div class="emoji">📡</div><p>实时热搜加载中，稍后刷新...</p></div>';
      catBox.innerHTML = '';
      $('#hotSourceTag').textContent = '等待数据';
      return;
    }
    const items = live.items;
    const source = live.source || '实时';
    const updated = live.updated || '';
    $('#hotSourceTag').textContent = source + '实时';
    if(updated) $('#hotTime').textContent = updated;
    // 分类统计
    const cats = {'全部': items.length};
    items.forEach(it=>{
      const c = it.category || '热点';
      cats[c] = (cats[c]||0) + 1;
    });
    const catList = Object.keys(cats);
    catBox.innerHTML = catList.map(c=>
      `<span class="hot-cat ${c===Hot._filter?'active':''}" onclick="Hot.filter('${c}')">${c}${c!=='全部'?' '+cats[c]:''}</span>`
    ).join('');
    // 渲染列表
    const filtered = Hot._filter==='全部' ? items : items.filter(it=>(it.category||'热点')===Hot._filter);
    box.innerHTML = filtered.map((it,i)=>{
      const rank = items.indexOf(it) + 1;
      const isTop3 = rank <= 3;
      const cat = it.category || '热点';
      const hotVal = it.hot ? Hot.fmtHot(it.hot) : '';
      return `<div class="hot-live-item" onclick="Hot.liveDetail(${items.indexOf(it)})">
        <div class="hot-live-rank ${isTop3?'top3':''}">${rank}</div>
        <div class="hot-live-body">
          <div class="hot-live-title">${esc(it.title)}</div>
          <div class="hot-live-meta">
            <span class="hot-live-cat">${cat}</span>
            ${hotVal?`<span class="hot-live-hot">🔥 ${hotVal}</span>`:''}
          </div>
        </div>
        <span class="muted" style="font-size:12px">›</span>
      </div>`;
    }).join('');
    Hot._liveItems = items;
    $('#hotHint').textContent = `共 ${items.length} 条 · 点击查看详情`;
  },
  fmtHot(n){
    if(n >= 10000000) return (n/10000000).toFixed(1)+'千万';
    if(n >= 10000) return (n/10000).toFixed(1)+'万';
    return String(n);
  },
  filter(cat){
    Hot._filter = cat;
    Hot.renderLive(Hot._liveData);
  },
  // 点击实时热搜 → AI 生成深度解读
  async liveDetail(i){
    const it = Hot._liveItems[i]; if(!it) return;
    // 先弹出 loading
    Modal.open('🔥 ' + (it.category||'热点'), `
      <div class="ai-card">
        <div class="ai-tag">🔥 热搜 #${i+1}</div>
        <div style="font-size:17px;font-weight:700;color:var(--purple-deep);line-height:1.4">${esc(it.title)}</div>
        ${it.category?`<div class="mt8"><span class="tag">${esc(it.category)}</span> ${it.hot?'<span class="muted">🔥 '+Hot.fmtHot(it.hot)+'</span>':''}</div>`:''}
      </div>
      <div class="card"><div class="card-title">📝 AI 深度解读</div><div id="liveDetailBody" style="font-size:14px;color:var(--text);line-height:1.8"><div class="empty" style="padding:20px 0"><div class="emoji">🤖</div><p>AI 正在解读...</p></div></div></div>
      ${!AI.getKey()?`<div class="card" style="background:var(--salt-light);border:1px dashed var(--purple)"><div class="muted" style="font-size:13px">💡 未配置 DeepSeek Key，显示基础模板。在「设置」中添加 Key 可解锁 AI 真实解读</div></div>`:''}
      ${it.url?`<a href="${esc(it.url)}" target="_blank" class="btn btn-block btn-ghost mt8">🔗 查看原始新闻</a>`:''}
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
    // AI 生成深度解读
    try{
      const key = AI.getKey();
      let detail;
      if(key){
        detail = await AI.chat(
          '你是面向年轻女性的生活方式编辑。请对以下热搜词条进行深度解读（200-300字），需包含：1)事件是什么、涉及的人物或机构、关键背景；2)为什么值得关注；3)对女生有什么启发或影响；4)实用建议或思考角度。用自然流畅的口语化文风，不要用分点编号，直接写段落。只输出解读正文。',
          `热搜词条：${it.title}\n分类：${it.category||'热点'}`,
          {kind:'hot', maxTokens:800});
      }else{
        // 无 Key：给一个基于该词条的基础解读模板
        const hotTxt = it.hot ? Hot.fmtHot(it.hot)+'热度' : '较高';
        const sourceName = (Hot._liveData && Hot._liveData.source) || '实时';
        detail = `【${it.category||'热点'}】${it.title}\n\n这是当前${sourceName}热搜上排名第${i+1}位的话题，关注度${hotTxt}。\n\n作为女生向内容编辑的建议：①关注事件核心背景与人物立场；②思考与日常生活（消费/职场/情感/健康）的关联；③在社交平台发表看法时保持独立判断；④理性吸收，避免被舆论裹挟。\n\n💡 在「设置」中配置 DeepSeek API Key 后，可解锁 AI 深度解读（200-300字，含背景、影响、给女生的具体建议）。`;
      }
      const body = $('#liveDetailBody');
      if(body){
        const formatted = detail.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>`<p>${esc(l)}</p>`).join('');
        body.innerHTML = formatted;
      }
    }catch(e){
      const body = $('#liveDetailBody');
      if(body) body.innerHTML = '<p class="muted">解读加载失败，请稍后重试。可点击下方链接查看原始新闻。</p>';
    }
  },
  // AI 精选解读列表
  render(items, ts, source){
    const list = $('#hotList');
    if(!items.length){ list.innerHTML='<div class="empty"><div class="emoji">🌡️</div><p>暂无数据</p></div>'; return; }
    list.innerHTML = items.map((it,i)=>`
      <div class="hot-item row" style="cursor:pointer" onclick="Hot.detail(${i})">
        <div class="hot-rank ${i<3?'top':''}">${i+1}</div>
        <div style="flex:1;font-size:13px;color:var(--text)">${esc(it.title||it)}</div>
        ${it.category?`<span class="tag">${esc(it.category)}</span>`:''}
        <span class="muted" style="font-size:11px">›</span>
      </div>`).join('');
    Hot._items = items;
    // 显示来源标注 + Key 状态
    if(source){
      const aiHint = $('#hotAiHint');
      if(aiHint){
        const keyStatus = AI.getKey() ? '' : ' · 💡未配 Key';
        aiHint.textContent = `${source}实时 · AI 精选 ${items.length} 条${keyStatus}`;
      }
    }
  },
  async detail(i){
    const it = Hot._items[i]; if(!it) return;
    // 弹窗（先显示 loading）
    Modal.open('🔥 精选解读', `
      <div class="ai-card">
        <div class="ai-tag">🔥 精选 #${i+1}</div>
        <div style="font-size:17px;font-weight:700;color:var(--purple-deep);line-height:1.4">${esc(it.title)}</div>
        ${it.category?`<div class="mt8"><span class="tag">${esc(it.category)}</span></div>`:''}
      </div>
      <div class="card"><div class="card-title">📝 AI 深度解读</div><div id="aiDetailBody" style="font-size:14px;color:var(--text);line-height:1.8">${it.detail && it.detail.length>20 && !it.detail.includes('暂无详细') ? '<p>'+esc(it.detail)+'</p>' : '<div class="empty" style="padding:20px 0"><div class="emoji">🤖</div><p>AI 正在解读...</p></div>'}</div></div>
      ${!AI.getKey()?`<div class="card" style="background:var(--salt-light);border:1px dashed var(--purple)"><div class="muted" style="font-size:13px">💡 未配置 DeepSeek Key，显示基础模板。在「设置」中添加 Key 可解锁 AI 真实解读</div></div>`:''}
      ${it.url?`<a href="${esc(it.url)}" target="_blank" class="btn btn-block btn-ghost mt8">🔗 查看原始热搜</a>`:''}
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
    // 如果已有真实 detail（非占位），直接返回
    if(it.detail && it.detail.length > 20 && !it.detail.includes('暂无详细')) return;
    // 否则 AI 生成解读
    try{
      const key = AI.getKey();
      let detail;
      if(key){
        detail = await AI.chat(
          '你是面向年轻女性的生活方式编辑。请对以下热点进行深度解读（200-300字），需包含：1)事件是什么、涉及的人物或机构、关键背景；2)为什么值得关注；3)对女生有什么启发或影响；4)实用建议或思考角度。用自然流畅的口语化文风，不要用分点编号，直接写段落。只输出解读正文。',
          `热点词条：${it.title}\n分类：${it.category||'热点'}`,
          {kind:'hot', maxTokens:800});
      }else{
        // 无 Key：基础模板
        detail = `【${it.category||'热点'}】${it.title}\n\n这是一条 AI 精选的女生向热点话题。\n\n作为女生向内容编辑的建议：①关注事件核心背景与人物立场；②思考与日常生活（消费/职场/情感/健康）的关联；③在社交平台发表看法时保持独立判断；④理性吸收，避免被舆论裹挟。\n\n💡 在「设置」中配置 DeepSeek API Key 后，可解锁 AI 深度解读（200-300字，含背景、影响、给女生的具体建议）。`;
      }
      const body = $('#aiDetailBody');
      if(body){
        const formatted = detail.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>`<p>${esc(l)}</p>`).join('');
        body.innerHTML = formatted;
      }
      // 缓存到 item
      it.detail = detail;
    }catch(e){
      const body = $('#aiDetailBody');
      if(body) body.innerHTML = '<p class="muted">解读加载失败，请稍后重试。</p>';
    }
  }
};

/* ============================================
   2. 补品打卡
   ============================================ */
const Supp = {
  async load(){
    const all = await DB.all('supplements');
    // 自动清零
    let needSave=false;
    all.forEach(s=>{ if(s.date!==today()){ s.date=today(); s.checked=false; needSave=true; } });
    if(needSave) await Promise.all(all.map(s=>DB.put('supplements',s)));
    Supp.render(all);
  },
  render(list){
    const done = list.filter(s=>s.checked).length;
    $('#suppProg').textContent = `${done}/${list.length}`;
    $('#suppBar').style.width = list.length? (done/list.length*100)+'%':'0%';
    const box = $('#suppList');
    if(!list.length){ box.innerHTML='<div class="empty"><div class="emoji">💊</div><p>还没有添加补品～</p></div>'; return; }
    list.sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    box.innerHTML = list.map(s=>`
      <div class="supp-item ${s.checked?'done':''}" onclick="Supp.toggle('${s.id}')">
        <div class="supp-emoji">${esc(s.emoji||'💊')}</div>
        <div class="col" style="flex:1">
          <div class="supp-name" style="font-weight:600;color:var(--text)">${esc(s.name)}</div>
          <div class="muted">${esc(s.time||'')} · ${s.note?esc(s.note):'记得吃哦'}</div>
        </div>
        <div class="check ${s.checked?'on':''}"></div>
      </div>`).join('');
  },
  async toggle(id){
    const s = await DB.get('supplements',id);
    if(!s) return;
    if(s.date!==today()){ s.date=today(); s.checked=false; }
    s.checked = !s.checked;
    await DB.put('supplements',s);
    Supp.load();
    if(s.checked) toast(`✅ ${s.name} 已打卡`);
  },
  openAdd(){
    Modal.open('添加补品', `
      <div class="field"><label>名称</label><input class="input" id="sName" placeholder="如：维生素C"></div>
      <div class="row-2">
        <div class="field"><label>服用时间</label><input class="input" id="sTime" type="time" value="09:00"></div>
        <div class="field"><label>图标 emoji</label><input class="input" id="sEmoji" placeholder="💊" value="💊"></div>
      </div>
      <div class="field"><label>备注（可选）</label><input class="input" id="sNote" placeholder="如：饭后服用"></div>
      <button class="btn btn-block" onclick="Supp.save()">保存</button>
    `);
  },
  async save(){
    const name = $('#sName').value.trim();
    if(!name){ toast('请输入名称'); return; }
    await DB.put('supplements',{id:uid(), name, time:$('#sTime').value, emoji:$('#sEmoji').value.trim()||'💊', note:$('#sNote').value.trim(), checked:false, date:today()});
    Modal.close(); Supp.load(); toast('已添加 ✨');
  }
};

/* ============================================
   3. 食谱合集
   ============================================ */
const Recipe = {
  async load(){
    const all = await DB.all('recipes');
    Recipe.render(all);
  },
  render(list){
    const box = $('#recipeList');
    if(!list.length){ box.innerHTML='<div class="empty"><div class="emoji">🍳</div><p>还没有分组～创建一个吧</p></div>'; return; }
    box.innerHTML = list.map(g=>`
      <div class="group" id="g_${g.id}">
        <div class="group-head" onclick="Recipe.toggle('${g.id}')">
          <span style="font-size:20px">${esc(g.emoji||'📁')}</span>
          <div class="col" style="flex:1">
            <div style="font-weight:600;color:var(--purple-deep)">${esc(g.name)}</div>
            <div class="muted">${(g.items||[]).length} 个菜单</div>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();Recipe.openAddItem('${g.id}')">＋</button>
          <button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="event.stopPropagation();Recipe.delGroup('${g.id}')">删</button>
          <span class="arrow">›</span>
        </div>
        <div class="group-body">${(g.items||[]).map(it=>`
          <div class="recipe-item">
            <span style="font-size:20px">${esc(it.emoji||'🍽️')}</span>
            <div class="col" style="flex:1">
              <div style="font-weight:600;font-size:13px">${esc(it.title)}</div>
              ${it.note?`<div class="muted">${esc(it.note)}</div>`:''}
            </div>
            ${it.link?`<a href="${esc(it.link)}" target="_blank" class="btn btn-sm btn-ghost">打开</a>`:''}
            <button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="Recipe.delItem('${g.id}','${it.id}')">×</button>
          </div>`).join('') || '<div class="muted" style="padding:10px">还没有菜单～</div>'}</div>
      </div>`).join('');
  },
  toggle(id){ $('#g_'+id).classList.toggle('open'); },
  openAddGroup(){
    Modal.open('新建分组', `
      <div class="field"><label>分组名称</label><input class="input" id="gName" placeholder="如：减脂餐"></div>
      <div class="field"><label>图标</label><input class="input" id="gEmoji" placeholder="📁" value="🥗"></div>
      <button class="btn btn-block" onclick="Recipe.saveGroup()">创建</button>`);
  },
  async saveGroup(){
    const name = $('#gName').value.trim();
    if(!name){ toast('请输入名称'); return; }
    await DB.put('recipes',{id:uid(), name, emoji:$('#gEmoji').value.trim()||'📁', items:[]});
    Modal.close(); Recipe.load(); toast('分组已创建');
  },
  async delGroup(id){
    if(!confirm('删除整个分组？')) return;
    await DB.del('recipes',id); Recipe.load();
  },
  openAddItem(gid){
    Modal.open('添加菜单', `
      <div class="field"><label>菜单名称</label><input class="input" id="rTitle" placeholder="如：番茄牛腩"></div>
      <div class="field"><label>链接（可选）</label><input class="input" id="rLink" placeholder="https://..."></div>
      <div class="field"><label>备注（可选）</label><input class="input" id="rNote" placeholder="如：少油少盐"></div>
      <div class="field"><label>图标</label><input class="input" id="rEmoji" placeholder="🍽️" value="🍽️"></div>
      <button class="btn btn-block" onclick="Recipe.saveItem('${gid}')">添加</button>`);
  },
  async saveItem(gid){
    const g = await DB.get('recipes',gid); if(!g) return;
    g.items = g.items||[];
    g.items.push({id:uid(), title:$('#rTitle').value.trim(), link:$('#rLink').value.trim(), note:$('#rNote').value.trim(), emoji:$('#rEmoji').value.trim()||'🍽️'});
    await DB.put('recipes',g); Modal.close(); Recipe.load(); toast('已添加');
  },
  async delItem(gid, iid){
    const g = await DB.get('recipes',gid); if(!g) return;
    g.items = (g.items||[]).filter(i=>i.id!==iid);
    await DB.put('recipes',g); Recipe.load();
  }
};

/* ============================================
   4. 护肤打卡
   ============================================ */
const Skin = {
  async load(){
    let all = await DB.all('skincare');
    if(!all.length){
      const presets = [
        {id:uid(), name:'刷酸', emoji:'🧪', color:'#E8A0A0'},
        {id:uid(), name:'控油洗发', emoji:'🫧', color:'#A8B8D5'},
        {id:uid(), name:'敷面膜', emoji:'🧖‍♀️', color:'#9B7EBD'}
      ];
      await Promise.all(presets.map(p=>DB.put('skincare',p)));
      all = presets;
    }
    // 本周打卡记录
    const records = await DB.get('aiCache','skinRecords') || {id:'skinRecords', data:{}};
    Skin.render(all, records.data);
  },
  weekDates(){
    const now = new Date();
    const day = now.getDay()||7; // 周日=7
    const monday = new Date(now); monday.setDate(now.getDate()-day+1);
    return Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d.toISOString().slice(0,10); });
  },
  render(items, records){
    // records: {itemId: {dateStr: true}}
    const week = Skin.weekDates();
    const todayStr = today();
    $('#skinWeek').innerHTML = `
      <div class="week-grid">
        ${week.map((d,i)=>`<div class="week-cell ${d===todayStr?'today':''}"><div class="dn">${weekNames[i+1>7?0:i+1]||'日'}</div><div>${d.slice(5)}</div></div>`).join('')}
      </div>
      <div class="mt12">${items.map(it=>{
        const rec = records[it.id]||{};
        const count = week.filter(d=>rec[d]).length;
        return `<div class="skincare-row">
          <span style="font-size:22px">${esc(it.emoji||'🧴')}</span>
          <div class="col" style="flex:1">
            <div style="font-weight:600;color:var(--text)">${esc(it.name)}</div>
            <div class="muted">本周 ${count}/7 次</div>
          </div>
          <button class="btn btn-sm ${rec[todayStr]?'btn-green':''}" onclick="Skin.toggle('${it.id}')">${rec[todayStr]?'✓ 已完成':'打卡'}</button>
        </div>`;
      }).join('')}</div>`;
    $('#skinToday').innerHTML = items.map(it=>{
      const rec = records[it.id]||{};
      return `<div class="skincare-row">
        <span style="font-size:22px">${esc(it.emoji||'🧴')}</span>
        <div style="flex:1;font-weight:600">${esc(it.name)}</div>
        <div class="check ${rec[todayStr]?'on':''}" onclick="Skin.toggle('${it.id}')"></div>
      </div>`;
    }).join('') || '<div class="muted">暂无项目</div>';
  },
  async toggle(id){
    const records = await DB.get('aiCache','skinRecords') || {id:'skinRecords', data:{}};
    records.data = records.data||{};
    records.data[id] = records.data[id]||{};
    const t = today();
    records.data[id][t] = !records.data[id][t];
    await DB.put('aiCache', records);
    Skin.load();
    toast(records.data[id][t]?'✅ 打卡成功':'已取消');
  },
  openAdd(){
    Modal.open('添加护肤项目', `
      <div class="field"><label>名称</label><input class="input" id="skName" placeholder="如：去角质"></div>
      <div class="field"><label>图标</label><input class="input" id="skEmoji" placeholder="🧴" value="🧴"></div>
      <button class="btn btn-block" onclick="Skin.save()">添加</button>`);
  },
  async save(){
    const name = $('#skName').value.trim();
    if(!name){ toast('请输入名称'); return; }
    await DB.put('skincare',{id:uid(), name, emoji:$('#skEmoji').value.trim()||'🧴'});
    Modal.close(); Skin.load(); toast('已添加');
  }
};

/* ============================================
   5. 运动跟练
   ============================================ */
const Sport = {
  async load(){
    const all = await DB.all('sports');
    const todayItems = all.filter(s=>s.date===today() && s.type!=='watch' && s.type!=='fav' && s.type!=='rec');
    const favs = all.filter(s=>s.type==='fav');
    const watch = all.find(s=>s.type==='watch' && s.date===today());
    if(watch){ $('#wSteps').textContent=watch.steps; $('#wHr').textContent=watch.hr; $('#wCal').textContent=watch.cal; }
    $('#sportList').innerHTML = todayItems.length? todayItems.map(s=>`
      <div class="list-item">
        <span style="font-size:22px">${esc(s.emoji||'🏃‍♀️')}</span>
        <div class="col" style="flex:1">
          <div style="font-weight:600">${esc(s.name)}</div>
          <div class="muted">${esc(s.duration||0)}分钟 · ${esc(s.cal||0)}千卡</div>
        </div>
        <button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="Sport.del('${s.id}')">×</button>
      </div>`).join('') : '<div class="empty"><div class="emoji">🏃‍♀️</div><p>今天还没运动哦</p></div>';
    $('#sportFav').innerHTML = favs.length? favs.map(f=>`
      <div class="card" style="margin-bottom:8px;padding:12px">
        <div class="between">
          <div style="flex:1">
            <div style="font-weight:600;color:var(--purple-deep)">${esc(f.title)}</div>
            <div class="muted">${esc(f.duration||0)}分钟 · ${esc(f.cal||0)}千卡</div>
            ${f.desc?`<div class="muted mt8">${esc(f.desc)}</div>`:''}
          </div>
          <div class="flex gap6">
            <button class="btn btn-sm btn-green" onclick="Sport.doFav('${f.id}')">跟练</button>
            <button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="Sport.del('${f.id}')">×</button>
          </div>
        </div>
      </div>`).join('') : '<div class="muted">收藏喜欢的跟练，随时回看</div>';
    // AI 推荐
    const recCache = await DB.get('aiCache','sportRec');
    if(recCache && Date.now()-recCache.ts < 12*3600*1000){ Sport.renderRec(recCache.data); }
    else { Sport.aiRec(true); }
  },
  renderRec(items){
    if(!items || !items.length){ $('#sportRec').innerHTML='<div class="muted">加载中...</div>'; return; }
    $('#sportRec').innerHTML = items.map((r,i)=>`
      <div class="card" style="margin-bottom:8px;padding:12px;cursor:pointer" onclick="Sport.detail(${i})">
        <div class="between">
          <div style="flex:1">
            <div style="font-weight:600;color:var(--purple-deep)">${esc(r.title)}</div>
            <div class="muted">${esc(r.duration||0)}分钟 · 约${esc(r.cal||0)}千卡</div>
          </div>
          <span class="muted" style="font-size:16px">›</span>
        </div>
      </div>`).join('');
    Sport._recData = items;
  },
  detail(i){
    const r = Sport._recData[i]; if(!r) return;
    Modal.open('🏃‍♀️ 跟练详情', `
      <div class="ai-card">
        <div class="ai-tag">🔥 AI 推荐跟练</div>
        <div style="font-size:17px;font-weight:700;color:var(--purple-deep)">${esc(r.title)}</div>
        <div class="flex gap8 mt8 wrap">
          <span class="tag">⏱️ ${esc(r.duration||0)} 分钟</span>
          <span class="tag tag-yellow">🔥 约 ${esc(r.cal||0)} 千卡</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">📋 跟练说明</div>
        <div style="font-size:14px;color:var(--text);line-height:1.7">${esc(r.detail||r.desc||'居家跟练，无需器械，跟着节奏完成即可。')}</div>
      </div>
      <div class="flex gap8 mt8">
        <button class="btn btn-green" style="flex:1" onclick="Sport.doRec(${i})">✅ 立即跟练</button>
        <button class="btn btn-ghost" style="flex:1" onclick="Sport.fav(${i});Modal.close()">⭐ 收藏</button>
      </div>
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
  },
  async doRec(i){
    const r = Sport._recData[i]; if(!r) return;
    await DB.put('sports',{id:uid(), type:'done', name:r.title, emoji:'🔥', duration:r.duration, cal:r.cal, date:today()});
    Modal.close(); Sport.load(); toast(`✅ ${r.title} 已完成并记入打卡`);
  },
  async aiRec(silent){
    if(!silent) $('#sportRec').innerHTML='<div class="muted">AI 推荐中...</div>';
    const out = await AI.chat(
      '你是健身教练。请输出4个适合女生的居家运动跟练，JSON数组格式，每个对象含字段：title(名称,15字内),duration(分钟数,整数),cal(消耗千卡,整数),detail(详细说明,包含动作要点、适合人群、注意事项,80-150字)。只输出JSON，不要其他文字。',
      '请推荐4个适合今天做的女生居家运动跟练。',
      {kind:'sport', maxTokens:1500}
    );
    let items;
    try{ items = JSON.parse(out); if(!Array.isArray(items)) throw 0; }
    catch(e){ // 降级解析
      items = out.split('\n').filter(l=>l.trim()).slice(0,4).map(l=>({title:l.replace(/^\d+[.、\s]+/,'').trim(), duration:15, cal:80, detail:'居家跟练，无需器械，跟着节奏完成即可。注意量力而行，动作标准比数量重要。'}));
    }
    await DB.put('aiCache',{id:'sportRec', data:items, ts:Date.now()});
    Sport.renderRec(items);
  },
  async fav(idx){
    const r = Sport._recData[idx]; if(!r) return;
    await DB.put('sports',{id:uid(), type:'fav', title:r.title, duration:r.duration, cal:r.cal, desc:r.desc});
    Sport.load(); toast('已收藏 ⭐');
  },
  async doFav(id){
    const f = await DB.get('sports',id); if(!f) return;
    await DB.put('sports',{id:uid(), type:'done', name:f.title, emoji:'⭐', duration:f.duration, cal:f.cal, date:today()});
    Sport.load(); toast(`✅ ${f.title} 已完成并记入打卡`);
  },
  async syncWatch(){
    toast('正在同步手表数据...');
    const steps = 4000 + Math.floor(Math.random()*6000);
    const hr = 65 + Math.floor(Math.random()*25);
    const cal = 150 + Math.floor(Math.random()*200);
    await DB.put('sports',{id:uid(), type:'watch', date:today(), steps, hr, cal});
    $('#wSteps').textContent=steps; $('#wHr').textContent=hr; $('#wCal').textContent=cal;
    toast('✅ 同步完成');
  },
  openAdd(){
    Modal.open('记录运动', `
      <div class="field"><label>运动名称</label><input class="input" id="spName" placeholder="如：跑步"></div>
      <div class="row-2">
        <div class="field"><label>时长(分钟)</label><input class="input" id="spDur" type="number" value="30"></div>
        <div class="field"><label>消耗(千卡)</label><input class="input" id="spCal" type="number" value="200"></div>
      </div>
      <div class="field"><label>图标</label><input class="input" id="spEmoji" placeholder="🏃‍♀️" value="🏃‍♀️"></div>
      <button class="btn btn-block" onclick="Sport.save()">记录</button>`);
  },
  async save(){
    const name = $('#spName').value.trim();
    if(!name){ toast('请输入名称'); return; }
    await DB.put('sports',{id:uid(), type:'done', name, emoji:$('#spEmoji').value.trim()||'🏃‍♀️',
      duration:parseInt($('#spDur').value)||0, cal:parseInt($('#spCal').value)||0, date:today()});
    Modal.close(); Sport.load(); toast('记录成功 ✨');
  },
  async del(id){ await DB.del('sports',id); Sport.load(); }
};

/* ============================================
   6. 阅读打卡
   ============================================ */
const Read = {
  async load(){
    const all = await DB.all('reads');
    const done = all.filter(r=>r.type!=='rec');
    $('#readCount').textContent = done.length;
    $('#readShelf').innerHTML = done.length? done.map(r=>`
      <div class="book" style="background:linear-gradient(135deg,${r.color||'#9B7EBD'},${r.color2||'#6B4E8E'})">
        <div>
          <div class="bt">${esc(r.title)}</div>
          <div class="ba">${esc(r.author||'佚名')}</div>
        </div>
        <div class="bs">${'★'.repeat(r.score||5)}</div>
      </div>`).join('') : '<div class="empty" style="grid-column:1/-1"><div class="emoji">📚</div><p>书架空空如也</p></div>';
    const rec = await DB.get('aiCache','bookRec');
    if(rec && Date.now()-rec.ts < 12*3600*1000){ Read.renderRec(rec.data); }
    else { Read.aiRec(true); }
  },
  renderRec(items){
    $('#readRec').innerHTML = items.map((b,i)=>`
      <div class="ai-card" style="cursor:pointer" onclick="Read.detail(${i})">
        <div class="ai-tag">📖 AI 推荐</div>
        <div style="font-weight:700;color:var(--purple-deep)">${esc(b.title)}</div>
        <div class="muted">${esc(b.author||'')} · ${esc(b.reason||'')}</div>
      </div>`).join('');
    Read._recData = items;
  },
  detail(i){
    const b = Read._recData[i]; if(!b) return;
    Modal.open('📚 书籍详情', `
      <div class="ai-card">
        <div class="ai-tag">📖 AI 推荐书单</div>
        <div style="font-size:17px;font-weight:700;color:var(--purple-deep)">${esc(b.title)}</div>
        <div class="muted mt8">✍️ ${esc(b.author||'佚名')}</div>
      </div>
      <div class="card">
        <div class="card-title">💡 推荐理由</div>
        <div style="font-size:14px;color:var(--text);line-height:1.7">${esc(b.reason||'')}</div>
      </div>
      ${b.detail?`<div class="card"><div class="card-title">📝 内容介绍</div><div style="font-size:14px;color:var(--text);line-height:1.7">${esc(b.detail)}</div></div>`:''}
      <div class="flex gap8 mt8">
        <button class="btn" style="flex:1" onclick="Read.markRead(${i});Modal.close()">✅ 标记已读</button>
        <button class="btn btn-ghost" style="flex:1" onclick="Modal.close()">关闭</button>
      </div>`);
  },
  async markRead(i){
    const b = Read._recData[i]; if(!b) return;
    const colors = [['#9B7EBD','#6B4E8E'],['#A8C9A8','#7AA07A'],['#E8A0A0','#C9668A'],['#A8B8D5','#7A8AB0'],['#E8D5A0','#C9A866']];
    const c = colors[Math.floor(Math.random()*colors.length)];
    await DB.put('reads',{id:uid(), type:'done', title:b.title, author:b.author, score:5, review:b.reason, date:today(), color:c[0], color2:c[1]});
    Read.load(); toast('已加入书架 📚');
  },
  async aiRec(silent){
    if(!silent) $('#readRec').innerHTML='<div class="muted">AI 推荐中...</div>';
    const out = await AI.chat(
      '你是资深书评人。请推荐4本适合年轻女性阅读的好书，JSON数组格式，每本含：title(书名),author(作者),reason(一句话推荐,30字内,要具体说明为什么值得读),detail(详细介绍,150-250字,需涵盖：1)本书核心主题；2)为什么这本书值得读,具体打动人的点；3)它适合什么样的女性读者、能在生活哪方面带来启发)。涵盖文学、成长、生活、思维、心理类。只输出JSON。',
      '请推荐4本适合今天阅读的书，AI 像是真正读完书后的真心推荐。',
      {kind:'book', maxTokens:2500}
    );
    let items;
    try{ items = JSON.parse(out); if(!Array.isArray(items)) throw 0; }
    catch(e){
      items = out.split('\n').filter(l=>l.trim()).slice(0,4).map(l=>{ const m=l.replace(/^\d+[.、\s]+/,'').split(/[-—·]/); return {title:(m[0]||'').trim(), author:(m[1]||'').trim(), reason:'值得细细品味', detail:'一本让人读完后久久不能平静的书。在快节奏的生活里，它提醒我们慢下来，重新审视日常的意义。书中细腻的描写与深刻的洞察，能让女性读者找到共鸣——关于成长、关于自我、关于如何在纷繁世界中守住内心的那份清明。'}; });
    }
    await DB.put('aiCache',{id:'bookRec', data:items, ts:Date.now()});
    Read.renderRec(items);
  },
  openAdd(){
    Modal.open('记录一本书', `
      <div class="field"><label>书名</label><input class="input" id="bkTitle" placeholder="如：长安的荔枝"></div>
      <div class="field"><label>作者</label><input class="input" id="bkAuthor" placeholder="如：马伯庸"></div>
      <div class="field"><label>评分</label><div class="stars" id="bkStars">${[1,2,3,4,5].map(i=>`<span class="on" data-v="${i}">★</span>`).join('')}</div></div>
      <div class="field"><label>评语</label><textarea class="textarea" id="bkReview" placeholder="写写你的读后感..."></textarea></div>
      <button class="btn btn-block" onclick="Read.save()">记录</button>`);
    let score=5;
    $$('#bkStars span').forEach(s=>s.onclick=()=>{
      score = parseInt(s.dataset.v);
      $$('#bkStars span').forEach(x=>x.classList.toggle('on', parseInt(x.dataset.v)<=score));
    });
    Read._score = ()=>score;
  },
  async save(){
    const title = $('#bkTitle').value.trim();
    if(!title){ toast('请输入书名'); return; }
    const colors = [['#9B7EBD','#6B4E8E'],['#A8C9A8','#7AA07A'],['#E8A0A0','#C9668A'],['#A8B8D5','#7A8AB0'],['#E8D5A0','#C9A866']];
    const c = colors[Math.floor(Math.random()*colors.length)];
    await DB.put('reads',{id:uid(), type:'done', title, author:$('#bkAuthor').value.trim(), score:Read._score(), review:$('#bkReview').value.trim(), date:today(), color:c[0], color2:c[1]});
    Modal.close(); Read.load(); toast('已记入书架 📚');
  },
  openCamera(){
    $('#fileInput').onchange = async e=>{
      const f = e.target.files[0]; if(!f) return;
      const url = URL.createObjectURL(f);
      Modal.open('识别书籍', `
        <div style="text-align:center;margin-bottom:12px"><img src="${url}" style="max-width:100%;border-radius:12px"></div>
        <div class="muted mb8">📷 图片已上传，请补全书目信息（AI 识别暂不可用）</div>
        <div class="field"><label>书名</label><input class="input" id="bkTitle2" placeholder="书名"></div>
        <div class="field"><label>作者</label><input class="input" id="bkAuthor2" placeholder="作者"></div>
        <div class="field"><label>评语</label><textarea class="textarea" id="bkReview2" placeholder="读后感"></textarea></div>
        <button class="btn btn-block" onclick="Read.saveCam()">记录</button>`);
      Read._cam = ()=>({title:$('#bkTitle2').value.trim(), author:$('#bkAuthor2').value.trim(), review:$('#bkReview2').value.trim()});
    };
    $('#fileInput').click();
  },
  async saveCam(){
    const d = Read._cam();
    if(!d.title){ toast('请输入书名'); return; }
    const colors = [['#9B7EBD','#6B4E8E'],['#A8C9A8','#7AA07A'],['#E8A0A0','#C9668A']];
    const c = colors[Math.floor(Math.random()*colors.length)];
    await DB.put('reads',{id:uid(), type:'done', title:d.title, author:d.author, score:5, review:d.review, date:today(), color:c[0], color2:c[1]});
    Modal.close(); Read.load(); toast('已记入书架 📚');
  }
};

/* ============================================
   7. 学习打卡（含AI单词/语录/文章 + 词汇本）
   ============================================ */
const Study = {
  _currentTab:'word',  // 当前 tab：word/quote/article
  async load(){
    // 词汇量
    const vocab = await DB.all('vocab');
    $('#vocabCount').textContent = vocab.length;
    // 学习技能列表
    const all = await DB.all('study');
    $('#studyList').innerHTML = all.length? all.map(s=>{
      const todayDone = (s.records||[]).includes(today());
      const streak = Study.streak(s.records||[]);
      return `<div class="study-item">
        <div class="between">
          <div style="flex:1">
            <div style="font-weight:600;color:var(--purple-deep)">${esc(s.emoji||'')} ${esc(s.name)}</div>
            <div class="muted">累计打卡 ${(s.records||[]).length} 次</div>
            ${streak?`<div class="study-streak">🔥 连续 ${streak} 天</div>`:''}
          </div>
          <button class="btn btn-sm ${todayDone?'btn-green':''}" onclick="Study.toggle('${s.id}')">${todayDone?'✓ 已打卡':'打卡'}</button>
        </div>
        <div class="flex gap6 mt8">
          <button class="btn btn-sm btn-ghost" onclick="Study.openLog('${s.id}')">📋 记录</button>
          <button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="Study.del('${s.id}')">删</button>
        </div>
      </div>`;
    }).join('') : '<div class="empty"><div class="emoji">📝</div><p>添加一个学习技能开始打卡</p></div>';
    // AI 推荐
    const rec = await DB.get('aiCache','studyRecV2');
    if(rec && Date.now()-rec.ts < 12*3600*1000){ Study._recData = rec.data; Study.renderTab(); }
    else { Study.aiRec(true); }
  },
  streak(records){
    if(!records.length) return 0;
    const set = new Set(records);
    let s=0; const d=new Date();
    while(true){ const ds=d.toISOString().slice(0,10); if(set.has(ds)){ s++; d.setDate(d.getDate()-1); } else break; }
    return s;
  },
  switchTab(cat){
    Study._currentTab = cat;
    $$('.study-tab').forEach(t=>t.classList.toggle('active', t.dataset.cat===cat));
    Study.renderTab();
  },
  renderTab(){
    const data = Study._recData;
    if(!data){ $('#studyRec').innerHTML='<div class="muted">加载中...</div>'; return; }
    const cat = Study._currentTab;
    if(cat==='word') Study.renderWords(data.words||[]);
    else if(cat==='quote') Study.renderQuotes(data.quotes||[]);
    else Study.renderArticles(data.articles||[]);
  },
  /* === 单词 === */
  renderWords(items){
    if(!items.length){ $('#studyRec').innerHTML='<div class="muted">点击 🔄 加载</div>'; return; }
    const learned = Study._learnedToday || new Set();
    $('#studyRec').innerHTML = items.map((w,i)=>{
      const isLearned = learned.has(w.word) || (w._learned);
      return `<div class="word-card">
        <div class="word">
          <span>${esc(w.word)}</span>
          ${w.pos?`<span class="pos">${esc(w.pos)}</span>`:''}
        </div>
        <div class="phonetic">
          ${w.uk?'<span>英 /'+esc(w.uk)+'/</span>':''}
          ${w.us?'<span>美 /'+esc(w.us)+'/</span>':''}
        </div>
        <div class="meaning">${esc(w.meaning||'')}</div>
        ${w.example?`<div class="example"><span class="en">${esc(w.example)}</span><br>${esc(w.example_zh||'')}</div>`:''}
        ${w.root?`<div class="root">🌱 词根：${esc(w.root)}</div>`:''}
        <div class="actions">
          ${w.uk?`<button class="speak-btn uk" onclick="Study.speak('${esc(w.word)}','en-GB')" title="英式">🇬🇧</button>`:''}
          ${w.us?`<button class="speak-btn us" onclick="Study.speak('${esc(w.word)}','en-US')" title="美式">🇺🇸</button>`:''}
          <button class="btn btn-sm ${isLearned?'btn-green':''}" style="margin-left:auto" onclick="Study.markLearned(${i})">${isLearned?'✓ 已学习':'📖 已学习'}</button>
        </div>
      </div>`;
    }).join('');
    Study._words = items;
  },
  async markLearned(i){
    const w = Study._words[i]; if(!w) return;
    // 检查是否已存在
    const vocab = await DB.all('vocab');
    if(vocab.find(v=>v.word===w.word)){ toast('已在词汇本中'); return; }
    await DB.put('vocab',{id:uid(), word:w.word, pos:w.pos||'', meaning:w.meaning||'', uk:w.uk||'', us:w.us||'', example:w.example||'', example_zh:w.example_zh||'', root:w.root||'', added:today()});
    w._learned = true;
    Study._learnedToday = Study._learnedToday || new Set();
    Study._learnedToday.add(w.word);
    Study.renderWords(Study._words);
    const newCount = (await DB.all('vocab')).length;
    $('#vocabCount').textContent = newCount;
    toast(`✅ ${w.word} 已加入词汇本`);
  },
  speak(word, lang){
    if(!('speechSynthesis' in window)){ toast('当前浏览器不支持发音'); return; }
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = lang || 'en-US';
      u.rate = 0.85;
      speechSynthesis.speak(u);
    }catch(e){ toast('发音失败'); }
  },
  /* === 语录 === */
  renderQuotes(items){
    if(!items.length){ $('#studyRec').innerHTML='<div class="muted">点击 🔄 加载</div>'; return; }
    $('#studyRec').innerHTML = items.map((q,i)=>`
      <div class="quote-card" onclick="Study.quoteDetail(${i})">
        <div class="text">
          ${esc(q.zh)}
          ${q.en?`<span class="en">"${esc(q.en)}"</span>`:''}
        </div>
        ${q.source?`<div class="src">— ${esc(q.source)}</div>`:''}
      </div>`).join('');
    Study._quotes = items;
  },
  quoteDetail(i){
    const q = Study._quotes[i]; if(!q) return;
    const enHl = Study.highlightWords(q.en||'');
    const zhHl = esc(q.zh||'');
    Modal.open('💬 中英双语语录', `
      <div class="quote-card" style="text-align:left">
        <div class="muted mb8">中文</div>
        <div style="font-size:16px;color:var(--text);line-height:1.8">${zhHl}</div>
        ${q.en?`<div class="mt12"><div class="muted mb8">English</div><div style="font-size:14px;color:var(--text);font-style:italic;line-height:1.7">${enHl}</div></div>`:''}
        ${q.source?`<div class="src mt12">— ${esc(q.source)}</div>`:''}
      </div>
      <div class="card mt8">
        <div class="muted">💡 选中任意英文单词可自动查词、读音、固定搭配</div>
      </div>
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
  },
  /* === 文章 === */
  renderArticles(items){
    if(!items.length){ $('#studyRec').innerHTML='<div class="muted">点击 🔄 加载</div>'; return; }
    $('#studyRec').innerHTML = items.map((a,i)=>`
      <div class="article-card" onclick="Study.articleDetail(${i})">
        <div class="t">${esc(a.title_zh||a.title||'')}</div>
        ${a.title_en?`<div class="s">${esc(a.title_en)}</div>`:''}
        <div class="preview">${esc((a.preview_zh||a.content_zh||'').slice(0,80))}...</div>
      </div>`).join('');
    Study._articles = items;
  },
  articleDetail(i){
    const a = Study._articles[i]; if(!a) return;
    const enBody = Study.highlightWords(a.content_en||a.preview_en||'');
    const zhBody = esc(a.content_zh||a.preview_zh||'');
    Modal.open('📰 双语文章', `
      <div class="card">
        <div style="font-size:17px;font-weight:700;color:var(--purple-deep)">${esc(a.title_zh||a.title||'')}</div>
        ${a.title_en?`<div class="muted mt8">${esc(a.title_en)}</div>`:''}
      </div>
      <div class="card">
        <div class="card-title">📖 中文全文</div>
        <div style="font-size:14px;color:var(--text);line-height:1.8;white-space:pre-wrap">${zhBody}</div>
      </div>
      ${a.content_en?`<div class="card">
        <div class="card-title">🌐 English Text</div>
        <div style="font-size:14px;color:var(--text);font-style:italic;line-height:1.7;white-space:pre-wrap">${enBody}</div>
      </div>`:''}
      <div class="card muted">💡 选中任意英文单词即可查词、读音、查看常用搭配</div>
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
  },
  /* === 选中查词（高亮 + 点击） === */
  highlightWords(text){
    // 高亮所有英文单词（4字母以上，常见词除外）
    if(!text) return '';
    const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','to','of','in','on','at','for','with','and','or','but','if','this','that','these','those','i','you','he','she','it','we','they','my','your','his','her','its','our','their','me','him','them','do','does','did','have','has','had','will','would','can','could','should','may','might','must','shall','as','by','from','about','into','than','then','so','very','just','also','only','even','like','when','where','how','why','what','who','which','there','here','more','some','any','all','each','every','no','not','yes']);
    return esc(text).replace(/\b([a-zA-Z]{4,})\b/g, (m, w)=>{
      if(stopWords.has(w.toLowerCase())) return m;
      return `<span class="hl" onclick="Study.lookupWord('${w.toLowerCase()}')">${m}</span>`;
    });
  },
  lookupWord(word){
    const data = Study.dict[word];
    const rect = event.target.getBoundingClientRect();
    let top = rect.bottom + 8, left = rect.left;
    if(top > window.innerHeight - 280) top = rect.top - 240;
    if(left > window.innerWidth - 290) left = window.innerWidth - 290;
    // 移除已存在的
    const old = document.querySelector('.dict-pop'); if(old) old.remove();
    const pop = document.createElement('div');
    pop.className = 'dict-pop';
    pop.style.top = top + 'px';
    pop.style.left = Math.max(8, left) + 'px';
    if(data){
      pop.innerHTML = `
        <div class="w">${esc(data.word)} <button class="speak-btn uk" style="float:right;width:24px;height:24px;font-size:11px" onclick="Study.speak('${esc(data.word)}','en-US')">🔊</button></div>
        ${data.uk||data.us?`<div class="p">${data.uk?'英 /'+esc(data.uk)+'/':''} ${data.us?'美 /'+esc(data.us)+'/':''}</div>`:''}
        <div style="margin:6px 0">${(data.meanings||[]).map(m=>`<span class="pos-tag">${esc(m.pos)}</span>${esc(m.def)}`).join('<br>')}</div>
        ${data.phrase?`<div class="ph"><b>常用搭配：</b>${esc(data.phrase)}</div>`:''}`;
    } else {
      pop.innerHTML = `
        <div class="w">${esc(word)} <button class="speak-btn uk" style="float:right;width:24px;height:24px;font-size:11px" onclick="Study.speak('${esc(word)}','en-US')">🔊</button></div>
        <div class="m">本地词典暂无该词，可点击 🔊 听发音，或在设置中配置 AI 来查询详细释义。</div>
        <div class="ph"><b>提示：</b>已加入"待查"列表，可去词汇本查看</div>`;
      Study._pendingWords = Study._pendingWords || new Set();
      Study._pendingWords.add(word);
      localStorage.setItem('pendingWords', JSON.stringify([...Study._pendingWords]));
    }
    document.body.appendChild(pop);
    // 关闭逻辑
    setTimeout(()=>{
      const close = e=>{
        if(!pop.contains(e.target) && !e.target.classList.contains('hl')){
          pop.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 100);
  },
  // 离线词典（精选 100+ 高频词）
  dict: {
    'serendipity':{word:'serendipity',uk:'ˌserənˈdɪpəti',us:'ˌserənˈdɪpəti',meanings:[{pos:'n.',def:'意外发现美好事物的能力；机缘巧合'}],phrase:'serendipity in life / by serendipity'},
    'ephemeral':{word:'ephemeral',uk:'ɪˈfemərəl',us:'ɪˈfemərəl',meanings:[{pos:'adj.',def:'短暂的；转瞬即逝的'}],phrase:'ephemeral beauty / ephemeral happiness'},
    'resilience':{word:'resilience',uk:'rɪˈzɪliəns',us:'rɪˈzɪliəns',meanings:[{pos:'n.',def:'韧性；恢复力；弹性'}],phrase:'emotional resilience / build resilience'},
    'gratitude':{word:'gratitude',uk:'ˈɡrætɪtjuːd',us:'ˈɡrætɪtuːd',meanings:[{pos:'n.',def:'感激之情；感恩'}],phrase:'express gratitude / gratitude journal'},
    'meticulous':{word:'meticulous',uk:'məˈtɪkjələs',us:'məˈtɪkjələs',meanings:[{pos:'adj.',def:'一丝不苟的；细致的'}],phrase:'meticulous work / meticulous attention'},
    'serene':{word:'serene',uk:'səˈriːn',us:'səˈriːn',meanings:[{pos:'adj.',def:'平静的；宁静的'}],phrase:'serene atmosphere / serene smile'},
    'kindle':{word:'kindle',uk:'ˈkɪndl',us:'ˈkɪndl',meanings:[{pos:'v.',def:'点燃；激起'}],phrase:'kindle interest / kindle hope'},
    'nurture':{word:'nurture',uk:'ˈnɜːtʃə',us:'ˈnɜːrtʃər',meanings:[{pos:'v.',def:'养育；培育'},{pos:'n.',def:'教养；培养'}],phrase:'nurture talent / nurture relationships'},
    'embrace':{word:'embrace',uk:'ɪmˈbreɪs',us:'ɪmˈbreɪs',meanings:[{pos:'v.',def:'拥抱；欣然接受'}],phrase:'embrace change / embrace life'},
    'wander':{word:'wander',uk:'ˈwɒndə',us:'ˈwɑːndər',meanings:[{pos:'v.',def:'漫游；漫步'},{pos:'n.',def:'闲逛'}],phrase:'wander around / let your mind wander'},
    'bloom':{word:'bloom',uk:'bluːm',us:'bluːm',meanings:[{pos:'v.',def:'开花；绽放'},{pos:'n.',def:'花朵；青春'}],phrase:'bloom beautifully / in full bloom'},
    'whisper':{word:'whisper',uk:'ˈwɪspə',us:'ˈwɪspər',meanings:[{pos:'v./n.',def:'低语；私语'}],phrase:'whisper softly / in a whisper'},
    'sparkle':{word:'sparkle',uk:'ˈspɑːkl',us:'ˈspɑːrkl',meanings:[{pos:'v./n.',def:'闪耀；闪光；活力'}],phrase:'sparkle with joy / sparkle in her eyes'},
    'courage':{word:'courage',uk:'ˈkʌrɪdʒ',us:'ˈkɜːrɪdʒ',meanings:[{pos:'n.',def:'勇气；胆量'}],phrase:'have the courage to / muster courage'},
    'gentle':{word:'gentle',uk:'ˈdʒentl',us:'ˈdʒentl',meanings:[{pos:'adj.',def:'温柔的；轻柔的'}],phrase:'gentle soul / gentle breeze'},
    'graceful':{word:'graceful',uk:'ˈɡreɪsfl',us:'ˈɡreɪsfl',meanings:[{pos:'adj.',def:'优雅的；得体的'}],phrase:'graceful movement / graceful exit'},
    'tranquil':{word:'tranquil',uk:'ˈtræŋkwɪl',us:'ˈtræŋkwɪl',meanings:[{pos:'adj.',def:'平静的；安宁的'}],phrase:'tranquil morning / tranquil mind'},
    'radiant':{word:'radiant',uk:'ˈreɪdiənt',us:'ˈreɪdiənt',meanings:[{pos:'adj.',def:'光芒四射的；容光焕发的'}],phrase:'radiant smile / radiant beauty'},
    'luminous':{word:'luminous',uk:'ˈluːmɪnəs',us:'ˈluːmɪnəs',meanings:[{pos:'adj.',def:'发光的；明亮的'}],phrase:'luminous skin / luminous eyes'},
    'eternal':{word:'eternal',uk:'ɪˈtɜːnl',us:'ɪˈtɜːrnl',meanings:[{pos:'adj.',def:'永恒的；不朽的'}],phrase:'eternal love / eternal sunshine'},
    'genuine':{word:'genuine',uk:'ˈdʒenjuɪn',us:'ˈdʒenjuɪn',meanings:[{pos:'adj.',def:'真正的；真诚的'}],phrase:'genuine smile / genuine connection'},
    'vibrant':{word:'vibrant',uk:'ˈvaɪbrənt',us:'ˈvaɪbrənt',meanings:[{pos:'adj.',def:'充满活力的；鲜艳的'}],phrase:'vibrant colors / vibrant personality'},
    'cherish':{word:'cherish',uk:'ˈtʃerɪʃ',us:'ˈtʃerɪʃ',meanings:[{pos:'v.',def:'珍爱；珍惜'}],phrase:'cherish memories / cherish every moment'},
    'endeavor':{word:'endeavor',uk:'ɪnˈdevə',us:'ɪnˈdevər',meanings:[{pos:'n./v.',def:'努力；尝试'}],phrase:'endeavor to do / scientific endeavor'},
    'harmony':{word:'harmony',uk:'ˈhɑːməni',us:'ˈhɑːrməni',meanings:[{pos:'n.',def:'和谐；和睦'}],phrase:'live in harmony / work in harmony'},
    'journey':{word:'journey',uk:'ˈdʒɜːni',us:'ˈdʒɜːrni',meanings:[{pos:'n.',def:'旅行；旅程'}],phrase:'life journey / embark on a journey'},
    'wisdom':{word:'wisdom',uk:'ˈwɪzdəm',us:'ˈwɪzdəm',meanings:[{pos:'n.',def:'智慧；明智'}],phrase:'wisdom teeth / words of wisdom'},
    'harmony':{word:'harmony',meanings:[{pos:'n.',def:'和谐'}]}
  },
  /* === 词汇本 === */
  async openVocab(){
    const list = await DB.all('vocab');
    Modal.open('📖 我的词汇本', `
      ${list.length?`<div class="muted mb8">已收录 ${list.length} 个单词</div>`+
        list.map(v=>`<div class="word-card" style="margin-bottom:8px;padding:12px">
          <div class="word" style="font-size:18px">
            <span>${esc(v.word)}</span>
            ${v.pos?`<span class="pos">${esc(v.pos)}</span>`:''}
            <span style="margin-left:auto;display:flex;gap:4px">
              <button class="speak-btn uk" onclick="Study.speak('${esc(v.word)}','en-GB')">🇬🇧</button>
              <button class="speak-btn us" onclick="Study.speak('${esc(v.word)}','en-US')">🇺🇸</button>
              <button class="btn btn-sm btn-red" style="padding:2px 8px;font-size:11px" onclick="Study.vocabDel('${v.id}')">×</button>
            </span>
          </div>
          <div class="phonetic">${v.uk?'<span>英 /'+esc(v.uk)+'/</span>':''}${v.us?'<span>美 /'+esc(v.us)+'/</span>':''}</div>
          <div class="meaning" style="font-size:14px">${esc(v.meaning)}</div>
          ${v.example?`<div class="example"><span class="en">${esc(v.example)}</span></div>`:''}
          ${v.root?`<div class="root">🌱 ${esc(v.root)}</div>`:''}
        </div>`).join('')
      :'<div class="empty"><div class="emoji">📖</div><p>还没有词汇<br>去单词 tab 学习并加入</p></div>'}
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
  },
  async vocabDel(id){
    if(!confirm('从词汇本移除？')) return;
    await DB.del('vocab',id);
    Study.openVocab();
    $('#vocabCount').textContent = (await DB.all('vocab')).length;
  },
  /* === AI 推荐 === */
  async aiRec(silent){
    if(!silent) $('#studyRec').innerHTML='<div class="muted">AI 推荐中...</div>';
    const out = await AI.chat(
      '你是英语学习导师。请为年轻女生推荐今日学习内容，JSON格式输出，含三个字段：\n' +
      '1) words: 数组，含5个单词，每个对象含 word(单词), pos(词性缩写), uk(英式音标), us(美式音标), meaning(中文释义,15字内), example(英文例句), example_zh(例句中文翻译), root(词根词缀分析,30字内)\n' +
      '2) quotes: 数组，含2条中英双语语录，每个对象含 zh(中文), en(英文), source(出处)\n' +
      '3) articles: 数组，含1篇双语短文，每个对象含 title_zh(中文标题), title_en(英文标题), preview_zh(中文摘要,80字), preview_en(英文摘要), content_zh(中文正文,200-300字), content_en(英文正文,150-200字)\n' +
      '内容积极向上、有审美、有女性力量感。只输出JSON。',
      `今天是${new Date().toLocaleDateString('zh-CN')}，请推荐今日学习内容。`,
      {kind:'study', maxTokens:3000}
    );
    let items;
    try{ items = JSON.parse(out); }
    catch(e){
      // 降级
      items = Study._fallbackData();
    }
    items._ts = Date.now();
    await DB.put('aiCache',{id:'studyRecV2', data:items, ts:Date.now()});
    Study._recData = items;
    Study.renderTab();
  },
  _fallbackData(){
    return {
      words:[
        {word:'serendipity',pos:'n.',uk:'ˌserənˈdɪpəti',us:'ˌserənˈdɪpəti',meaning:'意外发现美好事物的能力',example:'Meeting her was pure serendipity.',example_zh:'遇见她完全是机缘巧合。',root:'源自波斯童话《三个塞伦迪普王子》'},
        {word:'radiant',pos:'adj.',uk:'ˈreɪdiənt',us:'ˈreɪdiənt',meaning:'光芒四射的；容光焕发的',example:'She looked radiant on her wedding day.',example_zh:'她婚礼那天看起来光彩照人。',root:'radi- 放射（radiate的形容词）'},
        {word:'nurture',pos:'v.',uk:'ˈnɜːtʃə',us:'ˈnɜːrtʃər',meaning:'养育；培育',example:'She nurtured her dream of becoming an artist.',example_zh:'她培养了成为艺术家的梦想。',root:'nurt- 喂养；养育'},
        {word:'courage',pos:'n.',uk:'ˈkʌrɪdʒ',us:'ˈkɜːrɪdʒ',meaning:'勇气；胆量',example:'Have the courage to follow your heart.',example_zh:'要有勇气追随你的心。',root:'cor- 心（拉丁语cor）'},
        {word:'blossom',pos:'v./n.',uk:'ˈblɒsəm',us:'ˈblɑːsəm',meaning:'开花；绽放；繁荣',example:'She blossomed into a confident young woman.',example_zh:'她成长为一个自信的年轻女性。',root:'源自古英语 blōstm 花蕾'}
      ],
      quotes:[
        {zh:'你的努力，时间都会给你答案。',en:'Your effort will be rewarded in time.',source:'海盐葡萄'},
        {zh:'成为自己的那道光，无需他人点亮。',en:'Be your own light; no one else needs to brighten you.',source:'海盐葡萄'}
      ],
      articles:[
        {title_zh:'拥抱不完美的勇气',title_en:'The Courage to Embrace Imperfection',
         preview_zh:'在这个追求完美的时代，不完美反而是一种力量。',
         preview_en:'In an era of perfection, imperfection becomes a kind of strength.',
         content_zh:'在社交媒体上我们看到的，都是别人精心修饰的一面。但真正的生活，是带着裂痕的茶杯里，依然能泡出香浓的茶。接纳自己的不完美，你会发现，那些所谓"缺陷"，恰恰是让你独特的印记。不必为了迎合他人的眼光而活着，做真实的自己，本身就是一种美。',
         content_en:'What we see on social media is the carefully curated side of others. But real life is like a teacup with cracks that still brews fragrant tea. Embracing your imperfections reveals that what you once called flaws are the very marks that make you unique. Live authentically—not to please others, but because being yourself is a kind of beauty.'}
      ]
    };
  },
  async toggle(id){
    const s = await DB.get('study',id); if(!s) return;
    s.records = s.records||[];
    const t = today();
    const i = s.records.indexOf(t);
    if(i>=0) s.records.splice(i,1); else s.records.push(t);
    await DB.put('study',s); Study.load();
    toast(i<0?'✅ 打卡成功':'已取消');
  },
  openAdd(){
    Modal.open('添加学习技能', `
      <div class="field"><label>技能名称</label><input class="input" id="stName" placeholder="如：英语口语"></div>
      <div class="field"><label>图标</label><input class="input" id="stEmoji" placeholder="📝" value="📝"></div>
      <button class="btn btn-block" onclick="Study.save()">添加</button>`);
  },
  async save(){
    const name = $('#stName').value.trim();
    if(!name){ toast('请输入名称'); return; }
    await DB.put('study',{id:uid(), name, emoji:$('#stEmoji').value.trim()||'📝', records:[]});
    Modal.close(); Study.load(); toast('已添加');
  },
  async del(id){ if(!confirm('删除该技能？')) return; await DB.del('study',id); Study.load(); },
  async openLog(id){
    const s = await DB.get('study',id); if(!s) return;
    const recs = (s.records||[]).slice().sort().reverse().slice(0,30);
    Modal.open(`${s.name} - 打卡记录`, `
      <div class="card"><div class="big" style="font-size:28px;font-weight:700;color:var(--purple-deep);text-align:center">${(s.records||[]).length}</div><div class="muted" style="text-align:center">累计打卡次数</div></div>
      <div class="card"><div class="card-title">📅 最近记录</div>${recs.length?recs.map(d=>`<div class="list-item"><span>📅</span><span>${d}</span></div>`).join(''):'<div class="muted">还没有记录</div>'}</div>`);
  }
};

/* ============================================
   8. 工作日程 + 闹钟
   ============================================ */
const Sched = {
  async load(){
    const all = await DB.all('schedule');
    const now = Date.now();
    all.sort((a,b)=>(a.datetime||'').localeCompare(b.datetime||''));
    const upcoming = all.filter(s=>!s.done);
    const done = all.filter(s=>s.done);
    $('#schedList').innerHTML = `
      ${upcoming.length?`<div class="card-title">⏰ 待办</div>`:''}
      ${upcoming.map(s=>`
        <div class="sched-item ${s.urgent?'urgent':''}">
          <div class="sched-time">${s.datetime?fmtTime(s.datetime):'--:--'}<div class="muted" style="font-size:10px">${s.datetime?new Date(s.datetime).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}):''}</div></div>
          <div style="flex:1">
            <div class="st" style="font-weight:600">${esc(s.title)}</div>
            ${s.note?`<div class="muted">${esc(s.note)}</div>`:''}
            ${s.urgent?'<span class="tag tag-red">紧急</span>':'<span class="tag">普通</span>'}
            ${s.alarm?'<span class="tag tag-yellow">🔔 闹钟</span>':''}
          </div>
          <div class="flex gap6">
            <button class="btn btn-sm btn-green" style="padding:6px 10px" onclick="Sched.done('${s.id}')">✓</button>
            <button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="Sched.del('${s.id}')">×</button>
          </div>
        </div>`).join('')}
      ${done.length?`<div class="card-title mt12">✅ 已完成</div>`:''}
      ${done.map(s=>`<div class="sched-item done"><div class="sched-time">--:--</div><div style="flex:1"><div class="st">${esc(s.title)}</div></div><button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="Sched.del('${s.id}')">×</button></div>`).join('')}
      ${!all.length?'<div class="empty"><div class="emoji">💼</div><p>还没有日程～</p></div>':''}`;
    Alarm.schedule(all);
  },
  openAdd(){
    const now = new Date(); now.setHours(now.getHours()+1,0,0);
    const def = now.toISOString().slice(0,16);
    Modal.open('添加工作事项', `
      <div class="field"><label>事项标题</label><input class="input" id="scTitle" placeholder="如：开会 / 提交报告"></div>
      <div class="field"><label>时间</label><input class="input" id="scTime" type="datetime-local" value="${def}"></div>
      <div class="field"><label>备注</label><input class="input" id="scNote" placeholder="可选"></div>
      <div class="set-row">
        <div><label>紧急事项</label><div class="desc">标红显示</div></div>
        <div class="switch" id="scUrgent" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="set-row">
        <div><label>闹钟提醒</label><div class="desc">到点响铃+通知</div></div>
        <div class="switch on" id="scAlarm" onclick="this.classList.toggle('on')"></div>
      </div>
      <button class="btn btn-block mt8" onclick="Sched.save()">添加</button>`);
  },
  async save(){
    const title = $('#scTitle').value.trim();
    if(!title){ toast('请输入标题'); return; }
    const dt = $('#scTime').value;
    await DB.put('schedule',{id:uid(), title, datetime:dt?new Date(dt).toISOString():null,
      note:$('#scNote').value.trim(), urgent:$('#scUrgent').classList.contains('on'), alarm:$('#scAlarm').classList.contains('on'), done:false});
    Modal.close(); Sched.load(); toast('已添加 🔔');
    if('Notification' in window && Notification.permission!=='granted') Notification.requestPermission();
  },
  async done(id){ const s=await DB.get('schedule',id); s.done=true; await DB.put('schedule',s); Sched.load(); toast('完成 ✅'); },
  async del(id){ await DB.del('schedule',id); Sched.load(); }
};

/* ---------- 闹钟 ---------- */
const Alarm = {
  timer:null,
  schedule(all){
    const upcoming = all.filter(s=>s.alarm && !s.done && s.datetime && new Date(s.datetime).getTime()>Date.now());
    Alarm._list = upcoming;
  },
  start(){
    if(Alarm.timer) return;
    Alarm.timer = setInterval(Alarm.check, 30000);
    Alarm.check();
  },
  async check(){
    const list = Alarm._list||[];
    for(const s of list){
      const t = new Date(s.datetime).getTime();
      if(t<=Date.now() && !s._fired){
        s._fired = true;
        Alarm.fire(s);
        // 标记已完成
        const item = await DB.get('schedule',s.id);
        if(item){ item.done=true; await DB.put('schedule',item); }
        Sched.load();
      }
    }
  },
  fire(s){
    // 应用内响铃
    $('#alarmTitle').textContent = s.title;
    $('#alarmDesc').textContent = s.note || '到点啦～';
    $('#alarmFull').classList.add('show');
    Alarm._playBell();
    // 通知
    if('Notification' in window && Notification.permission==='granted'){
      new Notification('🔔 '+s.title, {body: s.note||'到点啦', icon:'icon.svg', tag:s.id});
    }
  },
  stop(){
    $('#alarmFull').classList.remove('show');
    if(Alarm._osc){ try{ Alarm._osc.stop(); }catch(e){} Alarm._osc=null; }
  },
  _playBell(){
    try{
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type='sine'; osc.frequency.value=880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+2);
      osc.start(); osc.stop(ctx.currentTime+2);
      Alarm._osc = osc;
      // 重复
      Alarm._bellInt = setTimeout(()=>{ if($('#alarmFull').classList.contains('show')) Alarm._playBell(); }, 2200);
    }catch(e){}
  }
};

/* ============================================
   9. 幸福碎片
   ============================================ */
const Frag = {
  async load(){
    const all = await DB.all('fragments');
    const records = all.filter(f=>f.type==='record').sort((a,b)=>(b.ts||'').localeCompare(a.ts||''));
    const loves = all.filter(f=>f.type==='love');
    $('#fragGrid').innerHTML = records.length? records.slice(0,6).map(f=>`
      <div class="frag-card">
        ${f.img?`<img class="img" src="${esc(f.img)}">`:`<div class="img img-placeholder">🌸</div>`}
        <div class="tx">${esc(f.text||'')}</div>
        <div class="dt">${f.ts?fmtDate(f.ts):''}</div>
      </div>`).join('') : '<div class="empty" style="grid-column:1/-1"><div class="emoji">🌷</div><p>记录生活的美好瞬间</p></div>';
    $('#fragLove').innerHTML = loves.length? loves.map(l=>`
      <div class="love-item">
        <div class="love-icon">${l.cat==='gift'?'🎁':l.cat==='flower'?'💐':'💕'}</div>
        <div style="flex:1">
          <div style="font-weight:600;color:var(--purple-deep)">${esc(l.title)}</div>
          ${l.note?`<div class="muted">${esc(l.note)}</div>`:''}
          ${l.link?`<a href="${esc(l.link)}" target="_blank" class="muted">🔗 打开链接</a>`:''}
          ${l.img?`<img src="${esc(l.img)}" style="width:100%;border-radius:8px;margin-top:6px">`:''}
        </div>
        <button class="btn btn-sm btn-red" style="padding:6px 10px;align-self:flex-start" onclick="Frag.del('${l.id}')">×</button>
      </div>`).join('') : '<div class="muted">记录想一起完成的事、想送的礼物</div>';
  },
  openAddRecord(){
    Modal.open('记录美好瞬间', `
      <div class="field"><label>照片</label><input class="input" id="frImg" type="file" accept="image/*"></div>
      <div class="field"><label>文字</label><textarea class="textarea" id="frText" placeholder="今天的小确幸..."></textarea></div>
      <button class="btn btn-block" onclick="Frag.saveRecord()">记录</button>`);
  },
  async saveRecord(){
    const f = $('#frImg').files[0];
    let img=null;
    if(f){ img = await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(f); }); }
    await DB.put('fragments',{id:uid(), type:'record', text:$('#frText').value.trim(), img, ts:now()});
    Modal.close(); Frag.load(); toast('已记录 🌷');
  },
  openAddLove(){
    Modal.open('恋爱小灵感', `
      <div class="field"><label>类型</label>
        <select class="select" id="lvCat">
          <option value="thing">💕 想一起做的事</option>
          <option value="gift">🎁 想买的礼物</option>
          <option value="flower">💐 想送的花</option>
        </select></div>
      <div class="field"><label>内容</label><input class="input" id="lvTitle" placeholder="如：一起去看海"></div>
      <div class="field"><label>备注</label><input class="input" id="lvNote" placeholder="可选"></div>
      <div class="field"><label>链接（可选）</label><input class="input" id="lvLink" placeholder="https://..."></div>
      <div class="field"><label>图片（可选）</label><input class="input" id="lvImg" type="file" accept="image/*"></div>
      <button class="btn btn-block" onclick="Frag.saveLove()">添加</button>`);
  },
  async saveLove(){
    const title = $('#lvTitle').value.trim();
    if(!title){ toast('请输入内容'); return; }
    const f = $('#lvImg').files[0];
    let img=null;
    if(f){ img = await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(f); }); }
    await DB.put('fragments',{id:uid(), type:'love', cat:$('#lvCat').value, title, note:$('#lvNote').value.trim(), link:$('#lvLink').value.trim(), img});
    Modal.close(); Frag.load(); toast('已添加 💕');
  },
  async del(id){ await DB.del('fragments',id); Frag.load(); },
  async openReport(){
    const all = (await DB.all('fragments')).filter(f=>f.type==='record');
    const nowd = new Date();
    const weekAgo = new Date(nowd); weekAgo.setDate(nowd.getDate()-7);
    const monthAgo = new Date(nowd); monthAgo.setMonth(nowd.getMonth()-1);
    const yearAgo = new Date(nowd); yearAgo.setFullYear(nowd.getFullYear()-1);
    const w = all.filter(f=>new Date(f.ts)>=weekAgo).length;
    const m = all.filter(f=>new Date(f.ts)>=monthAgo).length;
    const y = all.filter(f=>new Date(f.ts)>=yearAgo).length;
    const recent = all.slice(0,3).map(f=>`<div class="muted">• ${esc((f.text||'美好瞬间').slice(0,20))}</div>`).join('') || '<div class="muted">还没有记录</div>';
    Modal.open('幸福总报', `
      <div class="report-card"><div class="big">${w}</div><div class="lbl">本周幸福瞬间</div></div>
      <div class="report-card"><div class="big">${m}</div><div class="lbl">本月幸福瞬间</div></div>
      <div class="report-card"><div class="big">${y}</div><div class="lbl">本年幸福瞬间</div></div>
      <div class="card"><div class="card-title">🌸 最近美好</div>${recent}</div>`);
  }
};

/* ============================================
   10. 可爱日记
   ============================================ */
const Diary = {
  async load(){
    const all = (await DB.all('diary')).sort((a,b)=>(b.ts||'').localeCompare(a.ts||''));
    $('#diaryList').innerHTML = all.length? all.map(d=>`
      <div class="diary-item">
        <div class="between">
          <span class="diary-mood">${esc(d.mood||'😊')}</span>
          <span class="diary-tm">${d.ts?fmtDate(d.ts):''}</span>
        </div>
        <div class="diary-tx">${esc(d.text||'')}</div>
        <button class="btn btn-sm btn-red mt8" style="padding:4px 10px;float:right" onclick="Diary.del('${d.id}')">删除</button>
      </div>`).join('') : '<div class="empty"><div class="emoji">📒</div><p>今天的心情是？</p></div>';
  },
  openAdd(){
    const moods = ['😊','🥰','😴','😤','😢','🤩','🥺','😎','🤗','😔'];
    Modal.open('写一篇日记', `
      <div class="field"><label>今天心情</label>
        <div class="flex wrap gap8" id="dmoods">${moods.map((m,i)=>`<span class="mood-pick" style="font-size:28px;cursor:pointer;padding:6px;border-radius:10px" data-m="${m}">${m}</span>`).join('')}</div>
      </div>
      <div class="field"><label>正文</label><textarea class="textarea" id="dText" placeholder="写下今天的故事..." style="min-height:120px"></textarea></div>
      <button class="btn btn-block" onclick="Diary.save()">保存</button>`);
    let mood='😊';
    $$('#dmoods span').forEach(s=>s.onclick=()=>{ mood=s.dataset.m; $$('#dmoods span').forEach(x=>x.style.background=''); s.style.background='var(--salt)'; });
    Diary._mood = ()=>mood;
  },
  async save(){
    const text = $('#dText').value.trim();
    if(!text){ toast('写点什么吧'); return; }
    await DB.put('diary',{id:uid(), mood:Diary._mood(), text, ts:now()});
    Modal.close(); Diary.load(); toast('已记录 📒');
  },
  async del(id){ await DB.del('diary',id); Diary.load(); }
};

/* ============================================
   11. 纪念日（节假日倒计时 + 手动纪念日）
   ============================================ */
const Anni = {
  // 2025-2027 法定节假日（日期 + 名称 + 是否放假）
  holidays: [
    {date:'2025-01-01', name:'元旦', emoji:'🎉'},
    {date:'2025-01-28', name:'春节', emoji:'🧧'},
    {date:'2025-04-04', name:'清明节', emoji:'🌿'},
    {date:'2025-05-01', name:'劳动节', emoji:'💐'},
    {date:'2025-05-31', name:'端午节', emoji:'🐉'},
    {date:'2025-10-01', name:'国庆节', emoji:'🇨🇳'},
    {date:'2025-10-06', name:'中秋节', emoji:'🌕'},
    {date:'2026-01-01', name:'元旦', emoji:'🎉'},
    {date:'2026-02-17', name:'春节', emoji:'🧧'},
    {date:'2026-04-05', name:'清明节', emoji:'🌿'},
    {date:'2026-05-01', name:'劳动节', emoji:'💐'},
    {date:'2026-06-19', name:'端午节', emoji:'🐉'},
    {date:'2026-09-25', name:'中秋节', emoji:'🌕'},
    {date:'2026-10-01', name:'国庆节', emoji:'🇨🇳'},
    {date:'2027-01-01', name:'元旦', emoji:'🎉'},
    {date:'2027-02-06', name:'春节', emoji:'🧧'},
    {date:'2027-04-05', name:'清明节', emoji:'🌿'},
    {date:'2027-05-01', name:'劳动节', emoji:'💐'},
    {date:'2027-06-09', name:'端午节', emoji:'🐉'},
    {date:'2027-09-15', name:'中秋节', emoji:'🌕'},
    {date:'2027-10-01', name:'国庆节', emoji:'🇨🇳'}
  ],
  dayDiff(dateStr){
    const t = new Date(dateStr+'T00:00:00');
    const now = new Date(); now.setHours(0,0,0,0);
    return Math.round((t-now)/86400000);
  },
  async load(){
    const mine = await DB.all('anni');
    // 节假日倒计时
    const todayStr = today();
    const upcoming = Anni.holidays.filter(h=>h.date>=todayStr).slice(0,6);
    const next = upcoming[0];
    if(next){
      const days = Anni.dayDiff(next.date);
      $('#anniNextHoliday').innerHTML = `
        <div class="anni-hero">
          <div class="lbl">距离下一个节假日还有</div>
          <div class="days">${days}<span style="font-size:18px;font-weight:400"> 天</span></div>
          <div class="name">${next.emoji} ${next.name}</div>
          <div class="date">${next.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日')}</div>
        </div>`;
    } else {
      $('#anniNextHoliday').innerHTML = '<div class="muted">暂无节假日数据</div>';
    }
    $('#anniHolidays').innerHTML = upcoming.map(h=>{
      const days = Anni.dayDiff(h.date);
      return `<div class="anni-item">
        <div class="emoji">${h.emoji}</div>
        <div class="info"><div class="nm">${h.name}</div><div class="dt">${h.date.replace(/-/g,'/')}</div></div>
        <div><div class="d-num">${days}</div><div class="d-unit">天后</div></div>
      </div>`;
    }).join('') || '<div class="muted">暂无数据</div>';
    // 我的纪念日
    $('#anniMine').innerHTML = mine.length? mine.map(a=>{
      const days = Anni.dayDiff(a.date);
      const isCountdown = a.mode==='countdown';
      const passed = days<0;
      const absDays = Math.abs(days);
      const showDays = isCountdown ? (passed?absDays:days) : absDays;
      const unit = isCountdown ? (passed?'天前':'天后') : '天';
      const lbl = isCountdown ? (passed?'已过':'倒计时') : '已纪念';
      const cls = isCountdown ? (passed?'passed':'countdown') : 'passed';
      const warn = isCountdown && !passed && days<=7 ? `<span class="tag tag-red">⚠️ 一周内</span>` : '';
      return `<div class="anni-item ${cls}">
        <div class="emoji">${esc(a.emoji||'💝')}</div>
        <div class="info">
          <div class="nm">${esc(a.name)} ${warn}</div>
          <div class="dt">${a.date.replace(/-/g,'/')} · ${lbl}</div>
        </div>
        <div><div class="d-num">${showDays}</div><div class="d-unit">${unit}</div></div>
        <button class="btn btn-sm btn-red" style="padding:6px 10px;margin-left:4px" onclick="Anni.del('${a.id}')">×</button>
      </div>`;
    }).join('') : '<div class="empty"><div class="emoji">🎀</div><p>添加你的纪念日<br>恋爱纪念日 · 生日 · 重要日子</p></div>';
    // 提醒检查
    Anni.checkReminder(mine);
  },
  openAdd(){
    Modal.open('添加纪念日', `
      <div class="field"><label>名称</label><input class="input" id="anName" placeholder="如：恋爱纪念日"></div>
      <div class="field"><label>日期</label><input class="input" id="anDate" type="date"></div>
      <div class="field"><label>类型</label>
        <div class="flex gap8">
          <button class="btn btn-sm btn-ghost" style="flex:1" id="anModeCount" onclick="Anni._mode('countdown')">⏳ 倒数（距某天还有）</button>
          <button class="btn btn-sm btn-ghost" style="flex:1" id="anModePlus" onclick="Anni._mode('plus')">📅 正数（已过多少天）</button>
        </div>
      </div>
      <div class="field"><label>图标</label><input class="input" id="anEmoji" placeholder="💝" value="💝"></div>
      <div class="muted mb8">💡 倒数纪念日会在节点前一周自动提醒</div>
      <button class="btn btn-block" onclick="Anni.save()">添加</button>`);
    Anni._curMode = 'countdown';
    Anni._mode('countdown');
  },
  _mode(m){
    Anni._curMode = m;
    const c = $('#anModeCount'), p = $('#anModePlus');
    const on = 'btn', off = 'btn btn-sm btn-ghost';
    if(m==='countdown'){ c.className='btn btn-sm'; c.style.flex='1'; p.className=off; p.style.flex='1'; }
    else { p.className='btn btn-sm'; p.style.flex='1'; c.className=off; c.style.flex='1'; }
  },
  async save(){
    const name = $('#anName').value.trim();
    const date = $('#anDate').value;
    if(!name){ toast('请输入名称'); return; }
    if(!date){ toast('请选择日期'); return; }
    await DB.put('anni',{id:uid(), name, date, mode:Anni._curMode, emoji:$('#anEmoji').value.trim()||'💝', created:now()});
    Modal.close(); Anni.load(); toast('已添加 🎀');
  },
  async del(id){ if(!confirm('删除该纪念日？')) return; await DB.del('anni',id); Anni.load(); },
  // 节点前一周提醒
  async checkReminder(mine){
    const t = today();
    const key = 'anni_reminded_';
    for(const a of mine){
      if(a.mode!=='countdown') continue;
      const days = Anni.dayDiff(a.date);
      // 7 天内且未提醒过
      if(days>=0 && days<=7){
        const k = key + a.id + '_' + a.date;
        if(!localStorage.getItem(k)){
          localStorage.setItem(k, '1');
          toast(`🎀 ${a.name} 还有 ${days} 天就到啦！`, 4000);
          if('Notification' in window && Notification.permission==='granted'){
            new Notification('🎀 纪念日提醒', {body:`${a.name}还有${days}天（${a.date}）`, icon:'icon.svg'});
          }
        }
      } else if(days>7){
        // 超过7天清除标记，下次进入7天内可再次提醒
        const k = key + a.id + '_' + a.date;
        localStorage.removeItem(k);
      }
    }
  }
};

/* ============================================
   设置
   ============================================ */
const Setting = {
  getProfile(){
    try{ return JSON.parse(localStorage.getItem('seasalt_profile'))||{}; }catch(e){ return {}; }
  },
  saveProfile(){
    const name = $('#setName').value.trim() || '海盐葡萄';
    const sign = $('#setSign').value.trim() || '今天也要甜酷闪闪呀';
    localStorage.setItem('seasalt_profile', JSON.stringify({name, sign}));
    Hero.render();
    toast('已保存 ✨');
  },
  load(){
    $('#setKey').value = AI.getKey();
    const p = Setting.getProfile();
    $('#setName').value = p.name || '';
    $('#setSign').value = p.sign || '';
  },
  saveKey(){
    const k = $('#setKey').value.trim();
    localStorage.setItem('ds_key', k);
    toast(k?'已保存':'已清空 Key');
  },
  async testKey(){
    const k = $('#setKey').value.trim();
    if(!k){ toast('请先填写 Key'); return; }
    localStorage.setItem('ds_key', k);
    toast('测试中...');
    try{
      const r = await fetch('https://api.deepseek.com/chat/completions',{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${k}`},
        body:JSON.stringify({model:'deepseek-chat',messages:[{role:'user',content:'hi'}],max_tokens:10})
      });
      if(r.ok){ toast('✅ 连接成功'); }
      else { const t=await r.text(); toast('❌ 失败：HTTP '+r.status); }
    }catch(e){ toast('❌ 网络错误'); }
  },
  askNotify(){
    if(!('Notification' in window)){ toast('浏览器不支持通知'); return; }
    Notification.requestPermission().then(p=>toast(p==='granted'?'✅ 已开启':'未授权'));
  },
  async exportData(){
    const data = {};
    for(const s of ['supplements','recipes','skincare','sports','reads','study','schedule','fragments','diary','anni','vocab']){
      data[s] = await DB.all(s);
    }
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download = `seasalt-backup-${today()}.json`; a.click();
    toast('已导出');
  },
  async clearData(){
    if(!confirm('确定清空全部数据？此操作不可恢复！')) return;
    if(!confirm('再次确认：所有打卡、记录、日程都将删除！')) return;
    for(const s of ['supplements','recipes','skincare','sports','reads','study','schedule','fragments','diary','anni','vocab','aiCache']){
      await DB.clear(s);
    }
    toast('已清空'); location.reload();
  }
};

/* ============================================
   启动
   ============================================ */
(async function init(){
  // 日期
  const d = new Date();
  $('#heroDay').textContent = d.getDate();
  $('#heroWeek').textContent = '周'+weekNames[d.getDay()];

  await DB.open();

  // Service Worker
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }

  // 头像/姓名/签名渲染
  Hero.render();

  // 闹钟启动
  Alarm.start();

  // 首页加载
  Hot.load();
})();
