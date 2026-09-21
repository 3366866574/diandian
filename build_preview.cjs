// Build single-file preview: inline sutras.js, sutra_pinyin.js, app.js into index.html
const fs = require('fs');
const path = require('path');
const WWW = path.join(__dirname, 'www');
const OUT = path.join(__dirname, '..', 'outputs', '点点计数_网页预览.html');

let html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const order = ['sutras.js', 'sutra_pinyin.js', 'app.js'];
order.forEach(f => {
  const code = fs.readFileSync(path.join(WWW, f), 'utf8');
  const tag = new RegExp('<script\\s+src="' + f + '"></script>');
  if (!tag.test(html)) { console.error('MISSING tag for ' + f); process.exit(1); }
  html = html.replace(tag, '<script>\n' + code + '\n</script>');
});
// inline QR image as data URI so the single-file preview is self-contained
const qrPath = path.join(WWW, 'img', 'wechat-qr.jpg');
if (fs.existsSync(qrPath)) {
  const b64 = fs.readFileSync(qrPath).toString('base64');
  html = html.replace(/src="img\/wechat-qr\.jpg"/g, 'src="data:image/jpeg;base64,' + b64 + '"');
}
fs.writeFileSync(OUT, html, 'utf8');
console.log('preview written', OUT, Buffer.byteLength(html), 'bytes');
