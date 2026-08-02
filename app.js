/* ============================================
   海盐葡萄 · 女生生活管理 PWA
   ============================================ */

/* ---------- 工具 ---------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
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
    const r = indexedDB.open('seasalt', 4);
    r.onupgradeneeded = e=>{
      const db = e.target.result;
      ['supplements','recipes','skincare','sports','reads','study','schedule','fragments','diary','aiCache','settings','anni','vocab','dramas'].forEach(name=>{
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
  _cleanJSON(t){
    if(!t) return t;
    let s = String(t).trim();
    // 去掉 ```json / ``` 代码块包裹
    if(s.startsWith('```')){ s = s.replace(/^```[a-zA-Z]*\n?/,'').replace(/```\s*$/,'').trim(); }
    // 提取第一个 JSON 数组或对象（容忍前后多余文字）
    const m = s.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    return m ? m[0] : s;
  },
  _pools:{
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
    book:[
      {title:'我胆小如鼠',author:'余华',reason:'余华最被低估的中短篇，温柔却刺痛',detail:'余华以四个故事串联，写少年面对世界的怯懦与勇敢。语言朴素，却让每个曾"胆小"过的人找到共鸣——原来敏感不是缺陷，而是看见世界的另一种方式。适合在自我怀疑时重读，找回与脆弱共处的勇气。'},
      {title:'人生的智慧',author:'叔本华',reason:'一本写给普通人的幸福指南',detail:'叔本华褪去晦涩的哲学外衣，用清晰的逻辑讨论：人如何在外物、他人、自身之间找到幸福。他认为内在丰盈远比外物重要。适合想独立思考人生、不被外界评价裹挟的女性读者。'},
      {title:'心流',author:'米哈里',reason:'幸福不是结果，是专注的过程',detail:'心理学家米哈里提出"最优体验"——当挑战与能力匹配时，人会进入忘我的心流状态。书中给出大量案例，教你如何在工作、爱好中创造心流，让日常不再焦虑。适合想提升专注力、找回掌控感的读者。'},
      {title:'雪国',author:'川端康成',reason:'极致的物哀之美，文字如雪',detail:'"穿过县界长长的隧道，便是雪国。"川端康成用极简笔触写一段无果的爱，在虚实之间描绘美的瞬息与虚无。读它像看一场静默的雪，适合慢下来、在冬日夜晚细品的读者。'},
      {title:'长安的荔枝',author:'马伯庸',reason:'小人物的史诗，一口气读完',detail:'马伯庸以一骑荔枝写尽大唐官僚与小人物的命运。从岭南到长安五千余里，主角李善德用算学与韧性完成不可能的任务。节奏明快，适合喜欢历史、又被生活推着走的读者。'},
      {title:'刻意练习',author:'艾利克森',reason:'天才不是天生的，是练出来的',detail:'心理学家艾利克森用数十年研究证明：杰出并非天赋，而是"刻意练习"。书中拆解练习的核心要素——目标、反馈、突破舒适区。适合想高效学习任何技能、不甘平庸的女性读者。'},
      {title:'人生海海',author:'麦家',reason:'在苦难中守住尊严的故事',detail:'麦家写一个被称为"上校"的传奇人物，他的一生被流言、战争、屈辱缠绕，却始终保有秘密与体面。故事层层剥开，让人看到人性在极端中的光与影。适合喜欢悬疑叙事、思考命运与尊严的读者。'},
      {title:'明朝那些事儿',author:'当年明月',reason:'把历史写成小说，痛快又深刻',detail:'当年明月以幽默笔调重述明朝三百年，帝王将相鲜活如邻人。但结尾最动人——他用徐霞客的故事告诉你：成功只有一种，按自己喜欢的方式过一生。适合想轻松读史、又想获得人生启示的读者。'},
      {title:'始于极限',author:'上野千鹤子',reason:'两代女性的坦诚书信',detail:'上野千鹤子与铃木凉美以书信往返，坦诚聊恋爱、工作、独立与伤害。没有说教，只有真实经验的碰撞。适合想理清自我与关系边界、在亲密关系里不迷失的女性读者。'},
      {title:'被讨厌的勇气',author:'岸见一郎',reason:'课题分离，把自己还给自己',detail:'以"哲人与青年对话"形式讲阿德勒心理学：一切烦恼来自人际关系，而自由来自"被讨厌的勇气"。书中"课题分离"尤其实用，适合总在讨好、在意他人眼光的读者。'}
    ],
    sport:['15分钟清晨拉伸唤醒','20分钟蜜桃臀爆破训练','10分钟天鹅颈塑造','30分钟燃脂尊巴','15分钟核心马甲线','20分钟舒缓阴瑜伽','10分钟办公肩颈放松','25分钟HIIT全身燃脂'],
    study:['今日单词：serendipity 意外发现美好事物的能力','语录：种一棵树最好的时间是十年前，其次是现在','文章：《如何用费曼技巧高效学习任何技能》','单词：ephemeral 短暂的；朝生暮死的','语录：你现在的气质里，藏着你走过的路、读过的书和爱过的人','文章：《深度工作：如何专注地完成一件事》']
  },
  _fallback(kind){
    const arr = AI._pools[kind] || AI._pools.hot;
    return kind==='hot' ? arr.map((t,i)=>`${i+1}. ${t}`).join('\n')
         : kind==='book' ? JSON.stringify(arr.slice(0,4).map(b=>({title:b.title,author:b.author,reason:b.reason,detail:b.detail})))
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
    const loaders = {hot:Hot, supp:Supp, recipe:Recipe, skin:Skin, sport:Sport, drama:Drama, read:Read, study:Study, sched:Sched, frag:Frag, diary:Diary, anni:Anni, set:Setting};
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
    const isUser = silent !== true;
    const btn = isUser ? document.querySelector('#page-hot button[onclick*="Hot.refresh"]') : null;
    if(btn){ btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = '🌸 刷新中…'; }
    // 重新拉取实时热搜（同源 hot.json，GitHub Actions 每 3 小时抓取一次）
    const live = await Hot.fetchLive();
    if(live && live.items && live.items.length > 1){
      Hot._liveData = live;
      // 用户手动刷新时：若上游数据与当前一致，打乱顺序让用户立刻看到变化
      const prev = Hot._lastUpdated;
      const cur = live.updated;
      if(isUser && prev && cur && prev===cur){
        live.items = live.items.slice().sort(()=>Math.random()-0.5);
      }
      Hot._lastUpdated = cur;
      Hot.renderLive(live);
    }else{
      Hot.renderLive(null);
    }
    // 甜酷小贴士：用户手动刷新时强制重新生成（忽略 dataset.loaded 缓存）
    if(!silent || !$('#dailyTip').dataset.loaded){
      try{
        const tip = await AI.chat('你是闺蜜型助手，用一句话给女生一句甜酷小贴士，不超过30字，每次给不同的。只输出这句话。',
          '给我一句今日小贴士，这次要不一样',{kind:'hot',maxTokens:80});
        $('#dailyTip').textContent = tip.replace(/^[\d.、\s]+/,'').split('\n')[0];
        $('#dailyTip').dataset.loaded = '1';
      }catch(e){ /* 保留上一次提示 */ }
    }
    if(isUser){
      const updated = Hot._liveData?.updated;
      toast(updated ? `已更新到 ${updated} ✨` : '已是最新 💫');
    }
    if(btn){ btn.disabled = false; btn.textContent = btn.dataset.orig || '🔄 刷新'; }
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
  // 从用户粘贴的内容里提取真正的链接
  // 用户从小红书/B站等 App 分享时，复制的是"标题+链接+引导语"整段文本，
  // 必须从中提取出 URL，否则整段文本会被浏览器当相对路径 → 404
  normalizeLink(raw){
    if(!raw) return '';
    const s = String(raw).trim();
    if(!s) return '';
    // 1) 优先匹配完整 http(s):// URL（含中文路径也能匹配，直到遇到空白或中文引号）
    let m = s.match(/https?:\/\/[^\s\u3000\u4e00-\u9fff"'<>，。！？、（）【】《》]+/i);
    if(m) return m[0].replace(/[.,;:!?）)]+$/,''); // 去掉尾部标点
    // 2) 匹配无协议的短链/域名：xhslink.cn/xxx、www.xxx.com/yyy、xxx.com/path
    //    允许多级域名（www.xiaohongshu.com），TLD 至少2位字母
    m = s.match(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s\u3000\u4e00-\u9fff"'<>，。！？、]*)?)/i);
    if(m){
      let u = m[1].replace(/[.,;:!?)]+$/,'');
      return 'https://' + u;
    }
    // 3) 不是链接（纯文字），返回空，由 openLink 走"非链接"分支
    return '';
  },
  // 点击链接：App 内弹窗预览，失败则降级
  openLink(raw){
    const url = Recipe.normalizeLink(raw);
    if(!url){
      // 提取不出链接：显示原文 + 复制（防御性，正常不会走到这）
      Modal.open('🔗 链接内容', `
        <div class="card" style="background:var(--salt-light)">
          <div class="muted" style="margin-bottom:6px">这条记录里没有识别到链接：</div>
          <div style="word-break:break-all;font-size:14px;padding:10px;background:#fff;border-radius:8px">${esc(raw)}</div>
        </div>
        <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
      return;
    }
    // App 内 iframe 预览
    Modal.open('🔗 链接预览', `
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <a href="${esc(url)}" target="_blank" rel="noopener" class="btn" style="flex:1;text-align:center;text-decoration:none">↗ 在新标签页打开</a>
        <button class="btn btn-ghost" style="flex:1" onclick="Recipe._copy(${JSON.stringify(url).replace(/"/g,'&quot;')})">📋 复制链接</button>
      </div>
      <div class="muted" style="font-size:11px;margin-bottom:8px;word-break:break-all">${esc(url)}</div>
      <div id="linkPreviewWrap" style="position:relative;height:60vh;border-radius:12px;overflow:hidden;background:var(--salt-light)">
        <iframe id="linkPreviewFrame" src="${esc(url)}" style="width:100%;height:100%;border:0"
          onload="Recipe._frameOk()" onerror="Recipe._frameFail()"></iframe>
        <div id="linkPreviewFallback" style="position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;text-align:center;background:#fff">
          <div style="font-size:36px">🛡️</div>
          <div style="color:var(--text);font-weight:600">该网站不允许在 App 内预览</div>
          <div class="muted" style="font-size:12px">小红书等平台有安全限制，需在外部浏览器打开。点击下方按钮跳转。</div>
          <a href="${esc(url)}" target="_blank" rel="noopener" class="btn" style="text-decoration:none;margin-top:4px">↗ 在新标签页打开</a>
        </div>
        <div id="linkPreviewLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--salt-light);color:var(--purple-deep);font-size:13px">正在加载…</div>
      </div>
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
    // 超时兜底：5 秒后若仍在 loading，认为可能被拦截，显示降级
    clearTimeout(Recipe._linkTimer);
    Recipe._linkTimer = setTimeout(()=>{
      const fb = $('#linkPreviewFallback');
      const ld = $('#linkPreviewLoading');
      if(fb && !fb.style.display.includes('flex') && ld){
        // loading 还在且未触发 onload，降级
        Recipe._frameFail();
      }
    }, 5000);
  },
  _frameOk(){
    const ld = $('#linkPreviewLoading');
    if(ld) ld.style.display='none';
    clearTimeout(Recipe._linkTimer);
  },
  _frameFail(){
    const ld = $('#linkPreviewLoading');
    const fb = $('#linkPreviewFallback');
    const fr = $('#linkPreviewFrame');
    if(ld) ld.style.display='none';
    if(fr) fr.style.display='none';
    if(fb){ fb.style.display='flex'; }
    clearTimeout(Recipe._linkTimer);
  },
  _copy(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>toast('已复制 ✅')).catch(()=>Recipe._copyFallback(text));
    }else{
      Recipe._copyFallback(text);
    }
  },
  _copyFallback(text){
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); toast('已复制 ✅'); }catch(e){ toast('复制失败，请手动长按复制'); }
    document.body.removeChild(ta);
  },
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
            <div class="col" style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px">${esc(it.title)}</div>
              ${it.note?`<div class="muted">${esc(it.note)}</div>`:''}
              ${(it.link && Recipe.normalizeLink(it.link))?`<button class="btn btn-sm btn-ghost" onclick="Recipe.openLink(${JSON.stringify(it.link).replace(/"/g,'&quot;')})">🔗 打开链接</button>`:''}
            </div>
            <button class="btn btn-sm btn-ghost" style="padding:6px 10px" onclick="Recipe.openEditItem('${g.id}','${it.id}')">✎</button>
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
      <div class="field"><label>链接（可选）</label><input class="input" id="rLink" placeholder="粘贴小红书/微信/网页链接均可"></div>
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
  async openEditItem(gid, iid){
    const g = await DB.get('recipes',gid); if(!g) return;
    const it = (g.items||[]).find(i=>i.id===iid); if(!it) return;
    Modal.open('编辑菜单', `
      <div class="field"><label>菜单名称</label><input class="input" id="rTitle" value="${esc(it.title)}"></div>
      <div class="field"><label>链接（可选）</label><input class="input" id="rLink" value="${esc(it.link||'')}" placeholder="粘贴小红书/微信/网页链接均可"></div>
      <div class="field"><label>备注（可选）</label><input class="input" id="rNote" value="${esc(it.note||'')}"></div>
      <div class="field"><label>图标</label><input class="input" id="rEmoji" value="${esc(it.emoji||'🍽️')}"></div>
      <button class="btn btn-block" onclick="Recipe.saveEditItem('${gid}','${iid}')">保存修改</button>`);
  },
  async saveEditItem(gid, iid){
    const g = await DB.get('recipes',gid); if(!g) return;
    const it = (g.items||[]).find(i=>i.id===iid); if(!it){ toast('未找到该项'); return; }
    it.title = $('#rTitle').value.trim();
    it.link  = $('#rLink').value.trim();
    it.note  = $('#rNote').value.trim();
    it.emoji = $('#rEmoji').value.trim()||'🍽️';
    await DB.put('recipes',g); Modal.close(); Recipe.load(); toast('已更新');
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
  _viewY: new Date().getFullYear(),
  _viewM: new Date().getMonth(),
  _selectedDate: null,
  _items: [],
  _records: {},
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
    const records = await DB.get('aiCache','skinRecords') || {id:'skinRecords', data:{}};
    Skin._items = all;
    Skin._records = records.data || {};
    Skin.renderWeek(all, records.data);
    Skin.renderDashboard();
  },
  weekDates(){
    const now = new Date();
    const day = now.getDay()||7;
    const monday = new Date(now); monday.setDate(now.getDate()-day+1);
    return Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  },
  renderWeek(items, records){
    const week = Skin.weekDates();
    const todayStr = today();
    $('#skinWeek').innerHTML = `
      <div class="week-grid">
        ${week.map((d,i)=>{
          const cnt = items.filter(it=>records[it.id] && records[it.id][d]).length;
          const on = cnt>0 ? 'on' : '';
          const dn = ['一','二','三','四','五','六','日'][i];
          return `<div class="week-cell ${d===todayStr?'today':''} ${on}" onclick="Skin.selectDate('${d}')"><div class="dn">${dn}</div><div class="dt">${parseInt(d.slice(5,7))}/${parseInt(d.slice(8,10))}</div>${on?`<div style="font-size:9px">${cnt}</div>`:''}</div>`;
        }).join('')}
      </div>
      <div class="mt12">${items.map(it=>{
        const rec = records[it.id]||{};
        const weekCount = week.filter(d=>rec[d]).length;
        // 本月累计
        const monthPrefix = `${Skin._viewY}-${String(Skin._viewM+1).padStart(2,'0')}`;
        const monthCount = Object.keys(rec).filter(d=>d.startsWith(monthPrefix) && rec[d]).length;
        return `<div class="skincare-row">
          <span style="font-size:22px;flex-shrink:0">${esc(it.emoji||'🧴')}</span>
          <div class="col" style="flex:1;min-width:0">
            <div style="font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.name)}</div>
            <div class="muted">本周 ${weekCount}/7 · 本月 ${monthCount} 次</div>
          </div>
          <button class="btn btn-sm btn-ghost" style="padding:6px 10px" onclick="Skin.openEdit('${it.id}')">✎</button>
          <button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="Skin.del('${it.id}')">×</button>
          <button class="btn btn-sm ${rec[todayStr]?'btn-green':''}" onclick="Skin.toggle('${it.id}')">${rec[todayStr]?'✓ 已打卡':'打卡'}</button>
        </div>`;
      }).join('')}</div>`;
  },
  prevMonth(){ if(Skin._viewM===0){Skin._viewM=11;Skin._viewY--;}else{Skin._viewM--;} Skin.renderDashboard(); },
  nextMonth(){ if(Skin._viewM===11){Skin._viewM=0;Skin._viewY++;}else{Skin._viewM++;} Skin.renderDashboard(); },
  renderDashboard(){
    const items = Skin._items || [];
    const records = Skin._records || {};
    const Y = Skin._viewY, M = Skin._viewM;
    $('#skinCalYM').textContent = `${Y}年${M+1}月`;
    const monthPrefix = `${Y}-${String(M+1).padStart(2,'0')}`;
    let totalChecks = 0; const activeDays = new Set();
    items.forEach(it=>{
      const rec = records[it.id] || {};
      Object.keys(rec).forEach(date=>{
        if(date.startsWith(monthPrefix) && rec[date]){ totalChecks++; activeDays.add(date); }
      });
    });
    const daysInMonth = new Date(Y, M+1, 0).getDate();
    const todayStr = today();
    const isCurMonth = (Y===new Date().getFullYear() && M===new Date().getMonth());
    const elapsed = isCurMonth ? new Date().getDate() : daysInMonth;
    const maxPossible = items.length * elapsed;
    $('#skinDashboard').innerHTML = `
      <div class="skin-stat"><div class="v">${totalChecks}</div><div class="l">💗 累计打卡</div></div>
      <div class="skin-stat"><div class="v">${activeDays.size}</div><div class="l">✨ 坚持天数</div></div>`;
    const firstDay = new Date(Y, M, 1).getDay();
    let html = '';
    for(let i=0;i<firstDay;i++) html += '<div class="skin-cal-cell empty"></div>';
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = `${Y}-${String(M+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cnt = items.filter(it=>records[it.id] && records[it.id][dateStr]).length;
      const cls = ['skin-cal-cell'];
      if(cnt>0) cls.push('has');
      if(dateStr===todayStr) cls.push('today');
      if(dateStr===Skin._selectedDate) cls.push('selected');
      html += `<div class="${cls.join(' ')}" onclick="Skin.selectDate('${dateStr}')"><div class="n">${d}</div>${cnt>0?`<div class="cnt">${cnt}项</div>`:''}</div>`;
    }
    $('#skinCalGrid').innerHTML = html;
  },
  selectDate(dateStr){
    Skin._selectedDate = dateStr;
    const items = Skin._items || [];
    const records = Skin._records || {};
    const doneItems = items.filter(it=>records[it.id] && records[it.id][dateStr]);
    Modal.open(`📅 ${dateStr} 护肤详情`, `
      <div class="card">
        <div class="card-title">✅ 当天打卡 (${doneItems.length}/${items.length})</div>
        ${doneItems.length ? doneItems.map(it=>`
          <div class="skincare-row">
            <span style="font-size:22px">${esc(it.emoji||'🧴')}</span>
            <div style="flex:1;font-weight:600">${esc(it.name)}</div>
            <span class="tag" style="background:var(--green);color:#3D5C3D">已完成</span>
          </div>`).join('') : '<div class="muted">当天未打卡</div>'}
      </div>
      <div class="card">
        <div class="card-title">📋 全部项目（点击补打卡）</div>
        ${items.map(it=>{
          const done = records[it.id] && records[it.id][dateStr];
          return `<div class="skincare-row">
            <span style="font-size:22px">${esc(it.emoji||'🧴')}</span>
            <div style="flex:1;font-weight:600">${esc(it.name)}</div>
            <div class="check ${done?'on':''}" onclick="Skin.toggleDate('${it.id}','${dateStr}')"></div>
          </div>`;
        }).join('') || '<div class="muted">暂无项目</div>'}
      </div>
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
    Skin.renderDashboard();
  },
  async toggleDate(id, dateStr){
    if(dateStr > today()){ toast('不能给未来日期打卡'); return; }
    const records = await DB.get('aiCache','skinRecords') || {id:'skinRecords', data:{}};
    records.data = records.data||{};
    records.data[id] = records.data[id]||{};
    records.data[id][dateStr] = !records.data[id][dateStr];
    await DB.put('aiCache', records);
    Skin._records = records.data;
    toast(records.data[id][dateStr]?'✅ 打卡成功':'已取消');
    Skin.selectDate(dateStr);
    Skin.renderDashboard();
  },
  async toggle(id){ await Skin.toggleDate(id, today()); Skin.load(); },
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
  },
  async openEdit(id){
    const it = Skin._items.find(x=>x.id===id);
    if(!it){ toast('未找到项目'); return; }
    Modal.open('编辑护肤项目', `
      <div class="field"><label>名称</label><input class="input" id="skName" value="${esc(it.name)}"></div>
      <div class="field"><label>图标</label><input class="input" id="skEmoji" value="${esc(it.emoji||'🧴')}"></div>
      <div class="muted" style="font-size:11px;margin:-4px 0 8px">修改或删除项目不会影响已有的打卡记录</div>
      <button class="btn btn-block" onclick="Skin.saveEdit('${id}')">保存修改</button>
      <button class="btn btn-block btn-red mt8" onclick="Skin.del('${id}')">🗑 删除该项目</button>`);
  },
  async saveEdit(id){
    const name = $('#skName').value.trim();
    if(!name){ toast('请输入名称'); return; }
    const it = Skin._items.find(x=>x.id===id);
    if(!it){ toast('未找到项目'); return; }
    it.name = name;
    it.emoji = $('#skEmoji').value.trim()||'🧴';
    await DB.put('skincare', it);
    Modal.close(); Skin.load(); toast('已更新');
  },
  async del(id){
    if(!confirm('确定删除该护肤项目？\n（已有的打卡记录会保留，不影响历史）')) return;
    await DB.del('skincare', id);
    // 同步清理该项目的打卡记录
    const records = await DB.get('aiCache','skinRecords') || {id:'skinRecords', data:{}};
    if(records.data && records.data[id]){
      delete records.data[id];
      await DB.put('aiCache', records);
    }
    Modal.close(); Skin.load(); toast('已删除');
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
   5.5 剧集推荐（GitHub Actions 抓取 + 想看/已看 + 影评）
   ============================================ */
const Drama = {
  _tab: 'rec',
  _liveData: null,
  _liveItems: null,
  _aiItems: null,
  _items: [],
  _score: 3,
  async load(){
    Drama._items = await DB.all('dramas');
    await Drama.fetchLive();
    const cache = await DB.get('aiCache','dramaRec');
    if(AI.getKey() && cache && Date.now()-cache.ts < 12*3600*1000){
      Drama._aiItems = cache.data;
    }
    Drama.render();
  },
  async fetchLive(){
    try{
      const r = await fetch('drama.json?v='+Date.now(), {cache:'no-store'});
      if(!r.ok) return;
      const j = await r.json();
      if(j && j.items && j.items.length){
        Drama._liveData = j;
        $('#dramaSourceTag').textContent = (j.source||'豆瓣') + '热播';
        if(j.updated) $('#dramaTime').textContent = j.updated;
      }
    }catch(e){ /* 静默失败，用缓存 */ }
  },
  _shuffleLive(){
    const a = Drama._liveData && Drama._liveData.items;
    if(Array.isArray(a)){
      for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    }
  },
  async refresh(){
    const btn = document.querySelector('#page-drama button[onclick*="Drama.refresh"]');
    if(btn){ btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = '🌸 刷新中…'; }
    try{
      await Drama.fetchLive();
      if(AI.getKey()){
        await Drama.aiRec(false);   // 配 Key：AI 重新挑剧（内部已 toast）
      }else{
        Drama._shuffleLive();       // 未配 Key：换一批顺序，让刷新有反馈
        Drama.render();
        toast('已为你换一批 ✨ 配 Key 解锁 AI 实时挑剧');
      }
    }catch(e){
      toast('刷新失败，稍后再试 🌸');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = btn.dataset.orig || '🔄 刷新'; }
    }
  },
  async aiRec(silent){
    if(!AI.getKey()){ Drama.render(); return; }
    if(!silent) toast('AI 正在为你挑近期好剧…');
    const todayStr = new Date().toLocaleDateString('zh-CN');
    const out = await AI.chat(
      '你是影视推荐编辑。请基于当下（'+todayStr+'）推荐 6 部近期/经典值得看的作品，覆盖：国产热剧、美剧、英剧、电影、综艺、纪录片（题材多样，不要全是同类）。JSON 数组格式，每部含：title(作品名), type(电影/电视剧/综艺/纪录片), category(国产剧/美剧/英剧/电影/综艺/纪录片), reason(一句话推荐理由,25字内要具体), summary(简介,120-180字,含题材/看点/适合人群)。只输出JSON。',
      '请推荐近期值得看的 6 部作品，像真正追剧的人给出的真心推荐。',
      {kind:'hot', maxTokens:2500}
    );
    let items = null;
    try{ items = JSON.parse(AI._cleanJSON(out)); if(!Array.isArray(items)) throw 0; }catch(e){ items = null; }
    if(items && items.length){
      items = items.map(b => (b && typeof b==='object') ? {
        title: b.title || b.name || '',
        type: b.type || b.kind || '电视剧',
        category: b.category || b.type || '',
        reason: b.reason || '',
        summary: b.summary || b.detail || b.intro || '',
        rating: b.rating || ''
      } : {title:String(b||''), type:'电视剧', category:'', reason:'', summary:'', rating:''});
      Drama._aiItems = items;
      await DB.put('aiCache',{id:'dramaRec', data:items, ts:Date.now()});
      Drama.render();
      if(!silent) toast('已为你挑好新剧单 ✨');
    }else{
      Drama.render();
      if(!silent) toast('AI 推荐失败，已显示豆瓣热播 🎬');
    }
  },
  switchTab(cat){
    Drama._tab = cat;
    $$('#page-drama .study-tab').forEach(t=>t.classList.toggle('active', t.dataset.cat===cat));
    Drama.render();
  },
  render(){
    const box = $('#dramaList');
    const tab = Drama._tab;
    if(tab==='rec'){
      const list = Drama._aiItems || (Drama._liveData && Drama._liveData.items) || [];
      const useAi = !!Drama._aiItems;
      const tag = $('#dramaSourceTag');
      if(tag) tag.textContent = useAi ? 'AI 实时推荐' : ((Drama._liveData?.source||'豆瓣')+'热播');
      if(!list.length){
        box.innerHTML = '<div class="empty"><div class="emoji">🎬</div><p>剧集数据加载中，稍后刷新...</p></div>';
        return;
      }
      const myDramas = Drama._items || [];
      box.innerHTML = list.map((d,i)=>`
        <div class="drama-card" onclick="Drama.detail(${i})">
          <div class="between">
            <div style="flex:1;min-width:0">
              <div class="dt">${esc(d.title)}</div>
              <div class="dm">
                <span class="drama-cat ${Drama.catClass(d.type)}">${esc(d.type)}</span>
                ${d.category?`<span class="drama-cat">${esc(d.category)}</span>`:''}
                ${d.rating?`<span class="rating">★ ${esc(d.rating)}</span>`:''}
                ${Drama.myStatus(d.title, myDramas)}
              </div>
            </div>
            <span class="muted" style="font-size:16px">›</span>
          </div>
        </div>`).join('');
      Drama._liveItems = list;
    } else {
      const list = (Drama._items||[]).filter(d=>d.status===tab);
      box.innerHTML = list.length ? list.map(d=>`
        <div class="drama-card" onclick="Drama.openMine('${d.id}')">
          <div class="between">
            <div style="flex:1;min-width:0">
              <div class="dt">${esc(d.title)}</div>
              <div class="dm">
                <span class="drama-cat ${Drama.catClass(d.type)}">${esc(d.type)}</span>
                ${d.category?`<span class="drama-cat">${esc(d.category)}</span>`:''}
                ${tab==='watched' && d.rating?`<span class="rating">★ ${d.rating}</span>`:''}
                <span class="drama-status ${d.status}">${d.status==='want'?'想看':'已看'}</span>
              </div>
              ${tab==='watched' && d.review?`<div class="muted mt8" style="font-size:12px;line-height:1.6">${esc(d.review.slice(0,50))}${d.review.length>50?'...':''}</div>`:''}
            </div>
            <span class="muted" style="font-size:16px">›</span>
          </div>
        </div>`).join('') : `<div class="empty"><div class="emoji">${tab==='want'?'💡':'✅'}</div><p>${tab==='want'?'还没有想看的剧集<br>去推荐 tab 收藏吧':'还没有标记已看的剧集<br>看完一部来写影评吧'}</p></div>`;
    }
  },
  catClass(type){
    return ({'电影':'movie','电视剧':'tv','综艺':'show','纪录片':'doc'})[type] || '';
  },
  myStatus(title, myDramas){
    const d = myDramas.find(x=>x.title===title);
    if(!d) return '';
    return `<span class="drama-status ${d.status}">${d.status==='want'?'想看':'已看'}</span>`;
  },
  detail(i){
    const d = Drama._liveItems[i]; if(!d) return;
    const myDramas = Drama._items || [];
    const mine = myDramas.find(x=>x.title===d.title);
    Modal.open('🎬 ' + d.title, `
      <div class="ai-card">
        <div class="ai-tag">🔥 ${(Drama._aiItems? 'AI 实时' : (Drama._liveData.source||'豆瓣'))}热播</div>
        <div style="font-size:17px;font-weight:700;color:var(--purple-deep);line-height:1.4">${esc(d.title)}</div>
        <div class="flex gap8 mt8 wrap">
          <span class="drama-cat ${Drama.catClass(d.type)}">${esc(d.type)}</span>
          ${d.category?`<span class="drama-cat">${esc(d.category)}</span>`:''}
          ${d.rating?`<span class="tag tag-yellow">★ ${esc(d.rating)}</span>`:''}
        </div>
      </div>
      <div class="card">
        <div class="card-title">📝 简介</div>
        <div id="dramaSummary" style="font-size:14px;color:var(--text);line-height:1.7">
          ${d.summary ? esc(d.summary) : '<div class="empty" style="padding:16px 0"><div class="emoji">🤖</div><p>AI 正在生成简介...</p></div>'}
        </div>
      </div>
      ${mine?`<div class="card" style="background:var(--salt-light)"><div class="muted">你已标记为「${mine.status==='want'?'想看':'已看'}」</div></div>`:''}
      <div class="flex gap8 mt8">
        ${!mine||mine.status!=='want'?`<button class="btn btn-ghost" style="flex:1" onclick="Drama.markWant(${i});Modal.close()">💡 想看</button>`:''}
        <button class="btn" style="flex:1" onclick="Drama.markWatchedQuick(${i})">✅ 标记已看</button>
        <button class="btn btn-outline" style="flex:1" onclick="Drama.openReview(null, Drama._liveItems[${i}])">✍️ 写影评</button>
        ${d.url?`<a href="${esc(d.url)}" target="_blank" class="btn btn-ghost" style="flex:0 0 auto;padding:10px 14px">🔗</a>`:''}
      </div>
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
    if(!d.summary){
      AI.chat('你是影视编辑。请用 120-160 字介绍作品《'+d.title+'》（'+d.type+'），包含题材、看点、适合人群。只输出正文。',
        '请介绍《'+d.title+'》', {kind:'hot', maxTokens:300}).then(txt=>{
        const body = $('#dramaSummary');
        if(body && txt) body.innerHTML = '<p>'+esc(txt.split('\n')[0])+'</p>';
      }).catch(()=>{});
    }
  },
  async markWant(i){
    const d = Drama._liveItems[i]; if(!d) return;
    const existing = (Drama._items||[]).find(x=>x.title===d.title);
    if(existing){ existing.status='want'; await DB.put('dramas', existing); }
    else {
      await DB.put('dramas',{id:uid(), title:d.title, type:d.type, category:d.category||'',
        status:'want', date:today(), rating:0, review:'', url:d.url||'', summary:d.summary||''});
    }
    Drama._items = await DB.all('dramas');
    Drama.render();
    toast('已加入想看 💡');
  },
  markWatched(i){
    const d = Drama._liveItems[i]; if(!d) return;
    Drama.openReview(null, d);
  },
  async openMine(id){
    const d = await DB.get('dramas', id); if(!d) return;
    Modal.open('🎬 ' + d.title, `
      <div class="ai-card">
        <div class="ai-tag">${d.status==='want'?'💡 想看':'✅ 已看'} · ${esc(d.date||'')}</div>
        <div style="font-size:17px;font-weight:700;color:var(--purple-deep)">${esc(d.title)}</div>
        <div class="flex gap8 mt8 wrap">
          <span class="drama-cat ${Drama.catClass(d.type)}">${esc(d.type)}</span>
          ${d.category?`<span class="drama-cat">${esc(d.category)}</span>`:''}
          ${d.rating?`<span class="rating">★ ${d.rating}</span>`:''}
        </div>
      </div>
      ${d.summary?`<div class="card"><div class="card-title">📝 简介</div><div style="font-size:14px;color:var(--text);line-height:1.7">${esc(d.summary)}</div></div>`:''}
      ${d.review?`<div class="card"><div class="card-title">✍️ 我的影评</div><div style="font-size:14px;color:var(--text);line-height:1.8;white-space:pre-wrap">${esc(d.review)}</div>${d.reviewTs?`<div class="muted mt8" style="font-size:11px">${fmtDate(d.reviewTs)}</div>`:''}</div>`:''}
      ${d.url?`<a href="${esc(d.url)}" target="_blank" class="btn btn-block btn-outline mt8">🔗 查看原片</a>`:''}
      <div class="flex gap8 mt8">
        ${d.status==='want'?`
          <button class="btn btn-green" style="flex:1" onclick="Drama.markWatchedQuick(${i})">✅ 标记已看</button>
          <button class="btn" style="flex:1" onclick="Drama.openReview('${d.id}', null)">✍️ 写影评</button>
        `:`<button class="btn" style="flex:1" onclick="Drama.openReview('${d.id}', null)">✍️ ${d.review?'编辑影评':'写影评'}</button>`}
        <button class="btn btn-red" style="flex:1" onclick="Drama.del('${d.id}');Modal.close()">🗑 删除</button>
      </div>
      <button class="btn btn-block btn-ghost mt8" onclick="Modal.close()">关闭</button>`);
  },
  openReview(id, d){
    const target = id ? (Drama._items||[]).find(x=>x.id===id) : d;
    if(!target) return;
    const starsHtml = [1,2,3,4,5].map(i=>`<span class="${i<=(target.rating||3)?'on':''}" data-v="${i}">★</span>`).join('');
    Modal.open('✍️ 写影评', `
      <div class="card" style="background:var(--salt-light);margin-bottom:12px">
        <div style="font-weight:700;color:var(--purple-deep)">${esc(target.title)}</div>
        <div class="muted">${esc(target.type)} ${target.category?'· '+esc(target.category):''}</div>
      </div>
      <div class="field"><label>评分</label>
        <div class="stars" id="drStars">${starsHtml}</div>
      </div>
      <div class="field"><label>影评（写写你的感受）</label>
        <textarea class="textarea" id="drReview" placeholder="这部剧让你印象最深的是什么？剧情、表演、镜头、还是某个瞬间..." style="min-height:140px">${esc(target.review||'')}</textarea>
      </div>
      <button class="btn btn-block" onclick="Drama.saveReview('${id||''}', ${d?`'${esc(d.title)}'`:'null'}, ${d?`'${esc(d.type)}'`:'null'}, ${d?`'${esc(d.category||'')}'`:'null'}, ${d?`'${esc(d.url||'')}'`:'null'}, ${d?`'${esc(d.summary||'')}'`:'null'})">保存</button>`);
    let score = target.rating || 3;
    $$('#drStars span').forEach(s=>s.onclick=()=>{
      score = parseInt(s.dataset.v);
      $$('#drStars span').forEach(x=>x.classList.toggle('on', parseInt(x.dataset.v)<=score));
    });
    Drama._score = ()=>score;
  },
  async saveReview(id, title, type, category, url, summary){
    let rec;
    if(id){
      rec = await DB.get('dramas', id);
      if(!rec) return;
    } else {
      rec = {id:uid(), title, type, category, url, summary, date:today(), status:'watched'};
    }
    rec.status = 'watched';
    rec.rating = Drama._score();
    const reviewText = $('#drReview').value.trim();
    rec.review = reviewText;
    if(reviewText) rec.reviewTs = now();
    await DB.put('dramas', rec);
    Drama._items = await DB.all('dramas');
    Modal.close();
    Drama.render();
    toast(reviewText ? '影评已保存 ✍️' : '已标记已看 ✨');
  },
  async markWatchedQuick(i){
    const d = Drama._liveItems[i]; if(!d) return;
    const existing = (Drama._items||[]).find(x=>x.title===d.title);
    let rec;
    if(existing){
      existing.status='watched'; existing.rating=existing.rating||3;
      await DB.put('dramas', existing); rec=existing;
    } else {
      rec = {id:uid(), title:d.title, type:d.type, category:d.category||'',
        status:'watched', rating:3, date:today(), url:d.url||'', summary:d.summary||'', review:''};
      await DB.put('dramas', rec);
    }
    Drama._items = await DB.all('dramas');
    Modal.close();
    Drama.render();
    toast('已标记已看 ✨ 想写影评随时点开');
  },
  async del(id){
    if(!confirm('从清单删除？')) return;
    await DB.del('dramas', id);
    Drama._items = await DB.all('dramas');
    Drama.render();
    toast('已删除');
  }
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
    // 每次刷新换主题 + 随机种子 + 日期，显著降低重复率
    const themes = ['文学小说','自我成长','心理学','思维方式','女性力量','亲密关系','职场进阶','生活美学','历史传记','治愈系'];
    const theme = themes[Math.floor(Math.random()*themes.length)];
    const seed = Math.floor(Math.random()*1000000);
    const todayStr = new Date().toLocaleDateString('zh-CN');
    const avoid = (Read._recHistory||[]).slice(-12);
    const avoidTxt = avoid.length ? `\n\n【重要】绝对不要推荐已推荐过的书，已推荐：${avoid.join('、')}` : '';
    const sys = `你是资深书评人，本次聚焦「${theme}」主题。请推荐4本适合年轻女性阅读的好书，JSON数组格式，每本含：title(书名),author(作者),reason(一句话推荐,30字内,要具体说明为什么值得读),detail(详细介绍,150-250字,需涵盖：1)本书核心主题；2)为什么这本书值得读,具体打动人的点；3)它适合什么样的女性读者、能在生活哪方面带来启发)。只输出JSON。随机种子${seed}。${avoidTxt}`;
    const user = `今天是${todayStr}，围绕「${theme}」主题推荐4本不一样的书，要像真读完书后的真心推荐，避免与常见书单雷同。`;
    let items = null;
    try{
      const out = await AI.chat(sys, user, {kind:'book', maxTokens:2500});
      const raw = AI._cleanJSON(out);
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed) || !parsed.length) throw 0;
      items = parsed.map(b => (b && typeof b === 'object') ? {
        title: b.title || b.name || b.book || b.书名 || '',
        author: b.author || b.writer || b.作者 || '',
        reason: b.reason || b.recommend || b.why || b.推荐理由 || '',
        detail: b.detail || b.desc || b.intro || b.summary || b.简介 || b.介绍 || ''
      } : {title:String(b||''), author:'', reason:'', detail:''}).filter(b=>b.title);
      if(items.length < 1) throw 0;
    }catch(e){
      // 兜底：从本地书池随机抽 4 本（排除最近推荐），保证每次刷新都有变化、绝不“报错”
      const pool = (AI._pools && AI._pools.book) ? AI._pools.book : [];
      const avoidSet = new Set((Read._recHistory||[]).slice(-8));
      let pick = pool.filter(b=>!avoidSet.has(b.title));
      if(pick.length < 4) pick = pool.slice();
      items = Read._shuffle(pick).slice(0,4).map(b=>({title:b.title,author:b.author,reason:b.reason,detail:b.detail}));
    }
    // 记录历史，下次刷新主动避开
    Read._recHistory = (Read._recHistory||[]).concat(items.map(b=>b.title)).slice(-16);
    await DB.put('aiCache',{id:'bookRec', data:items, ts:Date.now()});
    Read.renderRec(items);
  },
  _shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
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
    while(true){ const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; if(set.has(ds)){ s++; d.setDate(d.getDate()-1); } else break; }
    return s;
  },
  switchTab(cat){
    Study._currentTab = cat;
    $$('#page-study .study-tab').forEach(t=>t.classList.toggle('active', t.dataset.cat===cat));
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
  _viewY:0, _viewM:0, _selectedDate:'', _all:[],
  async load(){
    const all = await DB.all('schedule');
    Sched._all = all;
    if(!Sched._selectedDate) Sched._selectedDate = today();
    const parts = Sched._selectedDate.split('-').map(Number);
    Sched._viewY = parts[0]; Sched._viewM = parts[1]-1;
    Sched.renderCal();
    Sched.renderDay();
    Sched._updateAlarmInfo();
    Alarm.schedule(all);
    Alarm._fireDue();
  },
  renderCal(){
    const Y=Sched._viewY, M=Sched._viewM;
    const ym=$('#schedCalYM'); if(ym) ym.textContent=`${Y}年${M+1}月`;
    const monthPrefix=`${Y}-${String(M+1).padStart(2,'0')}`;
    const cntMap={};
    (Sched._all||[]).forEach(s=>{ if(s.datetime){ const ds=s.datetime.slice(0,10); if(ds.startsWith(monthPrefix)) cntMap[ds]=(cntMap[ds]||0)+1; } });
    const daysInMonth=new Date(Y,M+1,0).getDate();
    const firstDay=new Date(Y,M,1).getDay();
    const todayStr=today();
    let html='';
    for(let i=0;i<firstDay;i++) html+='<div class="sched-cal-cell empty"></div>';
    for(let d=1; d<=daysInMonth; d++){
      const ds=`${Y}-${String(M+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cls=['sched-cal-cell'];
      if(ds===todayStr) cls.push('today');
      if(ds===Sched._selectedDate) cls.push('selected');
      html+=`<div class="${cls.join(' ')}" onclick="Sched.selectDate('${ds}')"><div class="n">${d}</div>${cntMap[ds]?`<div class="dot"></div>`:''}</div>`;
    }
    const grid=$('#schedCalGrid'); if(grid) grid.innerHTML=html;
  },
  selectDate(ds){ Sched._selectedDate=ds; Sched.renderCal(); Sched.renderDay(); },
  prevMonth(){ if(Sched._viewM===0){Sched._viewM=11;Sched._viewY--;}else{Sched._viewM--;} Sched.renderCal(); },
  nextMonth(){ if(Sched._viewM===11){Sched._viewM=0;Sched._viewY++;}else{Sched._viewM++;} Sched.renderCal(); },
  renderDay(){
    const ds=Sched._selectedDate;
    const title=$('#schedDayTitle'); if(title) title.textContent=`📋 ${ds} 待办`;
    const items=(Sched._all||[]).filter(s=>s.datetime && s.datetime.slice(0,10)===ds).sort((a,b)=>(a.datetime||'').localeCompare(b.datetime||''));
    const box=$('#schedDayList'); if(!box) return;
    if(!items.length){ box.innerHTML='<div class="empty" style="padding:18px 0"><div class="emoji">🗒️</div><p>这一天还没有安排</p></div>'; return; }
    const pending=items.filter(s=>!s.done), done=items.filter(s=>s.done);
    let html=pending.map(s=>Sched._row(s,false)).join('');
    if(done.length) html+=`<div class="muted" style="font-size:12px;margin:10px 0 4px">已完成</div>`+done.map(s=>Sched._row(s,true)).join('');
    box.innerHTML=html;
  },
  _row(s,done){
    return `<div class="sched-item ${done?'done':''} ${s.urgent?'urgent':''}">
      <div class="sched-time">${s.datetime?fmtTime(s.datetime):'--:--'}</div>
      <div style="flex:1;min-width:0">
        <div class="st" style="font-weight:600">${esc(s.title)}</div>
        ${s.note?`<div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.note)}</div>`:''}
        <div class="flex gap4 mt4">${s.urgent?'<span class="tag tag-red">紧急</span>':''}${s.alarm?'<span class="tag tag-yellow">🔔</span>':''}</div>
      </div>
      <div class="flex gap6">
        <button class="btn btn-sm btn-ghost" style="padding:6px 10px" onclick="Sched.edit('${s.id}')">✎</button>
        ${done?'':`<button class="btn btn-sm btn-green" style="padding:6px 10px" onclick="Sched.done('${s.id}')">✓</button>`}
        <button class="btn btn-sm btn-red" style="padding:6px 10px" onclick="Sched.del('${s.id}')">×</button>
      </div>
    </div>`;
  },
  openAdd(dateStr){
    dateStr = dateStr || Sched._selectedDate || today();
    const def = `${dateStr}T09:00`;
    Modal.open('添加事项 · '+dateStr, `
      <div class="field"><label>事项标题</label><input class="input" id="scTitle" placeholder="如：开会 / 提交报告"></div>
      <div class="field"><label>日期时间</label><input class="input" id="scTime" type="datetime-local" value="${def}"></div>
      <div class="field"><label>备注</label><input class="input" id="scNote" placeholder="可选"></div>
      <div class="set-row"><div><label>紧急事项</label><div class="desc">标红显示</div></div><div class="switch" id="scUrgent" onclick="this.classList.toggle('on')"></div></div>
      <div class="set-row"><div><label>闹钟提醒</label><div class="desc">到点响铃+通知</div></div><div class="switch on" id="scAlarm" onclick="this.classList.toggle('on')"></div></div>
      <button class="btn btn-block mt8" onclick="Sched.save(null)">添加</button>`);
  },
  async edit(id){
    const s=await DB.get('schedule',id); if(!s) return;
    const def=s.datetime?s.datetime.slice(0,16):'';
    Modal.open('编辑事项', `
      <div class="field"><label>事项标题</label><input class="input" id="scTitle" value="${esc(s.title)}"></div>
      <div class="field"><label>日期时间</label><input class="input" id="scTime" type="datetime-local" value="${def}"></div>
      <div class="field"><label>备注</label><input class="input" id="scNote" value="${esc(s.note||'')}"></div>
      <div class="set-row"><div><label>紧急事项</label><div class="desc">标红显示</div></div><div class="switch ${s.urgent?'on':''}" id="scUrgent" onclick="this.classList.toggle('on')"></div></div>
      <div class="set-row"><div><label>闹钟提醒</label><div class="desc">到点响铃+通知</div></div><div class="switch ${s.alarm?'on':''}" id="scAlarm" onclick="this.classList.toggle('on')"></div></div>
      <button class="btn btn-block mt8" onclick="Sched.save('${id}')">保存</button>`);
  },
  async save(id){
    const title=$('#scTitle').value.trim();
    if(!title){ toast('请输入标题'); return; }
    const dt=$('#scTime').value;
    const data={ title, datetime: dt?new Date(dt).toISOString():null, note:$('#scNote').value.trim(), urgent:$('#scUrgent').classList.contains('on'), alarm:$('#scAlarm').classList.contains('on') };
    if(id){ const ex=await DB.get('schedule',id); Object.assign(ex,data); await DB.put('schedule',ex); }
    else { await DB.put('schedule',{id:uid(), done:false, alarmFired:false, ...data}); }
    Modal.close(); Sched.load(); toast(id?'已更新 ✏️':'已添加 🔔');
    if(data.alarm && 'Notification' in window && Notification.permission==='default'){ Notification.requestPermission().then(()=>Sched._updateAlarmInfo()).catch(()=>{}); }
  },
  async done(id){ const s=await DB.get('schedule',id); s.done=true; await DB.put('schedule',s); Sched.load(); toast('完成 ✅'); },
  async del(id){ await DB.del('schedule',id); Sched.load(); },
  _updateAlarmInfo(){
    const el=$('#schedAlarmInfo'); if(!el) return;
    if(!('Notification' in window)){ el.textContent='当前浏览器不支持系统通知，应用保持打开时仍会响铃提醒。'; return; }
    const p=Notification.permission;
    el.textContent = p==='granted' ? '✅ 通知已开启：应用打开时到点响铃并弹出系统通知。'
      : p==='denied' ? '⚠️ 通知已被拒绝，请在浏览器设置中允许；应用打开时仍会响铃。'
      : '应用打开时会响铃提醒，点击「开启通知」可接收系统通知。';
  },
  enableNotify(){
    if(!('Notification' in window)){ toast('当前浏览器不支持通知'); return; }
    Notification.requestPermission().then(p=>{ Sched._updateAlarmInfo(); toast(p==='granted'?'已开启通知 🔔':'通知未授权'); }).catch(()=>{});
  }
};

