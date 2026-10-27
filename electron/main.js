// Electron main process: โหลดหน้า frontend (HTML/CSS/JS) ใน exe โดยไม่ต้องรัน Express
// ใช้ custom protocol app://sroi/ เพื่อให้ path แบบ "/css/..." และ ES Modules ทำงานได้เหมือนบนเว็บเซิร์ฟเวอร์
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// dev: ../frontend  |  packaged: <resources>/frontend (คัดลอกด้วย extraResources ใน package.json)
const FRONTEND = app.isPackaged
  ? path.join(process.resourcesPath, 'frontend')
  : path.join(__dirname, '..', 'frontend');
const PUBLIC_DIR = path.join(FRONTEND, 'public');
const ICON = path.join(__dirname, 'build', 'icon.ico'); // optional
const INDEX_HTML = path.join(FRONTEND, 'views', 'index.html');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname);

    // หน้าเดียว (SPA): "/" ส่ง views/index.html เหมือน routes/indexRoutes.js
    const send = (f) => net.fetch(pathToFileURL(f).toString()).catch(() => new Response('Not found', { status: 404 }));
    if (rel === '/' || rel === '') return send(INDEX_HTML);

    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    // กัน path traversal ออกนอก public/
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
    return send(file);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'SROI Analytics',
    ...(fs.existsSync(ICON) && { icon: ICON }),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL('app://sroi/');

  // ลิงก์ภายนอกเปิดในเบราว์เซอร์ปกติ ไม่เปิดในหน้าต่างแอป
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerAppProtocol();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
