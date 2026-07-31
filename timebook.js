/* =============================================================
 * 时间集 · 我的时光集
 * 纯 vanilla Canvas 2D 绘制 + 零依赖 PDF 1.4 构造器
 * 数据源:fragments store 里 type:'record' 的条目
 *   { id, type:'record', text, img (base64 data URL), ts (ISO) }
 * ============================================================= */
(function(){
  'use strict';

  /* ---------- 设计令牌(与 :root CSS 变量保持一致) ---------- */
  const C = {
    bg:        '#F5F0F7',
    card:      '#FFFFFF',
    purple:    '#9B7EBD',
    purpleDp:  '#6B4E8E',
    salt:      '#E8D5F2',
    saltLt:    '#F2E8F7',
    text:      '#3D2E5C',
    textLt:    '#7B6B95',
    green:     '#A8C9A8',
    red:       '#E8A0A0',
    yellow:    '#E8D5A0',
    blue:      '#A8B8D5',
    pink:      '#E8A0C0',
    line:      'rgba(155,126,189,.15)',
  };
  const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",sans-serif';

  /* ---------- 工具函数 ---------- */
  function pad2(n){ return String(n).padStart(2,'0'); }
  function ymd(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
  function ymKey(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
  function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
  function dayOfWeek(d){ return d.getDay(); }  // 0=Sun

  // 把 ISO 时间戳或 Date 转成 YYYY-MM-DD
  function tsToYMD(ts){
    const d = (ts instanceof Date) ? ts : new Date(ts);
    return ymd(d);
  }

  // 周一作为一周第一天;返回 Date(周一)
  function weekStart(date){
    const d = new Date(date.getFullYear(),date.getMonth(),date.getDate());
    const dow = d.getDay();  // 0=Sun
    const diff = (dow===0) ? -6 : 1-dow;
    d.setDate(d.getDate()+diff);
    return d;
  }

  function loadImage(dataUrl){
    return new Promise((resolve,reject)=>{
      if(!dataUrl){ resolve(null); return; }
      const img = new Image();
      img.onload = ()=>resolve(img);
      img.onerror = ()=>resolve(null);  // 容错:失败给 null,不阻塞
      img.src = dataUrl;
    });
  }

  // 文字自动换行;maxLines 限制;返回最终 y 坐标
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
    if(!text) return y;
    const chars = Array.from(text);  // 中文+emoji 都按字符
    let line = '', curY = y, count = 0;
    for(let i=0;i<chars.length;i++){
      const test = line + chars[i];
      if(ctx.measureText(test).width > maxWidth && line.length){
        ctx.fillText(line, x, curY);
        line = chars[i]; curY += lineHeight; count++;
        if(count >= maxLines){
          // 最后一行加省略号
          if(i < chars.length-1){
            let last = line;
            while(ctx.measureText(last+'…').width > maxWidth && last.length){ last = last.slice(0,-1); }
            ctx.fillText(last+'…', x, curY);
          } else {
            ctx.fillText(line, x, curY);
          }
          return curY + lineHeight;
        }
      } else { line = test; }
    }
    if(line.length){ ctx.fillText(line, x, curY); curY += lineHeight; }
    return curY;
  }

  // object-fit: cover 裁切
  function drawCover(ctx, img, dx, dy, dw, dh){
    if(!img) return;
    const ir = img.width / img.height, dr = dw/dh;
    let sx, sy, sw, sh;
    if(ir > dr){  // 图片更宽 → 裁左右
      sh = img.height; sw = img.height * dr;
      sx = (img.width - sw)/2; sy = 0;
    } else {       // 图片更高 → 裁上下
      sw = img.width; sh = img.width / dr;
      sx = 0; sy = (img.height - sh)/2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  // 圆角矩形裁切
  function roundRect(ctx, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  /* ---------- 数据分组 ---------- */
  function groupByDay(records){
    const map = {};
    records.forEach(r=>{
      if(!r.ts) return;
      const k = tsToYMD(r.ts);
      (map[k] = map[k] || []).push(r);
    });
    return map;
  }
  // 每天选代表:有图的最早一条 > 无图的最早一条
  function pickOne(records){
    if(!records || !records.length) return null;
    const sorted = records.slice().sort((a,b)=>(a.ts||'').localeCompare(b.ts||''));
    const withImg = sorted.find(r=>r.img);
    return withImg || sorted[0];
  }

  /* =============================================================
   * 三种版式绘制
   * ============================================================= */

  // 日卡:1200×1600 竖版,TODAY 风
  async function renderDay(dateStr, records){
    const W=1200, H=1600, c=document.createElement('canvas');
    c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);

    const d = new Date(dateStr+'T00:00:00');
    const rec = pickOne(records);

    // 顶部 TODAY
    ctx.fillStyle=C.text; ctx.font=`800 100px ${FONT}`;
    ctx.textAlign='center';
    ctx.fillText('TODAY', W/2, 130);

    // 装饰细横线
    ctx.strokeStyle=C.line; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(W*0.3, 170); ctx.lineTo(W*0.7, 170); ctx.stroke();

    // 日期
    ctx.fillStyle=C.purpleDp; ctx.font=`700 36px ${FONT}`;
    ctx.fillText(`${dateStr}  ·  ${['周日','周一','周二','周三','周四','周五','周六'][dayOfWeek(d)]}`, W/2, 230);

    // 大照片区 1080×900
    const px=60, py=270, pw=W-120, ph=900;
    if(rec && rec.img){
      const img = await loadImage(rec.img);
      ctx.save();
      roundRect(ctx, px, py, pw, ph, 24);
      ctx.clip();
      if(img) drawCover(ctx, img, px, py, pw, ph);
      else { ctx.fillStyle=C.saltLt; ctx.fillRect(px,py,pw,ph); }
      ctx.restore();
    } else {
      ctx.save();
      roundRect(ctx, px, py, pw, ph, 24);
      ctx.fillStyle=C.saltLt; ctx.fill();
      ctx.fillStyle=C.purple; ctx.font=`120px ${FONT}`;
      ctx.textAlign='center';
      ctx.fillText('🌸', W/2, py+ph/2+30);
      ctx.restore();
    }

    // 底部文字
    ctx.textAlign='left';
    ctx.fillStyle=C.purpleDp; ctx.font=`700 28px ${FONT}`;
    let ty = py + ph + 60;
    if(rec && rec.text){
      ctx.font=`500 24px ${FONT}`;
      ctx.fillStyle=C.text;
      ty = wrapText(ctx, rec.text, 80, ty, W-160, 38, 4);
    } else {
      ctx.fillStyle=C.textLt; ctx.font=`italic 22px ${FONT}`;
      ctx.fillText('这一天还没有文字记录。', 80, ty);
      ty += 40;
    }

    // 底部装饰
    ctx.fillStyle=C.purple; ctx.beginPath();
    ctx.arc(80, H-80, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle=C.purpleDp; ctx.font=`600 18px ${FONT}`;
    ctx.fillText('我的时光集 · 海盐葡萄', 110, H-72);

    return c;
  }

  // 周历:1400×1000 横版
  async function renderWeek(weekStartDate, daysMap){
    const W=1400, H=1000, c=document.createElement('canvas');
    c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);

    const labels = ['MON','TUES','WED','THURS','FRI','SAT','SUN'];

    // 左侧信息块
    const leftW = 360;
    ctx.fillStyle=C.card;
    roundRect(ctx, 30, 30, leftW, H-60, 20);
    ctx.fill();
    ctx.strokeStyle=C.line; ctx.lineWidth=2; ctx.stroke();

    const monthEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    ctx.fillStyle=C.purpleDp; ctx.font=`700 28px ${FONT}`;
    ctx.textAlign='left';
    ctx.fillText(`${monthEn[weekStartDate.getMonth()]} ${weekStartDate.getFullYear()}`, 60, 110);

    ctx.fillStyle=C.text; ctx.font=`800 56px ${FONT}`;
    ctx.fillText('Weekly', 60, 180);
    ctx.fillText('plog', 60, 240);

    // 迷你月历
    const dim = daysInMonth(weekStartDate.getFullYear(), weekStartDate.getMonth());
    const fd = new Date(weekStartDate.getFullYear(),weekStartDate.getMonth(),1).getDay();
    // 周一开头
    const firstMon = (fd===0) ? -6 : 1-fd;
    ctx.font=`400 18px ${FONT}`; ctx.fillStyle=C.textLt;
    const minisX=70, minisY=300, minisCell=32;
    ['M','T','W','T','F','S','S'].forEach((d,i)=>{
      ctx.fillText(d, minisX + i*minisCell + 8, minisY);
    });
    const todayStr = ymd(new Date());
    for(let i=firstMon, col=0; i<=dim-firstMon; i++,col++){
      if(col%7===0 && i!==firstMon){ /* row break handled by row tracker below */ }
    }
    // 简化:7 列填充
    let idx = firstMon;
    for(let i=1; i<=dim+Math.abs(firstMon); i++){
      if(idx<1){
        idx++; continue;
      }
      if(idx>dim) break;
      const week = Math.floor((idx-1+((fd===0)?-6:1-fd)+6)/7) + (fd===0?1:0);
      // 用列号 col = (idx-1+偏移) % 7,行 row
      const xPos = ((idx-1) + ((fd===0)?-6:1-fd) + 7*7) % 7;
      const yPos = Math.floor(((idx-1) + ((fd===0)?-6:1-fd))/7);
      // 上面的算法复杂,简化:从 1 号直接落格
      const dayCol = ((fd===0?6:fd-1) + (idx-1)) % 7;
      const dayRow = Math.floor(((fd===0?6:fd-1) + (idx-1))/7);
      const xc = minisX + dayCol*minisCell;
      const yc = minisY + 30 + dayRow*minisCell;
      const ds = ymd(new Date(weekStartDate.getFullYear(),weekStartDate.getMonth(),idx));
      const isToday = ds===todayStr;
      ctx.font=`${isToday?'700':'400'} 18px ${FONT}`;
      ctx.fillStyle = isToday ? C.purple : C.text;
      ctx.fillText(String(idx), xc+8, yc);
      idx++;
    }

    // 右侧 7 个日格
    const rightX = leftW+70, rightW = W - rightX - 30;
    const cellH = (H-60-6*12)/7;  // 7 列竖排(竖版周记)→ 改成横排 7 列
    // 重设:横版周记改用 7 列横排,每列有照片 + 文字
    ctx.font=`700 14px ${FONT}`;
    const cols = 4, rows = 2;
    const colW = (rightW - (cols-1)*12) / cols;
    const rowH = (H - 90 - (rows-1)*14) / rows;
    // 只渲染本周一~日 7 天,放 7 个位置(用 7 列横排 1 行,行高更大)
    // 更适合手机的版式:竖排 7 天,每天一格
    // 改为竖排:7 行 1 列
    const dayColW = rightW;
    const dayRowH = (H - 90) / 7;
    // 重新画表头
    ctx.fillStyle=C.textLt;
    ctx.font=`700 14px ${FONT}`; ctx.textAlign='left';
    for(let i=0;i<7;i++){
      const x = rightX;
      const y = 80 + i*dayRowH;
      const date = new Date(weekStartDate); date.setDate(weekStartDate.getDate()+i);
      const ds = ymd(date);
      const isToday = ds===todayStr;
      // 日格背景
      ctx.fillStyle = isToday ? C.saltLt : C.card;
      roundRect(ctx, x, y, dayColW, dayRowH-8, 14);
      ctx.fill();
      ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.stroke();

      // 左侧日期竖条
      ctx.fillStyle=isToday?C.purple:C.purpleDp;
      ctx.font=`800 28px ${FONT}`;
      ctx.textAlign='left';
      ctx.fillText(labels[i], x+18, y+40);
      ctx.font=`400 16px ${FONT}`;
      ctx.fillStyle=C.textLt;
      ctx.fillText(`${date.getMonth()+1}/${date.getDate()}`, x+18, y+62);

      // 当天记录
      const dayRec = daysMap[ds];
      if(dayRec && dayRec.length){
        const one = pickOne(dayRec);
        // 小照片(圆形/方角)
        const picX = x+150, picY = y+18, picS = dayRowH-44;
        if(one.img){
          const img = await loadImage(one.img);
          ctx.save();
          roundRect(ctx, picX, picY, picS, picS, 12);
          ctx.clip();
          if(img) drawCover(ctx, img, picX, picY, picS, picS);
          else { ctx.fillStyle=C.saltLt; ctx.fillRect(picX,picY,picS,picS); }
          ctx.restore();
        } else {
          ctx.save();
          roundRect(ctx, picX, picY, picS, picS, 12);
          ctx.fillStyle=C.saltLt; ctx.fill();
          ctx.restore();
          ctx.fillStyle=C.purple; ctx.font=`36px ${FONT}`;
          ctx.textAlign='center';
          ctx.fillText('🌷', picX+picS/2, picY+picS/2+12);
          ctx.textAlign='left';
        }
        // 文字
        ctx.fillStyle=C.text; ctx.font=`400 14px ${FONT}`;
        const tx = picX + picS + 14, tw = dayColW - picS - 180;
        wrapText(ctx, one.text||'这一天没有文字', tx, y+34, tw, 22, 3);
      } else {
        // 无记录
        ctx.fillStyle=C.textLt; ctx.font=`italic 14px ${FONT}`;
        ctx.fillText('—— 这一天还没有记录 ——', x+150, y+dayRowH/2);
      }
    }

    // 底部装饰
    ctx.fillStyle=C.purpleDp; ctx.font=`600 14px ${FONT}`; ctx.textAlign='left';
    ctx.fillText('我的时光集 · Weekly plog', rightX, H-30);

    return c;
  }

  // 月历:1400×1800 竖版
  async function renderMonth(year, month, daysMap){
    const W=1400, H=1800, c=document.createElement('canvas');
    c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);

    // 顶部
    const monthEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    ctx.fillStyle=C.purpleDp; ctx.font=`700 28px ${FONT}`; ctx.textAlign='left';
    ctx.fillText('我的时光集', 50, 70);
    ctx.fillStyle=C.textLt; ctx.font=`400 18px ${FONT}`;
    ctx.fillText('Monthly photo journal', 50, 100);

    ctx.fillStyle=C.purpleDp; ctx.font=`800 64px ${FONT}`; ctx.textAlign='right';
    ctx.fillText(`${monthEn[month]} ${year}`, W-50, 90);

    // 装饰线
    ctx.strokeStyle=C.line; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(50, 130); ctx.lineTo(W-50, 130); ctx.stroke();

    // 周日起头 (周日-周六)
    const labels = ['日','一','二','三','四','五','六'];
    const calX=50, calY=160, calW=W-100;
    const cellGap=8;
    const cols=7;
    const cellW = (calW - (cols-1)*cellGap) / cols;
    const cellH = 180;

    // 周标签
    ctx.fillStyle=C.textLt; ctx.font=`700 18px ${FONT}`; ctx.textAlign='center';
    labels.forEach((l,i)=>{
      const x = calX + i*(cellW+cellGap);
      ctx.fillText(l, x+cellW/2, calY+24);
    });

    const dim = daysInMonth(year, month);
    const fd = new Date(year,month,1).getDay();
    const todayStr = ymd(new Date());

    for(let d=1; d<=dim; d++){
      const idx = d-1+fd;
      const col = idx%7, row = Math.floor(idx/7);
      const x = calX + col*(cellW+cellGap);
      const y = calY + 40 + row*(cellH+cellGap);

      ctx.fillStyle=C.card;
      roundRect(ctx, x, y, cellW, cellH, 14);
      ctx.fill();
      ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.stroke();

      const ds = ymd(new Date(year,month,d));
      const isToday = ds===todayStr;
      // 日期数字(左上)
      ctx.fillStyle=isToday?C.purple:C.textLt;
      ctx.font=`700 22px ${FONT}`; ctx.textAlign='left';
      ctx.fillText(String(d), x+12, y+26);

      const dayRec = daysMap[ds];
      if(dayRec && dayRec.length){
        const one = pickOne(dayRec);
        // 照片区域占下方
        const picX=x+8, picY=y+36, picW=cellW-16, picH=cellH-50;
        if(one.img){
          const img = await loadImage(one.img);
          ctx.save();
          roundRect(ctx, picX, picY, picW, picH, 8);
          ctx.clip();
          if(img) drawCover(ctx, img, picX, picY, picW, picH);
          else { ctx.fillStyle=C.saltLt; ctx.fillRect(picX,picY,picW,picH); }
          ctx.restore();
        } else {
          ctx.save();
          roundRect(ctx, picX, picY, picW, picH, 8);
          ctx.fillStyle=C.saltLt; ctx.fill();
          ctx.restore();
          ctx.fillStyle=C.purple; ctx.font=`36px ${FONT}`; ctx.textAlign='center';
          ctx.fillText('🌸', picX+picW/2, picY+picH/2+12);
          ctx.textAlign='left';
        }
      } else {
        // 空格子,只显示一个淡淡的小花
        ctx.fillStyle=C.line; ctx.font=`24px ${FONT}`; ctx.textAlign='center';
        ctx.fillText('·', x+cellW/2, y+cellH/2+8);
        ctx.textAlign='left';
      }
    }

    // 底部
    ctx.fillStyle=C.textLt; ctx.font=`400 14px ${FONT}`;
    ctx.fillText('点击具体日期可查看当天细节 · 长按导出 PDF/PNG', 50, H-30);

    return c;
  }

  /* =============================================================
   * 导出
   * ============================================================= */
  function canvasToBlob(canvas, type='image/png'){
    return new Promise((res,rej)=>{
      canvas.toBlob(b=> b ? res(b) : rej(new Error('toBlob failed')), type, 0.95);
    });
  }

  function triggerDownload(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  async function exportPNG(canvas, filename){
    const blob = await canvasToBlob(canvas);
    triggerDownload(blob, filename);
  }

  /* =============================================================
   * 零依赖 PDF 1.4 构造器
   * 仅支持图片嵌入,A4 尺寸,适合打印
   * 输出 Uint8Array,再封装 Blob
   * ============================================================= */
  const PDF = (function(){
    // A4 @ 72dpi: 595 x 842 pt
    const PAGE_W = 595, PAGE_H = 842;

    function asciiStr(s){
      return s.replace(/[\u0080-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4,'0'));
    }

    // 计算 JPEG/PNG dataURL 的 bytes
    function dataURLToBytes(dataURL){
      const i = dataURL.indexOf(',');
      const b64 = dataURL.slice(i+1);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }

    function makeImageObject(imgBytes){
      // /Type /XObject /Subtype /Image
      const objNum = ++PDF._objCount;
      const dict = ['<<','/Type','/XObject','/Subtype','/Image',
        '/Width', String(PDF._imgW), '/Height', String(PDF._imgH),
        '/ColorSpace','/DeviceRGB','/BitsPerComponent','8',
        '/Filter','/DCTDecode','/Length', String(imgBytes.length),'>>'];
      PDF._objects[objNum] = {dict: dict.join(' '), stream: imgBytes};
      PDF._imgObjNum = objNum;
      return objNum;
    }

    // 把 canvas 渲染为 JPEG bytes
    async function canvasToJpegBytes(canvas, quality=0.85){
      const blob = await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality));
      const buf = await blob.arrayBuffer();
      return new Uint8Array(buf);
    }

    // 把 canvas 居中缩放放进 A4 页;返回 image object num
    async function addCanvasPage(canvas){
      // 缩放:让较长边填满页面(留 24pt 边距)
      const margin = 24;
      const maxW = PAGE_W - margin*2, maxH = PAGE_H - margin*2;
      const cw = canvas.width, ch = canvas.height;
      const scale = Math.min(maxW/cw, maxH/ch);
      const drawW = cw*scale, drawH = ch*scale;
      const dx = (PAGE_W-drawW)/2, dy = (PAGE_H-drawH)/2;

      const jpegBytes = await canvasToJpegBytes(canvas);

      // 图片 XObject
      const imgObjNum = ++PDF._objCount;
      PDF._objects[imgObjNum] = {
        dict: `<< /Type /XObject /Subtype /Image /Width ${cw} /Height ${ch} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`,
        stream: jpegBytes
      };

      // 内容流:把图绘到页面
      const contentStr = `q\n${drawW} 0 0 ${drawH} ${dx} ${dy} cm\n/Im0 Do\nQ`;
      const contentBytes = new TextEncoder().encode(contentStr);
      const contentObjNum = ++PDF._objCount;
      PDF._objects[contentObjNum] = {
        dict: `<< /Length ${contentBytes.length} >>`,
        stream: contentBytes
      };

      PDF._pages.push({contentObjNum, imgObjNum});
    }

    async function build(canvases){
      PDF._objCount = 0;
      PDF._objects = {};
      PDF._pages = [];
      // 1: catalog; 2: pages
      const catalogNum = ++PDF._objCount;  // 1
      const pagesNum = ++PDF._objCount;    // 2

      for(const c of canvases){ await addCanvasPage(c); }

      // 写每个 page 对象
      const pageNums = [];
      for(const p of PDF._pages){
        const n = ++PDF._objCount;
        pageNums.push(n);
        const dict = `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 ${p.imgObjNum} 0 R >> >> /Contents ${p.contentObjNum} 0 R >>`;
        PDF._objects[n] = {dict, stream: null};
      }

      const pagesKids = pageNums.map(n=>`${n} 0 R`).join(' ');
      PDF._objects[catalogNum] = {dict: `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`, stream: null};
      PDF._objects[pagesNum] = {dict: `<< /Type /Pages /Kids [${pagesKids}] /Count ${pageNums.length} >>`, stream: null};

      // 拼接 PDF
      const parts = [];
      const offsets = [];
      function emit(str){
        parts.push(new TextEncoder().encode(str));
      }

      emit('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
      let length = 0;
      // 计算总长度需要一次预扫:简单方案——先算每个对象大小再写偏移
      const objEntries = Object.entries(PDF._objects).sort((a,b)=>+a[0]-+b[0]);

      // 先收集每个对象的字节
      const objBytes = objEntries.map(([n, obj])=>{
        const dictBytes = new TextEncoder().encode(obj.dict);
        if(obj.stream){
          // XObject(Image) 或 Contents: 字典后接 stream\nBYTES\nendstream
          return {n:+n, header: dictBytes, footer: new TextEncoder().encode('\nendstream\nendobj\n'), preStream: new TextEncoder().encode('\nstream\n'), stream: obj.stream};
        } else {
          return {n:+n, header: dictBytes, footer: new TextEncoder().encode('\nendobj\n'), preStream: null, stream: null};
        }
      });

      // 计算偏移
      let pos = parts[0].length;
      for(const o of objBytes){
        offsets[o.n] = pos;
        const headLen = String(`${o.n} 0 obj\n`).length + o.header.length;
        const preLen = o.preStream ? o.preStream.length : 0;
        const streamLen = o.stream ? o.stream.length : 0;
        const footLen = o.footStream ? 0 : o.footStream === undefined ? 0 : 0;
        const fLen = o.footStream ? o.footStream.length : o.footer.length;
        pos += headLen + preLen + streamLen + fLen;
      }
      // 写入每个对象
      for(const o of objBytes){
        emit(`${o.n} 0 obj\n`);
        parts.push(o.header);
        if(o.preStream){ parts.push(o.preStream); }
        if(o.stream){ parts.push(o.stream); }
        if(o.footStream){ parts.push(o.footStream); }
        else { parts.push(o.footer); }
      }

      // xref
      const xrefOffset = pos;
      emit(`xref\n0 ${objBytes.length+1}\n`);
      emit(`0000000000 65535 f \n`);
      for(const o of objBytes){
        emit(String(offsets[o.n]).padStart(10,'0')+' 00000 n \n');
      }
      // trailer
      emit(`trailer\n<< /Size ${objBytes.length+1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

      // 合并
      let totalLen = 0;
      for(const p of parts) totalLen += p.length;
      const out = new Uint8Array(totalLen);
      let off = 0;
      for(const p of parts){ out.set(p, off); off += p.length; }
      return out;
    }

    async function exportPDF(canvases, filename){
      const bytes = await build(canvases);
      const blob = new Blob([bytes], {type:'application/pdf'});
      triggerDownload(blob, filename);
    }

    return { build, exportPDF, PAGE_W, PAGE_H };
  })();

  /* =============================================================
   * 摄影集:单图翻页
   * ============================================================= */
  async function renderPhotoPage(rec){
    const W=1200, H=1600, c=document.createElement('canvas');
    c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    // 黑底
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);

    // 图
    if(rec.img){
      const img = await loadImage(rec.img);
      const maxW=W-120, maxH=H-340;
      const ir=img?img.width/img.height:1, dr=maxW/maxH;
      let dw, dh;
      if(ir>dr){ dh=maxH; dw=dh*ir; }
      else { dw=maxW; dh=dw/ir; }
      const dx=(W-dw)/2, dy=120+(maxH-dh)/2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(60,120,W-120,H-340);
      ctx.fillStyle='#666'; ctx.font=`48px ${FONT}`; ctx.textAlign='center';
      ctx.fillText('无图', W/2, H/2);
    }

    // 顶部日期
    const d = new Date(rec.ts);
    const ds = ymd(d);
    ctx.fillStyle='#fff'; ctx.font=`700 18px ${FONT}`; ctx.textAlign='center';
    ctx.fillText(`${ds}  ·  ${['周日','周一','周二','周三','周四','周五','周六'][dayOfWeek(d)]}`, W/2, 60);
    ctx.font=`400 14px ${FONT}`; ctx.fillStyle='#888';
    ctx.fillText(`${d.getHours()}:${pad2(d.getMinutes())}`, W/2, 86);

    // 底部文字
    if(rec.text){
      ctx.fillStyle='#ddd'; ctx.font=`500 22px ${FONT}`; ctx.textAlign='center';
      wrapText(ctx, rec.text, 100, H-200, W-200, 32, 3);
    }
    return c;
  }

  /* ---------- 暴露给 app.js ---------- */
  window.Timebook = {
    C, FONT,
    groupByDay, pickOne,
    renderDay, renderWeek, renderMonth,
    renderPhotoPage,
    exportPNG,
    exportPDF: PDF.exportPDF,
    PDF,
    triggerDownload, canvasToBlob,
    ymd, ymKey, daysInMonth, weekStart, pad2,
  };
})();
