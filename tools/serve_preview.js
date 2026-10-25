/* Local preview server; node tools/serve_preview.js [port]. No dependencies. */
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
function createServer() {
  return http.createServer((req, res) => {
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
    catch { res.writeHead(400); res.end(); return; }
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (file === root || fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
    });
  });
}
if (require.main === module) {
  const port = Number(process.argv[2]) || 8788;
  createServer().listen(port, '127.0.0.1', () => console.log(`Hedge Hotpot: http://127.0.0.1:${port}/dist/hedge-hotpot-preview.html`));
}
module.exports = { createServer };