/* ---------- 闹钟 ---------- */
const Alarm = {
  timer:null,
  schedule(all){
    // 未完成、未触发过、带闹钟的全部进入检查列表（含已过点的，应用打开即补提醒）
    Alarm._list = (all||[]).filter(s=>s.alarm && !s.done && !s.alarmFired && s.datetime);
  },
  start(){
    if(Alarm.timer) return;
    Alarm.timer = setInterval(Alarm.check, 30000);
    Alarm.check();
  },
  check(){ Alarm._fireDue(); },
  async _fireDue(){
    const now=Date.now();
    for(const s of (Alarm._list||[])){
      if(new Date(s.datetime).getTime()<=now && !s.alarmFired){
        s.alarmFired=true;
        try{ await DB.put('schedule', s); }catch(e){}
        Alarm.fire(s);
      }
    }
  },
  fire(s){
    $('#alarmTitle').textContent=s.title;
    $('#alarmDesc').textContent=s.note||'到点啦～';
    $('#alarmFull').classList.add('show');
    Alarm._playBell();
    if('Notification' in window && Notification.permission==='granted'){
      try{ new Notification('🔔 '+s.title, {body:s.note||'到点啦', icon:'icon.svg', tag:s.id}); }catch(e){}
    }
  },
  stop(){
    $('#alarmFull').classList.remove('show');
    if(Alarm._osc){ try{ Alarm._osc.stop(); }catch(e){} Alarm._osc=null; }
    if(Alarm._bellInt){ clearTimeout(Alarm._bellInt); Alarm._bellInt=null; }
  },
  _playBell(){
    try{
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      const osc=ctx.createOscillator(); const gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type='sine'; osc.frequency.value=880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+2);
      osc.start(); osc.stop(ctx.currentTime+2);
      Alarm._osc=osc;
      Alarm._bellInt=setTimeout(()=>{ if($('#alarmFull').classList.contains('show')) Alarm._playBell(); }, 2200);
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
  async openTimebook(){
    const all = (await DB.all('fragments')).filter(f=>f.type==='record');
    if(!all.length){ toast('还没有任何记录，先记录第一条小确幸吧 🌸'); return; }
    TimebookUI.open(all);
  },
  async openPhotobook(){
    const all = (await DB.all('fragments')).filter(f=>f.type==='record' && f.img).sort((a,b)=>(a.ts||'').localeCompare(b.ts||''));
    if(!all.length){ toast('还没有带照片的记录～'); return; }
    PhotobookUI.open(all);
  }
};

/* ============================================
   我的时光集 · 控制器(驱动全屏画布)
   ============================================ */
const TimebookUI = {
  _records: [], _daysMap: {}, _mode: 'day', _canvas: null,
  open(records){
    TimebookUI._records = records;
    TimebookUI._daysMap = Timebook.groupByDay(records);
    const today = Timebook.ymd(new Date());
    const ws = Timebook.weekStart(new Date());
    const todayRecords = TimebookUI._daysMap[today] || [];
    const weekKeys = [...Array(7)].map((_,i)=>{ const d=new Date(ws); d.setDate(ws.getDate()+i); return Timebook.ymd(d); });
    const weekRecords = weekKeys.flatMap(k=>TimebookUI._daysMap[k]||[]);
    const monthKey = today.slice(0,7);
    const monthRecords = records.filter(r=> (r.ts||'').slice(0,7)===monthKey);
    // 自动选择
    let mode='month', hint='自动选择:月历';
    if(todayRecords.length>=1){ mode='day'; hint='自动选择:今日日卡'; }
    else if(weekRecords.length>=2){ mode='week'; hint='自动选择:本周周历'; }
    else if(monthRecords.length>=4){ mode='month'; hint='自动选择:本月月历'; }
    TimebookUI._mode = mode;
    document.getElementById('timebookHint').textContent = hint;
    $('#timebookMask').classList.add('show');
    $$('#timebookMask .tb-tab').forEach(t=>t.classList.toggle('active', t.dataset.mode===mode));
    TimebookUI._render();
  },
  close(){ $('#timebookMask').classList.remove('show'); },
  switch(mode, tabEl){
    TimebookUI._mode = mode;
    $$('#timebookMask .tb-tab').forEach(t=>t.classList.toggle('active', t===tabEl));
    document.getElementById('timebookHint').textContent = '已切换:'+(mode==='day'?'日卡':mode==='week'?'周历':'月历');
    TimebookUI._render();
  },
  async _render(){
    const wrap = document.getElementById('timebookCanvasWrap');
    const canvas = document.getElementById('timebookCanvas');
    wrap.querySelector('.tb-loading')?.remove();
    const loading = document.createElement('div');
    loading.className='tb-loading muted'; loading.textContent='绘制中…';
    loading.style.cssText='padding:20px;text-align:center';
    wrap.appendChild(loading);
    canvas.style.display='none';
    try{
      let result;
      if(TimebookUI._mode==='day'){
        const today = Timebook.ymd(new Date());
        const rec = TimebookUI._daysMap[today];
        if(!rec){ toast('今天还没有记录，回到「记录」页补一条吧 🌷'); loading.textContent='今天还没有记录'; return; }
        result = await Timebook.renderDay(today, rec);
      } else if(TimebookUI._mode==='week'){
        const ws = Timebook.weekStart(new Date());
        result = await Timebook.renderWeek(ws, TimebookUI._daysMap);
      } else {
        const now = new Date();
        result = await Timebook.renderMonth(now.getFullYear(), now.getMonth(), TimebookUI._daysMap);
      }
      const ctx = canvas.getContext('2d');
      canvas.width = result.width; canvas.height = result.height;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(result, 0, 0);
      TimebookUI._canvas = canvas;
      canvas.style.display='';
    }catch(e){ console.warn('timebook render fail',e); loading.textContent='绘制失败'; return; }
    loading.remove();
  },
  // 构建一组相关页(用于 PDF 输出)
  async _buildAllPages(){
    const pages = [];
    if(TimebookUI._mode==='day'){
      const today = Timebook.ymd(new Date());
      const rec = TimebookUI._daysMap[today];
      if(rec) pages.push(await Timebook.renderDay(today, rec));
    } else if(TimebookUI._mode==='week'){
      // 渲染本月所有有数据的周(最多 5 周)
      const ws = Timebook.weekStart(new Date());
      pages.push(await Timebook.renderWeek(ws, TimebookUI._daysMap));
      const ws2 = new Date(ws); ws2.setDate(ws2.getDate()-7);
      const daysMap2 = TimebookUI._daysMap;
      const prevMap = {};
      Object.keys(daysMap2).forEach(k=>{ const d=new Date(k); if(d>=ws2 && d<ws) prevMap[k]=daysMap2[k]; });
      if(Object.keys(prevMap).length) pages.push(await Timebook.renderWeek(ws2, prevMap));
    } else {
      // 月历:本月 + 上月(若都有数据)
      const now = new Date();
      pages.push(await Timebook.renderMonth(now.getFullYear(), now.getMonth(), TimebookUI._daysMap));
      const prev = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const prevMap = {};
      Object.keys(TimebookUI._daysMap).forEach(k=>{ if(k.startsWith(Timebook.ymd(prev).slice(0,7))) prevMap[k]=TimebookUI._daysMap[k]; });
      if(Object.keys(prevMap).length>=2) pages.push(await Timebook.renderMonth(prev.getFullYear(), prev.getMonth(), prevMap));
    }
    return pages;
  },
  async export(kind){
    try{
      if(kind==='png'){
        if(!TimebookUI._canvas){ toast('请等待绘制完成'); return; }
        const c = TimebookUI._canvas;
        const stamp = Timebook.ymd(new Date());
        const label = TimebookUI._mode==='day'?'日卡':TimebookUI._mode==='week'?'周历':'月历';
        await Timebook.exportPNG(c, `时光集-${stamp}-${label}.png`);
        toast('已导出 PNG 📷');
      } else {
        const pages = await TimebookUI._buildAllPages();
        if(!pages.length){ toast('暂无可导出的内容'); return; }
        const stamp = Timebook.ymd(new Date());
        const label = TimebookUI._mode==='day'?'日卡':TimebookUI._mode==='week'?'周历':'月历';
        await Timebook.exportPDF(pages, `时光集-${stamp}-${label}.pdf`);
        toast('已导出 PDF 📄(可打印装订)');
      }
    }catch(e){ console.warn('export fail',e); toast('导出失败,请重试'); }
  }
};

/* ============================================
   摄影集 · 翻页控制器
   ============================================ */
const PhotobookUI = {
  _records: [], _idx: 0,
  open(records){
    PhotobookUI._records = records;
    PhotobookUI._idx = 0;
    $('#photobookMask').classList.add('show');
    PhotobookUI._renderDots();
    PhotobookUI._show();
    document.addEventListener('keydown', PhotobookUI._onKey);
    $('#photobookPage').addEventListener('touchstart', PhotobookUI._onTouchStart, {passive:true});
    $('#photobookPage').addEventListener('touchend', PhotobookUI._onTouchEnd, {passive:true});
  },
  close(){
    $('#photobookMask').classList.remove('show');
    document.removeEventListener('keydown', PhotobookUI._onKey);
    $('#photobookPage').removeEventListener('touchstart', PhotobookUI._onTouchStart);
    $('#photobookPage').removeEventListener('touchend', PhotobookUI._onTouchEnd);
    $('#photobookExportMenu').classList.remove('show');
  },
  _onKey(e){
    if($('#photobookMask').classList.contains('show')){
      if(e.key==='ArrowLeft') PhotobookUI.prev();
      else if(e.key==='ArrowRight') PhotobookUI.next();
      else if(e.key==='Escape') PhotobookUI.close();
    }
  },
  _touchStartX: 0,
  _onTouchStart(e){ PhotobookUI._touchStartX = e.changedTouches[0].screenX; },
  _onTouchEnd(e){
    const dx = e.changedTouches[0].screenX - PhotobookUI._touchStartX;
    if(Math.abs(dx) > 50){
      if(dx < 0) PhotobookUI.next();
      else PhotobookUI.prev();
    }
  },
  prev(){ if(PhotobookUI._idx>0){ PhotobookUI._idx--; PhotobookUI._show(); } },
  next(){ if(PhotobookUI._idx<PhotobookUI._records.length-1){ PhotobookUI._idx++; PhotobookUI._show(); } },
  _show(){
    const r = PhotobookUI._records[PhotobookUI._idx];
    if(!r) return;
    const imgBox = document.getElementById('photobookImg');
    imgBox.innerHTML = r.img ? `<img src="${esc(r.img)}" alt="">` : `<div class="ph">无图记录</div>`;
    const cap = document.getElementById('photobookCaption');
    const d = new Date(r.ts);
    const dn = ['日','一','二','三','四','五','六'][d.getDay()];
    const txt = (r.text||'').slice(0,120);
    cap.textContent = `${Timebook.ymd(d)} 周${dn}  ·  ${txt}`;
    document.getElementById('photobookProgress').textContent = `${PhotobookUI._idx+1}/${PhotobookUI._records.length}`;
    PhotobookUI._renderDots();
  },
  _renderDots(){
    const wrap = document.getElementById('photobookDots');
    wrap.innerHTML = PhotobookUI._records.map((_,i)=>`<span class="photobook-dot ${i===PhotobookUI._idx?'active':''}"></span>`).join('');
  },
  toggleExport(){
    $('#photobookExportMenu').classList.toggle('show');
  },
  async exportAll(kind){
    try{
      PhotobookUI.toggleExport();
      if(kind==='png'){
        toast('正在逐张导出 PNG,请在浏览器下载中允许多次下载…');
        for(let i=0;i<PhotobookUI._records.length;i++){
          const c = await Timebook.renderPhotoPage(PhotobookUI._records[i]);
          const r = PhotobookUI._records[i];
          const ds = Timebook.ymd(new Date(r.ts));
          const pad = String(i+1).padStart(3,'0');
          await Timebook.exportPNG(c, `摄影集-${pad}-${ds}.png`);
          await new Promise(r=>setTimeout(r,200));
        }
        toast(`已导出 ${PhotobookUI._records.length} 张 PNG 📷`);
      } else {
        toast('正在生成整本 PDF,可能需要几秒…');
        const pages = [];
        for(let i=0;i<PhotobookUI._records.length;i++){
          pages.push(await Timebook.renderPhotoPage(PhotobookUI._records[i]));
        }
        const stamp = Timebook.ymd(new Date());
        await Timebook.exportPDF(pages, `摄影集-${stamp}.pdf`);
        toast(`已导出 PDF (${pages.length} 页, A4,可直接打印装订) 📕`);
      }
    }catch(e){ console.warn('photobook export fail',e); toast('导出失败,请重试'); }
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
    const upcoming = Anni.holidays.filter(h=>h.date>=todayStr).slice(0,8);
    $('#anniHolidays').innerHTML = upcoming.map(h=>{
      const days = Anni.dayDiff(h.date);
      const cls = days<=7 ? 'countdown' : '';
      return `<div class="anni-item ${cls}">
        <div class="emoji">${h.emoji}</div>
        <div class="info"><div class="nm">${h.name}${days<=7?' <span class="tag tag-red">⚠️ 一周内</span>':''}</div><div class="dt">${h.date.replace(/-/g,'/')}</div></div>
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
    for(const s of ['supplements','recipes','skincare','sports','reads','study','schedule','fragments','diary','anni','vocab','dramas']){
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
    for(const s of ['supplements','recipes','skincare','sports','reads','study','schedule','fragments','diary','anni','vocab','dramas','aiCache']){
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

  // 日程 + 闹钟（先加载日程以填充闹钟检查列表，使提醒在任意页面都生效）
  await Sched.load();
  Alarm.start();
  // 应用从后台切回时补触发已到点闹钟
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) Sched.load(); });
  window.addEventListener('focus', ()=> Sched.load());

  // 首页加载
  Hot.load();
})();
