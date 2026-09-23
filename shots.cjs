// 给博客/公众号抓 App 截图
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, '..', 'outputs', 'blog-images'); fs.mkdirSync(OUT, { recursive: true });
const DEPLOY_AUDIO = path.join(__dirname, '..', 'outputs', 'diandian-deploy', 'audio');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  await page.route('https://diandian-f1q.pages.dev/version.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: '1.5.3' }) }));
  await page.route('https://diandian-f1q.pages.dev/audio/**', (r) => {
    const u = r.request().url();
    if (/manifest\.json$/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(DEPLOY_AUDIO, 'manifest.json'), 'utf8') });
    const m = u.match(/\/audio\/([^\/]+)\.mp3$/);
    const f = m && path.join(DEPLOY_AUDIO, m[1] + '.mp3');
    if (f && fs.existsSync(f)) return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: fs.readFileSync(f) });
    return r.fulfill({ status: 404, body: 'not found' });
  });

  await page.goto('http://127.0.0.1:8791/index.html');
  await page.evaluate(() => {
    const today = new Date(); const ymd = (o) => { const d = new Date(today); d.setDate(d.getDate() - o); return d.toISOString().slice(0, 10); };
    const mkDays = (n, base) => { const d = {}; for (let i = 0; i < 14; i++) { d[ymd(i)] = Math.max(0, base + Math.round(Math.sin(i / 2) * base * 0.4)); } return d; };
    localStorage.setItem('diandian_v3', JSON.stringify({
      counters: [
        { id: 'c1', name: '心经', days: mkDays(7, 21) },
        { id: 'c2', name: '大悲咒', days: mkDays(7, 7) },
        { id: 'c3', name: '六字大明咒', days: mkDays(7, 108) }
      ],
      custom: [],
      settings: { homeSutra: 'xinjing', homeCounter: 'c1', pinyin: true, sound: true, fontScale: 1, seeded: true, aboutSeen: true, theme: 'light' }
    }));
  });
  await page.reload(); await page.waitForTimeout(600);
  // 关掉任何可能弹出的模态（更新提示 / 关于弹窗）
  await page.evaluate(() => { document.querySelectorAll('.mask.show, #aboutMask.show, #updateMask.show').forEach(function (m) { m.classList.remove('show'); }); });
  await page.waitForTimeout(200);

  // 1. 主页（含听读条 ▶ + 倍速 + 循环 chip）
  await page.screenshot({ path: path.join(OUT, '01-home.png'), fullPage: true });

  // 2. 计数 tab
  await page.locator('nav button[data-tab="tabCount"]').click(); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '02-count.png'), fullPage: true });

  // 3. 书架（♪ 有声 徽标）
  await page.locator('nav button[data-tab="tabShelf"]').click(); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '03-shelf.png'), fullPage: true });

  // 4. 阅读页 · 心经
  await page.locator('.book .bt', { hasText: '心经' }).first().click(); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '04-read.png') });

  // 5. 播放弹层 —— 在读书页里点 ▶ 听读，等一会
  await page.locator('#readPage .listenbar .lb-play').first().click();
  await page.waitForTimeout(3500); // 等 audio 加载 metadata 显示时长
  await page.screenshot({ path: path.join(OUT, '05-player.png') });

  // 关闭播放器 + 阅读页
  await page.evaluate(() => { const x = document.getElementById('plClose'); if (x) x.click(); });
  await page.evaluate(() => { const b = document.getElementById('btnReadBack'); if (b) b.click(); });
  await page.waitForTimeout(400);

  // 6. 大字禅定页
  await page.locator('nav button[data-tab="tabHome"]').click(); await page.waitForTimeout(300);
  await page.evaluate(() => { const b = document.getElementById('railZen'); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '06-zen.png') });
  await page.evaluate(() => { const b = document.getElementById('zenExit'); if (b) b.click(); });
  await page.waitForTimeout(300);

  // 7. 设置（亮色）
  await page.locator('nav button[data-tab="tabSettings"]').click(); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '07-settings.png'), fullPage: true });

  // 8. 切夜间模式 → 回阅读页
  await page.evaluate(() => {
    var rows = document.querySelectorAll('#tabSettings .set-row, #tabSettings .row, #tabSettings [class*="sw"]');
    // 简单方法：直接改数据 + applyTheme
    var d = JSON.parse(localStorage.getItem('diandian_v3')); d.settings.theme = 'dark';
    localStorage.setItem('diandian_v3', JSON.stringify(d));
  });
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => { document.querySelectorAll('.mask.show').forEach(function (m) { m.classList.remove('show'); }); });
  await page.waitForTimeout(200);
  await page.locator('nav button[data-tab="tabShelf"]').click(); await page.waitForTimeout(300);
  await page.locator('.book .bt', { hasText: '心经' }).first().click(); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '08-night.png') });

  await browser.close();
  console.log('DONE → ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
