(function () {
  'use strict';

  /* ══════════ 配置区（发布/更新时改这里） ══════════ */
  var APP_VERSION = '1.5.5';            // 本版本号，需与 android versionName 一致
  // 更新检查：填你托管 version.json 的地址（Cloudflare Pages）。
  var UPDATE_VERSION_URL = 'https://diandian-f1q.pages.dev/version.json';
  var UPDATE_APK_FALLBACK = 'https://diandian-f1q.pages.dev/diandian.apk';  // version.json 里没写 url 时的兜底下载地址

  var STORE_KEY = 'diandian_v3';
  var LEGACY_KEYS = ['diandian_v2', 'diandian_counters_v1'];
  var BASE_SUTRAS = window.SUTRAS || [];

  /* ── 存储 ── */
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var data = load();
  function blank() { return { counters: [], custom: [], settings: {} }; }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var o = JSON.parse(raw); if (o && Array.isArray(o.counters)) { o.custom = o.custom || []; o.settings = o.settings || {}; return o; } }
      // 迁移旧版本数据
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        var lr = localStorage.getItem(LEGACY_KEYS[i]);
        if (lr) { var lo = JSON.parse(lr); if (lo && Array.isArray(lo.counters) && lo.counters.length) {
          lo.custom = lo.custom || []; lo.settings = lo.settings || {};
          try { localStorage.setItem(STORE_KEY, JSON.stringify(lo)); } catch (e) {}
          return lo;
        } }
      }
    } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { toast('保存失败'); } }
  function S(k, d) { return data.settings[k] === undefined ? d : data.settings[k]; }

  function byId(id) { for (var i = 0; i < data.counters.length; i++) if (data.counters[i].id === id) return data.counters[i]; return null; }
  function totalOf(c) { var t = 0; for (var k in c.days) t += c.days[k]; return t; }
  function dayCount(c, k) { return c.days[k] || 0; }
  function allSutras() { return BASE_SUTRAS.concat(data.custom || []); }
  function sutraById(id) { var a = allSutras(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }

  /* ── 收藏 ── */
  function favList() { return data.settings.favs || []; }
  function isFav(id) { return favList().indexOf(id) >= 0; }
  function toggleFav(id) { var a = favList(); var i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); data.settings.favs = a; save(); }

  /* ── 拼音注音 ── */
  var SUTRA_PY = window.SUTRA_PY || {};
  function pyOn() { return S('pinyin', true); }
  function paraDom(text, py) {
    var el = document.createElement('p');
    if (py && pyOn()) {
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i), syl = py[i];
        if (syl) {
          var r = document.createElement('ruby');
          r.appendChild(document.createTextNode(ch));
          var rt = document.createElement('rt'); rt.textContent = syl;
          r.appendChild(rt); el.appendChild(r);
        } else {
          el.appendChild(document.createTextNode(ch));
        }
      }
    } else {
      el.textContent = text;
    }
    return el;
  }
  function pyNote() {
    var n = document.createElement('div'); n.className = 'py-note';
    n.textContent = '咒语是梵文音译，这里按通行的汉字读音标注。不同寺院、师承的念法可能略有出入，若你常去的道场有不同念法，请以师承为准。';
    return n;
  }

  /* ══════════ 清脆按键音（WebAudio 合成，无需音频文件） ══════════ */
  var _ac = null;
  function audioCtx() {
    if (_ac) return _ac;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { _ac = new AC(); } catch (e) { _ac = null; } return _ac;
  }
  function tick(kind) {
    if (!S('sound', true)) return;
    var ctx = audioCtx(); if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    var t = ctx.currentTime;
    var base = kind === 'minus' ? 300 : (kind === 'plus' ? 520 : 440);
    // 木质"嗒"体音：正弦快速下滑 + 短包络，像拨念珠 / 敲木鱼
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(base, t + 0.018);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.13);
    // 泛音：增加清脆感
    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(base * 3.0, t);
    o2.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.02);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.13, t + 0.003);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o2.connect(g2); g2.connect(ctx.destination); o2.start(t); o2.stop(t + 0.06);
    // 瞬态"咔"：带通白噪声，模拟珠子相碰的起振
    var len = Math.floor(ctx.sampleRate * 0.02);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) { d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 5; bp.Q.value = 1.1;
    var ng = ctx.createGain(); ng.gain.setValueAtTime(0.12, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    src.connect(bp); bp.connect(ng); ng.connect(ctx.destination); src.start(t);
  }

  /* ══════════ 字号 ══════════ */
  var FS = [15, 17, 20, 23];
  function applyFont() { var i = S('fontScale', 1); document.documentElement.style.setProperty('--fs', (FS[i] || 17) + 'px'); }
  applyFont();

  /* ══════════ 主题（浅色 / 夜间） ══════════ */
  function darkOn() { return S('theme', 'light') === 'dark'; }
  function applyTheme() {
    var dark = darkOn();
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    var mt = document.querySelector('meta[name="theme-color"]');
    if (!mt) { mt = document.createElement('meta'); mt.name = 'theme-color'; document.head.appendChild(mt); }
    mt.content = dark ? '#1a1712' : '#f4f2ed';
  }
  applyTheme();

  /* ── 顶栏日期 ── */
  var weekCN = ['日', '一', '二', '三', '四', '五', '六'];
  function renderTopDate() { var d = new Date(); document.getElementById('topDate').textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + weekCN[d.getDay()]; }
  renderTopDate();
  setInterval(function () {
    renderTopDate(); renderRail(); renderCountTab(); renderZen();
    if (currentDetail) renderDetail(byId(currentDetail));
  }, 60000);

  /* ── Tab 切换 ── */
  var navBtns = document.querySelectorAll('nav button');
  var TAB_TITLE = { tabHome: '点点计数', tabCount: '计数器', tabShelf: '书架', tabSettings: '设置' };
  navBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      navBtns.forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
      document.querySelectorAll('main > .tab').forEach(function (t) { t.classList.remove('on'); });
      document.getElementById(b.dataset.tab).classList.add('on');
      document.getElementById('hdrTitle').textContent = TAB_TITLE[b.dataset.tab] || '点点计数';
      if (b.dataset.tab === 'tabShelf') renderShelf();
      if (b.dataset.tab === 'tabCount') renderCountTab();
      if (b.dataset.tab === 'tabSettings') renderSettings();
      if (b.dataset.tab === 'tabHome') { renderHomeSutra(); renderRail(); }
    });
  });

  /* ── 主页经文 ── */
  var pane = document.getElementById('homeSutraPane');
  function renderHomeSutra() {
    pane.innerHTML = '';
    var s = sutraById(S('homeSutra', ''));
    if (!s) { pane.innerHTML = '<div class="sutra-empty">还没有放到主页的经文<br><br>去「书架」选一本，<br>打开后点「放到主页」</div>'; return; }
    var h = document.createElement('div'); h.className = 'sutra-head'; h.textContent = s.title;
    pane.appendChild(h);
    if (s.source) { var f = document.createElement('div'); f.className = 'sutra-from'; f.textContent = s.source; pane.appendChild(f); }
    try { pane.appendChild(buildListenBar(s)); } catch (e) {}
    var body = document.createElement('div'); body.className = 'sutra-body';
    var py = SUTRA_PY[s.id];
    var showPy = py && pyOn();
    if (showPy) body.classList.add('with-py');
    s.paras.forEach(function (p, i) { body.appendChild(paraDom(p, showPy ? py[i] : null)); });
    pane.appendChild(body);
  }

  /* ── 书架 ── */
  function makeBook(s) {
    var b = document.createElement('div');
    b.className = 'book' + (S('homeSutra', '') === s.id ? ' home' : '');
    var main = document.createElement('div'); main.className = 'bk-main';
    var bt = document.createElement('div'); bt.className = 'bt'; bt.textContent = s.title;
    var bs = document.createElement('div'); bs.className = 'bs';
    bs.innerHTML = (s.source ? esc(s.source) + ' · ' : '') + s.paras.length + ' 段';
    if (hasAudio(s.id)) { var au = document.createElement('span'); au.className = 'bk-audio'; au.textContent = '♪ 有声'; bs.appendChild(au); }
    main.appendChild(bt); main.appendChild(bs);
    var act = document.createElement('div'); act.className = 'bk-act';
    var star = document.createElement('button'); star.className = 'fav' + (isFav(s.id) ? ' on' : '');
    star.textContent = isFav(s.id) ? '★' : '☆';
    star.addEventListener('click', function (e) {
      e.stopPropagation(); toggleFav(s.id);
      star.className = 'fav' + (isFav(s.id) ? ' on' : ''); star.textContent = isFav(s.id) ? '★' : '☆';
      toast(isFav(s.id) ? '已收藏' : '已取消收藏');
      renderShelf();
    });
    var go = document.createElement('span'); go.className = 'go'; go.textContent = '›';
    act.appendChild(star); act.appendChild(go);
    b.appendChild(main); b.appendChild(act);
    b.addEventListener('click', function () { openRead(s.id); });
    return b;
  }
  function renderShelf() {
    var shelf = document.getElementById('tabShelf'); shelf.innerHTML = '';
    var favs = favList().map(function (id) { return sutraById(id); }).filter(Boolean);
    if (favs.length) {
      var fc = document.createElement('div'); fc.className = 'shelf-group'; fc.textContent = '我 收 藏 的';
      shelf.appendChild(fc);
      favs.forEach(function (s) { shelf.appendChild(makeBook(s)); });
    }
    var groups = {};
    allSutras().forEach(function (s) { (groups[s.kind] = groups[s.kind] || []).push(s); });
    var order = ['经', '咒', '偈颂', '自定义'];
    order.forEach(function (g) {
      if (!groups[g]) return;
      var cap = document.createElement('div'); cap.className = 'shelf-group';
      cap.textContent = g === '经' ? '佛 经' : (g === '咒' ? '咒 语' : (g === '偈颂' ? '偈 颂 · 回 向' : '我 导 入 的'));
      shelf.appendChild(cap);
      groups[g].forEach(function (s) { shelf.appendChild(makeBook(s)); });
    });
    var imp = document.createElement('button'); imp.className = 'importbtn'; imp.textContent = '＋ 导入我的经文';
    imp.addEventListener('click', openImport); shelf.appendChild(imp);
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  /* ── 阅读整屏 ── */
  var readPage = document.getElementById('readPage'); var currentReadId = null;
  function openRead(id) {
    var s = sutraById(id); if (!s) return; currentReadId = id;
    document.getElementById('rTitle').textContent = s.title;
    var body = document.getElementById('rBody'); body.innerHTML = ''; body.scrollTop = 0;
    body.appendChild(buildListenBar(s));
    if (s.source) { var m = document.createElement('div'); m.className = 'meta'; m.textContent = s.source; body.appendChild(m); }
    var py = SUTRA_PY[s.id];
    var showPy = py && pyOn();
    body.classList.toggle('with-py', !!showPy);
    s.paras.forEach(function (p, i) { body.appendChild(paraDom(p, showPy ? py[i] : null)); });
    if (showPy && s.kind === '咒') body.appendChild(pyNote());
    var btn = document.getElementById('btnSetHome');
    var isCustom = s.custom === true;
    btn.style.display = isCustom ? '' : '';
    updateSetHomeBtn(); readPage.classList.add('open');
  }
  document.getElementById('btnReadBack').addEventListener('click', function () { readPage.classList.remove('open'); });
  function updateSetHomeBtn() {
    var btn = document.getElementById('btnSetHome'); var cur = S('homeSutra', '') === currentReadId;
    btn.textContent = cur ? '已在主页' : '放到主页'; btn.classList.toggle('cur', cur);
  }
  document.getElementById('btnSetHome').addEventListener('click', function () {
    if (!currentReadId) return; data.settings.homeSutra = currentReadId; save();
    updateSetHomeBtn(); renderHomeSutra(); toast('已放到主页');
  });

  /* ── 主页侧栏：计数 ── */
  function railCounter() { var c = byId(S('homeCounter', '')); if (c) return c; if (data.counters.length) { data.settings.homeCounter = data.counters[0].id; save(); return data.counters[0]; } return null; }
  function renderRail() { var c = railCounter(); document.getElementById('railNum').textContent = c ? dayCount(c, todayKey()) : 0; document.getElementById('railPick').textContent = c ? c.name : '选择计数'; var hn = document.getElementById('hbName'); if (hn) hn.textContent = c ? c.name : '未选择'; }
  function flyPlus(x, y) { var el = document.createElement('div'); el.className = 'fly'; el.textContent = '+1'; el.style.left = (x - 12) + 'px'; el.style.top = (y - 34) + 'px'; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 750); }
  function inc(c, by) {
    if (!c) return; var tk = todayKey(); var v = (c.days[tk] || 0) + by;
    if (v <= 0) { delete c.days[tk]; } else { c.days[tk] = v; }
    save();
  }
  document.getElementById('railPlus').addEventListener('click', function (e) {
    var c = railCounter(); if (!c) { switchTab('tabCount'); askNewCounter(); return; }
    inc(c, 1); tick('plus'); if (navigator.vibrate) navigator.vibrate(12); flyPlus(e.clientX, e.clientY);
    renderRail(); renderCountTab(); renderZen(); if (currentDetail === c.id) renderDetail(c);
  });
  document.getElementById('railMinus').addEventListener('click', function () {
    var c = railCounter(); if (!c) return; if ((c.days[todayKey()] || 0) <= 0) { toast('今天已经是 0 了'); return; }
    inc(c, -1); tick('minus'); renderRail(); renderCountTab(); renderZen(); if (currentDetail === c.id) renderDetail(c);
  });
  document.getElementById('railSutra').addEventListener('click', openSutraPick);
  document.getElementById('railPick').addEventListener('click', openPick);
  document.getElementById('railZen').addEventListener('click', openZen);

  function switchTab(id) { var b = document.querySelector('nav button[data-tab="' + id + '"]'); if (b) b.click(); }

  /* ── 选择计数器 ── */
  var pickCb = null;
  function openPick(cb) {
    pickCb = cb || null;
    var list = document.getElementById('pickList'); list.innerHTML = '';
    if (!data.counters.length) { list.innerHTML = '<div style="padding:14px;text-align:center;color:var(--ink2);font-size:13px">还没有计数器，去「计数」页新建一个</div>'; }
    data.counters.forEach(function (c) {
      var it = document.createElement('div'); it.className = 'book'; it.style.marginBottom = '8px';
      it.innerHTML = '<div class="bt"></div>' + (c.id === S('homeCounter', '') ? '<span style="font-size:11px;color:var(--accent-deep)">当前</span>' : '<span class="go">›</span>');
      it.querySelector('.bt').textContent = c.name;
      it.addEventListener('click', function () {
        if (pickCb) { pickCb(c); } else { data.settings.homeCounter = c.id; save(); renderRail(); renderCountTab(); renderZen(); }
        hide(document.getElementById('pickMask'));
      });
      list.appendChild(it);
    });
    show(document.getElementById('pickMask'));
  }
  document.getElementById('pickCancel').addEventListener('click', function () { hide(document.getElementById('pickMask')); });

  /* ── 主页换经文 ── */
  function pickRow(s, list) {
    var isHome = S('homeSutra', '') === s.id;
    var it = document.createElement('div'); it.className = 'book'; it.style.marginBottom = '8px';
    var main = document.createElement('div'); main.className = 'bk-main';
    var bt = document.createElement('div'); bt.className = 'bt'; bt.textContent = s.title; main.appendChild(bt);
    var act = document.createElement('div'); act.className = 'bk-act';
    if (isHome) { var mk = document.createElement('span'); mk.style.cssText = 'font-size:11px;color:var(--accent-deep)'; mk.textContent = '当前'; act.appendChild(mk); }
    var star = document.createElement('button'); star.className = 'fav' + (isFav(s.id) ? ' on' : ''); star.textContent = isFav(s.id) ? '★' : '☆';
    star.addEventListener('click', function (e) {
      e.stopPropagation(); toggleFav(s.id); openSutraPick();
    });
    act.appendChild(star);
    it.appendChild(main); it.appendChild(act);
    it.addEventListener('click', function () {
      data.settings.homeSutra = s.id; save(); renderHomeSutra(); renderShelf();
      hide(document.getElementById('sutraPickMask')); toast('已换到主页');
    });
    list.appendChild(it);
  }
  function pickCap(t) { var c = document.createElement('div'); c.className = 'pick-cap'; c.textContent = t; return c; }
  function openSutraPick() {
    var list = document.getElementById('sutraPickList'); list.innerHTML = '';
    var favs = favList().map(function (id) { return sutraById(id); }).filter(Boolean);
    if (favs.length) { list.appendChild(pickCap('我 收 藏 的')); favs.forEach(function (s) { pickRow(s, list); }); }
    list.appendChild(pickCap('全 部 经 文')); allSutras().forEach(function (s) { pickRow(s, list); });
    show(document.getElementById('sutraPickMask'));
  }
  document.getElementById('sutraPickCancel').addEventListener('click', function () { hide(document.getElementById('sutraPickMask')); });

  /* ══════════ 全屏禅修计数页 ══════════ */
  var zenPage = document.getElementById('zenPage');
  function openZen() { renderZen(); zenPage.classList.add('open'); }
  function renderZen() {
    var c = railCounter();
    document.getElementById('zenName').textContent = c ? c.name : '未选择';
    document.getElementById('zenNum').textContent = c ? dayCount(c, todayKey()) : 0;
    document.getElementById('zenSub').textContent = c ? ('今日 ' + dayCount(c, todayKey()) + ' · 累计 ' + totalOf(c)) : '';
  }
  function zenInc(by) {
    var c = railCounter(); if (!c) { hide(zenPage); switchTab('tabCount'); askNewCounter(); return; }
    if (by > 0 && (c.days[todayKey()] || 0) + by < 0) return;
    if (by < 0 && (c.days[todayKey()] || 0) <= 0) { return; }
    inc(c, by); if (navigator.vibrate) navigator.vibrate(12);
    var num = document.getElementById('zenNum'); num.classList.remove('zen-flash'); void num.offsetWidth; num.classList.add('zen-flash');
    renderZen(); renderRail(); renderCountTab(); if (currentDetail === c.id) renderDetail(c);
  }
  document.getElementById('zenMain').addEventListener('click', function () { tick('plus'); zenInc(1); });
  document.getElementById('zenPlus').addEventListener('click', function () { tick('plus'); zenInc(1); });
  document.getElementById('zenMinus').addEventListener('click', function () { tick('minus'); zenInc(-1); });
  document.getElementById('zenSwitch').addEventListener('click', function () { openPick(function (c) { data.settings.homeCounter = c.id; save(); renderZen(); renderRail(); renderCountTab(); }); });
  document.getElementById('zenExit').addEventListener('click', function () { zenPage.classList.remove('open'); });

  /* ── 计时器（退出APP即停） ── */
  var timer = { sec: 0, running: false, iv: null };
  var timeShow = document.getElementById('timeShow'), timeToggle = document.getElementById('timeToggle');
  function fmt(s) { var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return h > 0 ? (h + ':' + pad(m) + ':' + pad(ss)) : (pad(m) + ':' + pad(ss)); }
  function renderTimer() { timeShow.textContent = fmt(timer.sec); timeToggle.textContent = timer.running ? '暂停' : '开始'; timeToggle.classList.toggle('run', timer.running); }
  function startTimer() { timer.running = true; timer.iv = setInterval(function () { timer.sec++; renderTimer(); }, 1000); renderTimer(); }
  function stopTimer() { timer.running = false; clearInterval(timer.iv); renderTimer(); }
  timeToggle.addEventListener('click', function () { timer.running ? stopTimer() : startTimer(); });
  document.getElementById('timeReset').addEventListener('click', function () {
    if (timer.sec <= 0) { toast('计时已经是 0 了'); return; }
    askConfirm('把计时「' + fmt(timer.sec) + '」清零？', function () { stopTimer(); timer.sec = 0; renderTimer(); toast('计时已清零'); });
  });
  function exitPause() { if (timer.running) { stopTimer(); toast('已退出，计时停止'); } }
  document.addEventListener('visibilitychange', function () { if (document.hidden) exitPause(); });
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try { window.Capacitor.Plugins.App.addListener('pause', exitPause); } catch (e) {}
  }
  renderTimer();

  /* ── 计数管理页 ── */
  function renderCountTab() {
    var el = document.getElementById('tabCount'); el.innerHTML = '';
    data.counters.forEach(function (c) {
      var card = document.createElement('div'); card.className = 'card';
      var tk = todayKey(); var isHome = c.id === S('homeCounter', '');
      card.innerHTML = '<div class="info"><div class="name"></div><div class="sub">今天 <b>' + dayCount(c, tk) + '</b> 次 · 累计 ' + totalOf(c) + ' 次</div></div>';
      card.querySelector('.name').textContent = c.name;
      if (isHome) { var tag = document.createElement('span'); tag.className = 'home-mark'; tag.textContent = '主页'; card.querySelector('.name').appendChild(tag); }
      var add = document.createElement('button'); add.className = 'mini-btn'; add.textContent = '+1';
      add.style.cssText = 'background:var(--accent);color:#fff;border-color:var(--accent);font-size:16px;padding:8px 14px';
      add.addEventListener('click', function (e) { inc(c, 1); tick('plus'); if (navigator.vibrate) navigator.vibrate(12); flyPlus(e.clientX, e.clientY); renderCountTab(); renderRail(); renderZen(); });
      var zen = document.createElement('button'); zen.className = 'mini-btn'; zen.textContent = '全屏';
      zen.addEventListener('click', function () { data.settings.homeCounter = c.id; save(); renderRail(); openZen(); });
      var his = document.createElement('button'); his.className = 'mini-btn'; his.textContent = '记录';
      his.addEventListener('click', function () { openDetail(c.id); });
      card.appendChild(add); card.appendChild(zen); card.appendChild(his); el.appendChild(card);
    });
    var add2 = document.createElement('button'); add2.className = 'addcard'; add2.textContent = '＋ 新建计数器';
    add2.addEventListener('click', askNewCounter); el.appendChild(add2);
  }
  function askNewCounter() {
    askInput('新建计数器', '', function (name) {
      var c = { id: 'c' + Date.now(), name: name, days: {} }; data.counters.push(c);
      if (!S('homeCounter', '')) data.settings.homeCounter = c.id;
      save(); renderCountTab(); renderRail();
    });
  }

  /* ── 计数详情 ── */
  var detailPage = document.getElementById('detailPage'); var currentDetail = null;
  function openDetail(id) { var c = byId(id); if (!c) return; currentDetail = id; document.getElementById('dName2').textContent = c.name; renderDetail(c); detailPage.classList.add('open'); }
  document.getElementById('btnBack').addEventListener('click', function () { detailPage.classList.remove('open'); currentDetail = null; });
  function renderDetail(c) {
    if (!c) { detailPage.classList.remove('open'); return; }
    document.getElementById('dTotal').textContent = totalOf(c);
    document.getElementById('dToday').textContent = dayCount(c, todayKey());
    var bars = document.getElementById('dBars'); bars.innerHTML = '';
    var keys = [], base = new Date(), i, d;
    for (i = 13; i >= 0; i--) { d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i); keys.push({ key: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), lab: '' + d.getDate(), md: (d.getMonth() + 1) + '/' + d.getDate() }); }
    var capEl = detailPage.querySelector('.chart .cap');
    if (capEl) capEl.textContent = '最近 14 天 · ' + keys[0].md + ' – ' + keys[keys.length - 1].md;
    var max = 1; keys.forEach(function (o) { max = Math.max(max, dayCount(c, o.key)); });
    keys.forEach(function (o) {
      var n = dayCount(c, o.key);
      var col = document.createElement('div'); col.className = 'bar-col';
      var v = document.createElement('div'); v.className = 'bar-val'; v.textContent = n || '';
      var b = document.createElement('div'); b.className = 'bar' + (n ? ' hit' : ''); b.style.height = n ? Math.max(4, Math.round(n / max * 96)) + 'px' : '2px';
      var l = document.createElement('div'); l.className = 'bar-lab'; l.textContent = o.lab;
      col.appendChild(v); col.appendChild(b); col.appendChild(l); bars.appendChild(col);
    });
    var rec = document.getElementById('dRecords'); rec.innerHTML = '';
    var days = Object.keys(c.days).sort().reverse().slice(0, 60);
    if (!days.length) rec.innerHTML = '<div class="rec-item"><span class="d">还没有记录</span></div>';
    days.forEach(function (k) {
      var item = document.createElement('div'); item.className = 'rec-item' + (k === todayKey() ? ' today' : '');
      item.innerHTML = '<span class="d"></span><span class="n">' + c.days[k] + ' 次</span>';
      item.querySelector('.d').textContent = k; rec.appendChild(item);
    });
    document.getElementById('btnRename').onclick = function () { askInput('重命名', c.name, function (name) { c.name = name; save(); document.getElementById('dName2').textContent = name; renderCountTab(); renderRail(); renderZen(); toast('已改名'); }); };
    document.getElementById('btnReset').onclick = function () { var tk = todayKey(); if (!c.days[tk]) { toast('今天还没有记录'); return; } askConfirm('把「' + c.name + '」今天的 ' + c.days[tk] + ' 次清零？', function () { delete c.days[tk]; save(); renderDetail(c); renderCountTab(); renderRail(); renderZen(); toast('已清零'); }); };
    document.getElementById('btnDelete').onclick = function () {
      askConfirm('删除「' + c.name + '」？所有历史会一起删除', function () {
        data.counters = data.counters.filter(function (x) { return x.id !== c.id; });
        if (S('homeCounter', '') === c.id) data.settings.homeCounter = data.counters.length ? data.counters[0].id : '';
        save(); detailPage.classList.remove('open'); renderCountTab(); renderRail(); renderZen(); toast('已删除');
      });
    };
  }

  /* ══════════ 导入经文 ══════════ */
  var importPage = document.getElementById('importPage');
  var _impAudioFile = null;
  function openImport() {
    document.getElementById('impName').value = ''; document.getElementById('impSource').value = ''; document.getElementById('impBody').value = '';
    _impAudioFile = null; try { document.getElementById('impAudio').value = ''; } catch (e) {} document.getElementById('impAudioName').textContent = '';
    importPage.classList.add('open');
  }
  document.getElementById('btnImportBack').addEventListener('click', function () { importPage.classList.remove('open'); });
  document.getElementById('impFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader(); r.onload = function () { document.getElementById('impBody').value = String(r.result || '').replace(/\r/g, ''); if (!document.getElementById('impName').value) document.getElementById('impName').value = f.name.replace(/\.txt$/i, ''); toast('已读取文件'); }; r.readAsText(f, 'utf-8');
  });
  document.getElementById('impAudio').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    _impAudioFile = f; document.getElementById('impAudioName').textContent = '已选音频：' + f.name;
  });
  document.getElementById('impSave').addEventListener('click', function () {
    var name = document.getElementById('impName').value.trim();
    var src = document.getElementById('impSource').value.trim();
    var body = document.getElementById('impBody').value.trim();
    if (!name) { toast('请填写经文名称'); return; }
    if (!body) { toast('正文不能为空'); return; }
    var paras = body.split(/\n\s*\n/).map(function (x) { return x.replace(/\n/g, '　').trim(); }).filter(Boolean);
    if (!paras.length) paras = [body];
    var item = { id: 'u' + Date.now(), title: name, kind: '自定义', source: src, paras: paras, custom: true };
    data.custom = data.custom || []; data.custom.push(item); save();
    importPage.classList.remove('open'); renderShelf(); toast('已导入到书架');
    if (_impAudioFile) { var f = _impAudioFile; _impAudioFile = null; persistAudio(item.id, f, function (ok) { if (ok) afterAudioChanged(item.id); }); }
  });

  /* ══════════ 设置页 ══════════ */
  function renderSettings() {
    var el = document.getElementById('tabSettings'); el.innerHTML = '';
    el.appendChild(group('阅读'));
    el.appendChild(fontRow());
    el.appendChild(switchRow('夜间模式', '屏幕变深色，夜里读经更护眼', darkOn(), function (on) { data.settings.theme = on ? 'dark' : 'light'; save(); applyTheme(); }));
    el.appendChild(switchRow('拼音注音', '不认识的字，看字上面的小拼音', S('pinyin', true), function (on) { data.settings.pinyin = on; save(); renderHomeSutra(); }));
    el.appendChild(switchRow('按键音', '点计数器加减号时"嗒"一声', S('sound', true), function (on) { data.settings.sound = on; save(); }));
    el.appendChild(group('计数器'));
    el.appendChild(linkRow('全屏计数页', '大按钮，不看屏幕也能点', function () { openZen(); }));
    el.appendChild(group('书架'));
    el.appendChild(linkRow('导入我的经文', '粘贴文字或选 txt 文件', openImport));
    el.appendChild(group('帮助与更新'));
    el.appendChild(linkRow('使用教程', '手把手，讲给长辈听', openTut));
    el.appendChild(linkRow('关于与声明', '内容来源、免责与联系方式', openAbout));
    el.appendChild(checkUpdateRow());
    var v = document.createElement('div'); v.className = 'ver';
    v.innerHTML = '点点计数 v' + APP_VERSION + '<br>计数与导入的记录都保存在本机；<br>覆盖安装新版本不会丢失数据。';
    el.appendChild(v);
  }
  function group(t) { var d = document.createElement('div'); d.className = 'set-group'; d.textContent = t; return d; }
  function fontRow() {
    var row = document.createElement('div'); row.className = 'set-row';
    row.innerHTML = '<div><div class="sl">经文文字大小</div><div class="sd">觉得字小就调大</div></div>';
    var seg = document.createElement('div'); seg.className = 'seg';
    ['小', '标准', '大', '特大'].forEach(function (lab, i) {
      var b = document.createElement('button'); b.textContent = lab; if (S('fontScale', 1) === i) b.classList.add('on');
      b.addEventListener('click', function () { data.settings.fontScale = i; save(); applyFont(); renderSettings(); });
      seg.appendChild(b);
    });
    row.appendChild(seg); return row;
  }
  function switchRow(title, desc, on, cb) {
    var row = document.createElement('div'); row.className = 'set-row';
    row.innerHTML = '<div><div class="sl">' + esc(title) + '</div><div class="sd">' + esc(desc) + '</div></div>';
    var sw = document.createElement('div'); sw.className = 'switch' + (on ? ' on' : '');
    sw.addEventListener('click', function () { var nv = !sw.classList.contains('on'); sw.classList.toggle('on', nv); cb(nv); });
    row.appendChild(sw); return row;
  }
  function linkRow(title, desc, cb) {
    var row = document.createElement('div'); row.className = 'set-row';
    row.innerHTML = '<div><div class="sl">' + esc(title) + '</div><div class="sd">' + esc(desc) + '</div></div><span class="go" style="color:var(--ink2);font-size:18px">›</span>';
    row.addEventListener('click', cb); return row;
  }
  function checkUpdateRow() {
    var row = document.createElement('div'); row.className = 'set-row';
    row.innerHTML = '<div><div class="sl">检查更新</div><div class="sd">当前 v' + APP_VERSION + '</div></div>';
    var b = document.createElement('button'); b.className = 'set-btn hl'; b.textContent = '检查';
    b.addEventListener('click', function () { checkUpdate(true); });
    row.appendChild(b); return row;
  }

  /* ══════════ 教程 ══════════ */
  var TUT = [
    ['① 怎么念一句、点一下', '想记一次，就点右边那个橙色的大圆「＋」。每点一下，上面的数字加 1。点错了就点下面的「－」减回来。'],
    ['② 不看屏幕也能记', '点「全屏计数」，会出现一个整屏的大页面。这时候手机放旁边，用手指随便碰一下屏幕，就算加了一次，还会「叮」一声告诉你成功了。'],
    ['③ 读经、换经文', '底部「书架」里有很多佛经和咒语，点一本可全屏读。想换主页显示哪本，不用来回跑：在主页点「换经文」，弹出的列表里直接点一下就换好了。看到喜欢的点右边的星「☆」收藏，收藏过的会排在书架和列表最前面。'],
    ['④ 计时念诵', '右边「计时」点「开始」就开始计时，念完点「暂停」。退出软件时，计时会自动停下来。'],
    ['⑤ 多个计数器', '想分别记「念经」「念佛」「磕头」，去「计数」页点「新建计数器」。每个都能单独改名、看每天记录。'],
    ['⑥ 自己导入经文', '「设置」或「书架」里点「导入我的经文」，把经文文字粘进去，或从手机选一个 txt 文件，保存后就能在书架里读到。'],
    ['⑦ 字太小看不清', '去「设置」里找到「经文文字大小」，有 小 / 标准 / 大 / 特大 四档，点一下就变。'],
    ['⑧ 不认识字？看拼音', '经文里每个字上面都有一行小拼音，跟着念就认得了。不想看拼音，去「设置」把「拼音注音」关掉即可。提醒：佛经里的咒语是古音译字，各寺院念法可能略有不同，App 里标的是最通行的读法，拿不准时以你常去道场的念法为准。'],
    ['⑨ 换新版本', '「设置」里点「检查更新」。有新版本会提示你，点「立即更新」下载安装即可。你之前的计数和记录都会保留，不会丢。'],
    ['⑩ 晚上嫌屏幕太亮', '去「设置」把「夜间模式」打开，整个界面会变成深色，夜里读经更护眼、不刺眼；想换回浅色，再关掉即可。'],
    ['⑪ 跟着真人念诵（听读）', '打开一本经文，最上面有「▶ 听读」，点一下就能一边看一边听。音频是真人慢板念诵（公共领域、可放心使用），联网时在线播、放过一次后会自动存到手机里，之后没网也能听——你什么都不用做。心经、大悲咒、六字大明咒、往生咒已经可以直接听；较长的经典（地藏经、金刚经等）会由作者陆续补上，补好后自动出现在你这里，不用你手动导入、也不用重装。播放器支持：单曲循环、倍速（0.75～1.5 倍）、拖动进度、以及「定时」自动停止（15 / 30 / 60 分钟）。']
  ];
  var tutPage = document.getElementById('tutPage');
  function openTut() {
    var body = document.getElementById('tutBody'); body.innerHTML = '';
    TUT.forEach(function (s) { var d = document.createElement('div'); d.className = 'tut-step'; d.innerHTML = '<div class="tt"></div><div class="tx"></div>'; d.querySelector('.tt').textContent = s[0]; d.querySelector('.tx').textContent = s[1]; body.appendChild(d); });
    tutPage.classList.add('open');
  }
  document.getElementById('btnTutBack').addEventListener('click', function () { tutPage.classList.remove('open'); });

  /* ══════════ 关于与声明（弹窗） ══════════ */
  var aboutMask = document.getElementById('aboutMask');
  var aboutNoMore = document.getElementById('aboutNoMore');
  function openAbout() { aboutNoMore.checked = !!S('aboutSeen', false); show(aboutMask); }
  document.getElementById('aboutClose').addEventListener('click', function () {
    if (aboutNoMore.checked) { data.settings.aboutSeen = true; save(); }
    hide(aboutMask);
  });

  /* ══════════ 检查更新（读取托管的 version.json） ══════════ */
  // cmpVer(a,b)：b 更大返回 1，a 更大返回 -1，相等返回 0
  function cmpVer(a, b) { a = String(a).split('.'); b = String(b).split('.'); for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = +a[i] || 0, y = +b[i] || 0; if (y > x) return 1; if (y < x) return -1; } return 0; }
  var lastUpdUrl = '';
  function checkUpdate(manual) {
    if (!UPDATE_VERSION_URL) { if (manual) toast('还没配置更新地址（见使用说明）'); return; }
    if (manual) toast('正在检查更新…');
    fetch(UPDATE_VERSION_URL, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var nv = j.version || j.tag_name || '';
      lastUpdUrl = j.url || j.downloadUrl || UPDATE_APK_FALLBACK || '';
      if (nv && cmpVer(APP_VERSION, nv) > 0) {
        if (!manual && S('dismissedVer', '') === nv) return; // 该版本已跳过
        showUpdate(nv, j.notes || '');
      } else if (manual) { toast('已是最新版本 v' + APP_VERSION); }
    }).catch(function () { if (manual) toast('检查失败，请检查网络'); });
  }
  function showUpdate(ver, notes) {
    document.getElementById('updTitle').textContent = '发现新版本 v' + ver;
    document.getElementById('updVer').textContent = '当前 v' + APP_VERSION + ' → 最新 v' + ver;
    document.getElementById('updNotes').textContent = notes || '（本次没有更新说明）';
    show(document.getElementById('updateMask'));
  }
  document.getElementById('updLater').addEventListener('click', function () { data.settings.dismissedVer = document.getElementById('updVer').textContent.split('v').pop(); save(); hide(document.getElementById('updateMask')); });
  document.getElementById('updGo').addEventListener('click', function () {
    if (!lastUpdUrl) { toast('没有下载地址'); return; }
    try { window.open(lastUpdUrl, '_blank'); } catch (e) { toast('请复制链接到浏览器打开'); }
    hide(document.getElementById('updateMask'));
  });

  /* ── 对话框工具 ── */
  function show(m) { m.classList.add('show'); }
  function hide(m) { m.classList.remove('show'); }
  var inputMask = document.getElementById('inputMask'), dlgInput = document.getElementById('dlgInput'), dlgOkCb = null;
  function askInput(title, value, cb) { document.getElementById('dlgTitle').textContent = title; dlgInput.value = value || ''; dlgOkCb = cb; show(inputMask); setTimeout(function () { dlgInput.focus(); }, 120); }
  document.getElementById('dlgCancel').addEventListener('click', function () { hide(inputMask); });
  inputMask.addEventListener('click', function (e) { if (e.target === inputMask) hide(inputMask); });
  document.getElementById('dlgOk').addEventListener('click', function () { var v = dlgInput.value.trim(); if (!v) { toast('不能为空'); return; } var cb = dlgOkCb; hide(inputMask); if (cb) cb(v); });
  dlgInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('dlgOk').click(); });
  var confirmMask = document.getElementById('confirmMask'), cfmOkCb = null;
  function askConfirm(text, cb) { document.getElementById('cfmText').textContent = text; cfmOkCb = cb; show(confirmMask); }
  document.getElementById('cfmCancel').addEventListener('click', function () { hide(confirmMask); });
  confirmMask.addEventListener('click', function (e) { if (e.target === confirmMask) hide(confirmMask); });
  document.getElementById('cfmOk').addEventListener('click', function () { var cb = cfmOkCb; hide(confirmMask); if (cb) cb(); });
  [inputMask, confirmMask, document.getElementById('pickMask'), document.getElementById('sutraPickMask'), document.getElementById('updateMask')].forEach(function (m) { m.addEventListener('click', function (e) { if (e.target === m && m.id !== 'updateMask') hide(m); }); });

  var toastEl = document.getElementById('toast'), toastTimer = null;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800); }

  /* ══════════ 念诵音频播放器（在线流播 + 自动缓存，APK 不打包音频） ══════════ */
  // 音频文件放在自己的 Cloudflare Pages 的 /audio/ 下，文件名=经文id.mp3；manifest.json 列出哪些已就绪。
  // 上传同名 mp3 + 在 manifest 里加一行即对所有用户自动生效，用户零操作。首次在线流播，之后自动缓存离线。
  var AUDIO_BASE = 'https://diandian-f1q.pages.dev/audio/';
  var AUDIO_MANIFEST_URL = 'https://diandian-f1q.pages.dev/audio/manifest.json';
  var AUDIO_READY_FALLBACK = ['xinjing', 'jingang', 'amituo', 'pumeng', 'yaoshi', 'dabeizhou', 'baizhiming', 'liuzi', 'wenshu', 'wangsheng', 'dizangjing']; // 未取到 manifest 时的兜底（离线首启也能看到已知的几部）
  var AUDIO_READY_SET = {}; AUDIO_READY_FALLBACK.forEach(function (x) { AUDIO_READY_SET[x] = true; });
  function audioUrl(id) { return AUDIO_BASE + encodeURIComponent(id) + '.mp3'; }
  function capFS() { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) || null; }
  function importAudioMap() { return data.settings.importAudio || (data.settings.importAudio = {}); }
  function cachedAudioPath(id) { var m = S('audioCache', {}); return m && m[id] ? m[id] : null; }
  function setCachedAudioPath(id, p) { var m = S('audioCache', {}) || {}; m[id] = p; data.settings.audioCache = m; save(); }
  function isReady(id) { return !!AUDIO_READY_SET[id] || !!importAudioMap()[id]; }
  function hasAudio(id) { return isReady(id) || !!cachedAudioPath(id); }
  function audioName(id) { var s = sutraById(id); return s ? s.title : '念诵'; }
  function fmtT(sec) { if (!isFinite(sec) || sec < 0) return '0:00'; sec = Math.floor(sec); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + pad(s); }

  function loadAudioManifest() {
    if (!AUDIO_MANIFEST_URL || !window.fetch) return;
    fetch(AUDIO_MANIFEST_URL, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return;
      var set = {};
      if (Array.isArray(j)) { j.forEach(function (x) { set[String(x).replace(/\.mp3$/i, '')] = true; }); }
      else { Object.keys(j).forEach(function (k) { if (j[k]) set[String(k).replace(/\.mp3$/i, '')] = true; }); }
      AUDIO_READY_SET = set;
      try { renderShelf(); } catch (e) {}
      try { if (readPage.classList.contains('open') && currentReadId) openRead(currentReadId); } catch (e) {}
    }).catch(function () { /* 取不到就沿用兜底清单 */ });
  }

  // 解析实际播放地址：导入 > 已缓存副本 > 在线流播。cb(src, label, isRemote)
  function resolveAudioSrc(id, cb) {
    var FS = capFS();
    var imp = importAudioMap()[id];
    if (imp) {
      if (imp.dataUrl) { cb(imp.dataUrl, '我导入的音频', false); return; }
      if (FS && imp.path) { FS.getUri({ directory: FS.Directory.Data, path: imp.path }).then(function (r) { cb(window.Capacitor.convertFileSrc(r.uri), '我导入的音频', false); }).catch(function () { cb(audioUrl(id), '真人念诵', true); }); return; }
    }
    var cp = cachedAudioPath(id);
    if (FS && cp) { FS.getUri({ directory: FS.Directory.Data, path: cp }).then(function (r) { cb(window.Capacitor.convertFileSrc(r.uri), '真人念诵 · 离线', false); }).catch(function () { cb(audioUrl(id), '真人念诵', true); }); return; }
    cb(audioUrl(id), '真人念诵', true);
  }

  var elA = {
    mask: document.getElementById('playerMask'),
    title: document.getElementById('plTitle'), sub: document.getElementById('plSub'),
    seek: document.getElementById('plSeek'), cur: document.getElementById('plCur'), dur: document.getElementById('plDur'),
    play: document.getElementById('plPlay'), loop: document.getElementById('plLoop'), rate: document.getElementById('plRate'), sleep: document.getElementById('plSleep'),
    x: document.getElementById('plClose'),
    pill: document.getElementById('npPill'), npPp: document.getElementById('npPp'), npTitle: document.getElementById('npTitle'), npStat: document.getElementById('npStat'), npStop: document.getElementById('npStop')
  };
  var A = new Audio(); A.preload = 'metadata';
  var pl = { id: null, loop: S('audioLoop', false), rate: S('audioRate', 1), sleepMin: 0, sleepAt: 0, dragging: false };
  var RATES = [0.75, 1, 1.25, 1.5, 2];

  function openPlayer(id) {
    if (!id) return;
    if (pl.id === id && A.getAttribute('src')) { elA.mask.classList.add('show'); updatePill(); syncPlayUI(); return; }
    resolveAudioSrc(id, function (url, label, isRemote) {
      if (!url) { toast('这部经文暂时没有音频'); return; }
      pl.id = id; pl.dragging = false;
      A.src = url; A.loop = pl.loop; A.playbackRate = pl.rate;
      elA.title.textContent = audioName(id); elA.sub.textContent = label || '';
      elA.seek.value = 0; elA.cur.textContent = '0:00'; elA.dur.textContent = '0:00';
      if (isRemote) toast('正在加载音频…（仅首次，之后可离线）');
      var pr = A.play(); if (pr && pr.catch) pr.catch(function () {});
      elA.mask.classList.add('show'); updatePill(); syncPlayUI();
      if (isRemote) cacheRemote(id);
    });
  }
  function togglePlay() { if (!pl.id) return; if (A.paused) { var pr = A.play(); if (pr && pr.catch) pr.catch(function () {}); } else A.pause(); }
  function syncPlayUI() {
    var playing = !!pl.id && !A.paused && !A.ended;
    elA.play.textContent = playing ? '❚❚' : '▶';
    elA.npPp.textContent = playing ? '❚❚' : '▶';
    elA.npStat.textContent = playing ? '播放中' : '已暂停';
    elA.loop.textContent = pl.loop ? '单曲循环' : '不循环'; elA.loop.classList.toggle('on', pl.loop);
    elA.rate.textContent = pl.rate + 'x';
    elA.sleep.textContent = '定时：' + (pl.sleepMin ? pl.sleepMin + '分' : '关'); elA.sleep.classList.toggle('on', !!pl.sleepMin);
    // 同步所有可见的听读条上的 mini 芯片（主页 + 阅读页各一个）
    var chipsR = document.querySelectorAll('.lb-rate'); for (var i = 0; i < chipsR.length; i++) chipsR[i].textContent = pl.rate + 'x';
    var chipsL = document.querySelectorAll('.lb-loop'); for (var j = 0; j < chipsL.length; j++) { chipsL[j].textContent = pl.loop ? '↻ 循环' : '↺ 单次'; chipsL[j].classList.toggle('on', pl.loop); }
  }
  function updatePill() {
    if (!pl.id || elA.mask.classList.contains('show')) { elA.pill.style.display = 'none'; return; }
    elA.pill.style.display = 'flex'; elA.npTitle.textContent = audioName(pl.id); syncPlayUI();
  }
  function closePlayerSheet() { elA.mask.classList.remove('show'); updatePill(); }
  function stopAudio() { try { A.pause(); A.removeAttribute('src'); A.load(); } catch (e) {} pl.id = null; pl.sleepAt = 0; pl.sleepMin = 0; elA.pill.style.display = 'none'; elA.mask.classList.remove('show'); }
  function removeAudio(id) {
    var m = importAudioMap(); if (!m[id]) return;
    var p = m[id].path; delete m[id]; save();
    var FS = capFS(); if (FS && p) { try { FS.deleteFile({ path: p, directory: FS.Directory.Data }); } catch (e) {} }
    if (pl.id === id) stopAudio();
    renderShelf();
    if (readPage.classList.contains('open') && currentReadId === id) openRead(id);
    if (S('homeSutra', '') === id) renderHomeSutra();
    toast('已移除音频');
  }

  A.addEventListener('loadedmetadata', function () { elA.dur.textContent = fmtT(A.duration); });
  A.addEventListener('timeupdate', function () {
    if (pl.dragging) return;
    if (A.duration) elA.seek.value = Math.round(A.currentTime / A.duration * 1000);
    elA.cur.textContent = fmtT(A.currentTime);
    if (pl.sleepAt && Date.now() >= pl.sleepAt) { A.pause(); pl.sleepAt = 0; pl.sleepMin = 0; toast('定时到，已停止播放'); syncPlayUI(); }
  });
  A.addEventListener('ended', syncPlayUI);
  A.addEventListener('play', syncPlayUI); A.addEventListener('pause', syncPlayUI);
  A.addEventListener('error', function () {
    if (!pl.id) return;
    toast('该经文音频还没准备好，稍后再试试');
    syncPlayUI();
  });

  // ArrayBuffer → base64（分块，避免超长调用栈）
  function abToB64(buf) {
    var bytes = new Uint8Array(buf), CHUNK = 0x8000, bin = '';
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  // 首次在线播放后，后台把音频下到本地，下次可离线听。失败就静默降级为继续流播。
  function cacheRemote(id) {
    var FS = capFS(); if (!FS) return; // 只在 App（原生）里缓存，网页预览不缓存
    if (cachedAudioPath(id) || importAudioMap()[id]) return;
    if (!window.fetch) return;
    try {
      fetch(audioUrl(id)).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) {
        var fname = 'cache_' + id + '.mp3';
        return FS.writeFile({ path: fname, data: abToB64(buf), directory: FS.Directory.Data, recursive: true });
      }).then(function () {
        setCachedAudioPath(id, 'cache_' + id + '.mp3');
        if (pl.id === id) { elA.sub.textContent = '真人念诵 · 已存离线'; }
      }).catch(function () { /* 取不到就算了，在线听照样能听 */ });
    } catch (e) {}
  }

  elA.seek.addEventListener('input', function () { pl.dragging = true; if (A.duration) elA.cur.textContent = fmtT(A.duration * elA.seek.value / 1000); });
  function doSeek() { if (A.duration) { try { A.currentTime = A.duration * elA.seek.value / 1000; } catch (e) {} } pl.dragging = false; }
  elA.seek.addEventListener('change', doSeek);
  elA.seek.addEventListener('pointerup', doSeek);
  elA.play.addEventListener('click', togglePlay);
  elA.x.addEventListener('click', closePlayerSheet);
  elA.mask.addEventListener('click', function (e) { if (e.target === elA.mask) closePlayerSheet(); });
  elA.loop.addEventListener('click', function () { pl.loop = !pl.loop; A.loop = pl.loop; data.settings.audioLoop = pl.loop; save(); syncPlayUI(); });
  elA.rate.addEventListener('click', function () { var i = RATES.indexOf(pl.rate); i = (i + 1) % RATES.length; pl.rate = RATES[i]; A.playbackRate = pl.rate; data.settings.audioRate = pl.rate; save(); syncPlayUI(); });
  var SLEEPS = [0, 15, 30, 60];
  elA.sleep.addEventListener('click', function () {
    var i = SLEEPS.indexOf(pl.sleepMin); i = (i + 1) % SLEEPS.length; pl.sleepMin = SLEEPS[i];
    if (pl.sleepMin) { pl.sleepAt = Date.now() + pl.sleepMin * 60000; toast('将在 ' + pl.sleepMin + ' 分钟后自动停止'); }
    else { pl.sleepAt = 0; toast('已取消定时停止'); }
    syncPlayUI();
  });
  elA.pill.addEventListener('click', function (e) { if (e.target === elA.npPp || e.target === elA.npStop) return; openPlayer(pl.id); });
  elA.npPp.addEventListener('click', function (e) { e.stopPropagation(); togglePlay(); });
  elA.npStop.addEventListener('click', function (e) { e.stopPropagation(); stopAudio(); });

  /* ── 导入 / 更换音频 ── */
  function pickAudioFile(cb) { var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*,.mp3,.m4a,.ogg,.wav,.aac'; inp.onchange = function () { var f = inp.files && inp.files[0]; if (f) cb(f); }; inp.click(); }
  function persistAudio(id, file, done) {
    if (file.size > 260 * 1024 * 1024) { toast('音频太大（超过 260MB），先压缩一下'); if (done) done(false); return; }
    toast('正在导入音频…');
    var FS = capFS(); var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = String(reader.result || '');
      if (FS) {
        var b64 = dataUrl.split(',')[1] || '';
        var ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.mp3'])[0].toLowerCase();
        var fname = 'imp_' + id + '_' + Date.now() + ext;
        FS.writeFile({ path: fname, data: b64, directory: FS.Directory.Data, recursive: true }).then(function () {
          var old = importAudioMap()[id]; importAudioMap()[id] = { path: fname, name: file.name }; save();
          if (old && old.path && old.path !== fname) { try { FS.deleteFile({ path: old.path, directory: FS.Directory.Data }); } catch (e) {} }
          if (done) done(true);
        }).catch(function () { toast('音频保存失败'); if (done) done(false); });
      } else {
        if (dataUrl.length > 5 * 1024 * 1024) { toast('浏览器预览只支持较小音频；正式 App 无此限制'); if (done) done(false); return; }
        importAudioMap()[id] = { dataUrl: dataUrl, name: file.name }; save();
        if (done) done(true);
      }
    };
    reader.onerror = function () { toast('读取音频失败'); if (done) done(false); };
    reader.readAsDataURL(file);
  }
  function afterAudioChanged(id) {
    toast('音频已就绪');
    if (pl.id === id) stopAudio();
    renderShelf();
    if (readPage.classList.contains('open') && currentReadId === id) openRead(id);
    if (S('homeSutra', '') === id) renderHomeSutra();
  }
  function importAudioFor(id) { pickAudioFile(function (f) { persistAudio(id, f, function (ok) { if (ok) afterAudioChanged(id); }); }); }

  /* ── 阅读页顶部的“听读”条 ── */
  function buildListenBar(s) {
    var wrap = document.createElement('div'); wrap.className = 'listenbar';
    if (hasAudio(s.id)) {
      var pb = document.createElement('button'); pb.className = 'lb-play'; pb.textContent = '▶ 听读';
      pb.addEventListener('click', function () { openPlayer(s.id); }); wrap.appendChild(pb);
      var rt = document.createElement('button'); rt.className = 'lb-chip lb-rate'; rt.textContent = pl.rate + 'x';
      rt.addEventListener('click', function (e) { e.stopPropagation(); cycleRate(); }); wrap.appendChild(rt);
      var lp = document.createElement('button'); lp.className = 'lb-chip lb-loop' + (pl.loop ? ' on' : ''); lp.textContent = pl.loop ? '↻ 循环' : '↺ 单次';
      lp.addEventListener('click', function (e) { e.stopPropagation(); toggleLoop(); }); wrap.appendChild(lp);
      var mg = document.createElement('button'); mg.className = 'lb-mgmt'; mg.textContent = '换';
      mg.addEventListener('click', function () { importAudioFor(s.id); }); wrap.appendChild(mg);
      if (importAudioMap()[s.id]) { var dl = document.createElement('button'); dl.className = 'lb-del'; dl.textContent = '删'; dl.addEventListener('click', function () { askConfirm('删除这部经文导入的音频？', function () { removeAudio(s.id); }); }); wrap.appendChild(dl); }
    } else {
      var gp = document.createElement('button'); gp.className = 'lb-play ghost'; gp.textContent = '♪ 音频待补充 · 点此导入';
      gp.addEventListener('click', function () { importAudioFor(s.id); }); wrap.appendChild(gp);
    }
    return wrap;
  }
  function cycleRate() { var i = RATES.indexOf(pl.rate); i = (i + 1) % RATES.length; pl.rate = RATES[i]; A.playbackRate = pl.rate; data.settings.audioRate = pl.rate; save(); syncPlayUI(); }
  function toggleLoop() { pl.loop = !pl.loop; A.loop = pl.loop; data.settings.audioLoop = pl.loop; save(); syncPlayUI(); }
  window.__audio = {
    open: openPlayer, has: hasAudio, importFor: importAudioFor,
    state: function () { return { id: pl.id, playing: !!pl.id && !A.paused, loop: pl.loop, rate: pl.rate, sleep: pl.sleepMin, dur: A.duration, cur: A.currentTime, sheetOpen: elA.mask.classList.contains('show'), pillShown: elA.pill.style.display !== 'none' }; }
  };

  /* ══════════ 安卓返回键：逐层退回，不直接退出 ══════════ */
  // 返回 true = 已消费这次返回（退了一层）；false = 已在最外层，该退出了
  function closeTopLayer() {
    var masks = document.querySelectorAll('.mask.show');
    if (masks.length) { var top = masks[masks.length - 1]; if (top === elA.mask) { closePlayerSheet(); } else { top.classList.remove('show'); } return true; }
    if (zenPage.classList.contains('open')) { zenPage.classList.remove('open'); return true; }
    var pages = document.querySelectorAll('.page.open');
    if (pages.length) { var pg = pages[pages.length - 1]; pg.classList.remove('open'); if (pg.id === 'detailPage') currentDetail = null; return true; }
    var active = document.querySelector('nav button.on');
    if (active && active.dataset.tab !== 'tabHome') { var hb = document.querySelector('nav button[data-tab="tabHome"]'); if (hb) hb.click(); return true; }
    return false;
  }
  var lastBackTs = 0;
  function handleBack() {
    if (closeTopLayer()) { lastBackTs = 0; return true; }
    var now = Date.now();
    if (now - lastBackTs < 2500) { lastBackTs = 0; return false; } // 连按两次才退出
    lastBackTs = now; toast('再按一次退出点点计数'); return true;
  }
  window.__handleBack = handleBack; // 供自检调用
  var CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (CapApp) { try { CapApp.addListener('backButton', function () { if (!handleBack()) { try { CapApp.exitApp(); } catch (e) {} } }); } catch (e) {} }

  /* ── 首次启动 ── */
  if (!data.counters.length && !S('seeded', false)) {
    data.counters.push({ id: 'c_default', name: '念经', days: {} });
    data.settings.homeCounter = 'c_default';
    data.settings.homeSutra = 'xinjing';
    data.settings.seeded = true;
    if (data.settings.sound === undefined) data.settings.sound = true;
    if (data.settings.fontScale === undefined) data.settings.fontScale = 1;
    save();
  }

  renderHomeSutra(); renderRail(); renderCountTab();
  try { loadAudioManifest(); } catch (e) {}

  // 首次进入弹「关于与声明」；已勾选"不再提示"则跳过
  if (!S('aboutSeen', false)) {
    setTimeout(function () { openAbout(); }, 500);
  } else {
    // 启动后延迟自动检查一次更新（每天最多提示一次同版本）
    setTimeout(function () { checkUpdate(false); }, 1500);
  }
})();
