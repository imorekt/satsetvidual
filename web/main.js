const { app, BrowserWindow, Menu, ipcMain, Tray } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Konfigurasi logger untuk auto-updater
log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.autoDownload = false; // Kita akan memanggil downloadUpdate() secara manual dari UI


// Mencegah sniffing jaringan (opsional, dihapus sementara untuk debug proxy)
// app.commandLine.appendSwitch('no-proxy-server');

let mainWindow;
let nextProcess;
let pumpfunProcess;
let nextLogs = '';
let tray = null;
let isQuitting = false;

// getAvailablePort dihapus karena kita butuh port statis agar localStorage (sesi login) tidak hilang

async function startPumpfunServer() {
  const isDev = !app.isPackaged;
  if (isDev) return;

  const pumpfunDir = path.join(process.resourcesPath, 'pumpfun-agent');
  const serverPath = path.join(pumpfunDir, 'dist', 'index.js');
  const fs = require('fs');

  if (fs.existsSync(serverPath)) {
    try {
      pumpfunProcess = spawn(process.execPath, [serverPath], {
        cwd: pumpfunDir,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          PORT: '3005',
          DRY_RUN_MODE: 'true',
          IS_ELECTRON: 'true'
        }
      });
      pumpfunProcess.stdout.on('data', (data) => {
        log.info(`PumpFun: ${data}`);
      });
      pumpfunProcess.stderr.on('data', (data) => {
        log.error(`PumpFun error: ${data}`);
      });
      pumpfunProcess.on('exit', (code) => {
        log.info(`PumpFun process exited with code ${code}`);
      });
      log.info('Pumpfun Engine process spawned on port 3005');
    } catch (err) {
      log.error('Failed to spawn Pumpfun Engine:', err);
    }
  }
}

async function startNextServer(port) {
  const isDev = !app.isPackaged;
  let targetPort = port;
  
  if (isDev) {
    targetPort = 3000;
  } else {
    const standaloneDir = path.join(process.resourcesPath, 'standalone');
    const serverPath = path.join(standaloneDir, 'server.js');
    nextProcess = spawn(process.execPath, [serverPath], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: targetPort.toString(),
        HOSTNAME: '127.0.0.1',
        NEXT_TELEMETRY_DISABLED: '1',
        IS_ELECTRON: 'true'
      }
    });
    nextProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log(`Next.js: ${text}`);
      nextLogs += text + '\\n';
    });
    nextProcess.stderr.on('data', (data) => {
      const text = data.toString();
      console.error(`Next.js error: ${text}`);
      nextLogs += `ERROR: ${text}\\n`;
    });
    nextProcess.on('exit', (code) => {
      nextLogs += `PROCESS EXITED WITH CODE: ${code}\\n`;
    });
  }
  
  let isReady = false;
  let attempts = 0;
  while (!isReady && attempts < 200) { // 1200 attempts * 100ms = 20 seconds
    try {
      await new Promise((resolve, reject) => {
        // Ping a static file so Next.js doesn't waste time SSR-ing the root page for the health check
        const req = http.get(`http://127.0.0.1:${targetPort}/next.svg`, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 500) resolve();
          else reject(new Error('Server not ready'));
        });
        req.on('error', reject);
      });
      isReady = true;
      console.log(`Next.js server is ready on port ${targetPort}`);
    } catch (e) {
      attempts++;
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  if (!isReady) {
    console.error('Failed to start Next.js server after 20 seconds');
  }
  
  return targetPort;
}

async function createWindow() {
  // 1. Tampilkan Splash Screen terlebih dahulu
  let splashWindow = new BrowserWindow({
    width: 800,
    height: 450,
    icon: path.join(__dirname, 'icon.png'),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  splashWindow.loadFile(path.join(__dirname, 'splash.html'), { hash: app.getVersion() });
  const splashStartTime = Date.now();

  // 2. Siapkan Server Next.js & PumpFun Engine di background
  await startPumpfunServer();
  const actualPort = await startNextServer(39142);

  // 3. Buat Main Window tapi jangan ditampilkan dulu
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.png'),
    show: false, // Disembunyikan dulu
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const MINIMUM_SPLASH_TIME = 4000; // Tampilkan minimal 4 detik agar loading bar mencapai 100%

  let isMainShown = false;

  const showMain = () => {
    if (isMainShown) return;
    isMainShown = true;
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
  };

  // 4. Setelah Main Window merender kerangka halaman (DOM ready)
  mainWindow.webContents.once('dom-ready', () => {
    const timeElapsed = Date.now() - splashStartTime;
    const remainingTime = Math.max(0, MINIMUM_SPLASH_TIME - timeElapsed);
    setTimeout(showMain, remainingTime);
  });

  // Safety fallback: if ready-to-show doesn't fire within 15 seconds, force show
  setTimeout(showMain, 15000);

  mainWindow.loadURL(`http://127.0.0.1:${actualPort}`).catch(err => {
    console.error('Failed to load mainWindow:', err);
    showMain();
    // mainWindow.webContents.openDevTools();
    
    // Tampilkan error ke layar
    const errorHtml = `
      <div style="color: red; padding: 20px; font-family: monospace; font-size: 14px; background: #111; height: 100vh; overflow-y: auto;">
        <h2>Failed to load URL</h2>
        <p><strong>Error:</strong> ${err.message}</p>
        <h3>Next.js Server Logs:</h3>
        <pre style="white-space: pre-wrap; color: #0f0;">${nextLogs.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </div>
    `;
    mainWindow.webContents.executeJavaScript(`document.body.innerHTML = \`${errorHtml}\`;`);
  });
  
  // Nonaktifkan klik kanan (Context Menu / Inspect Element)
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // Hapus semua menu atas
  Menu.setApplicationMenu(null);

  // Cegah aplikasi tertutup saat di-close, sembunyikan ke System Tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Setup IPC untuk Auto-Updater
  ipcMain.on('start-update', () => {
    log.info('Memulai download update...');
    autoUpdater.downloadUpdate();
  });

  ipcMain.on('install-update', () => {
    log.info('Mulai install update...');
    autoUpdater.quitAndInstall();
  });

  // Forward event dari autoUpdater ke renderer (web)
  autoUpdater.on('update-available', (info) => {
    log.info('Update tersedia.');
    if (mainWindow) mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);
    if (mainWindow) mainWindow.webContents.send('update-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update selesai didownload.');
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
    if (mainWindow) mainWindow.webContents.send('update-error', err.message);
  });

  // Cek update otomatis saat aplikasi berjalan
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(err => {
      log.error('Gagal mengecek update: ' + err);
    });
  }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Jika user mencoba membuka aplikasi ke-2, fokuskan aplikasi yang sudah terbuka
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    
    // Buat System Tray
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Buka SATSET Vidual', click: () => { if (mainWindow) mainWindow.show(); } },
      { type: 'separator' },
      { 
        label: 'Tutup Sepenuhnya (Matikan Bot)', 
        click: () => {
          isQuitting = true;
          app.quit();
        } 
      }
    ]);
    
    tray.setToolTip('SATSET Vidual (Berjalan di latar belakang)');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
        }
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    // Biarkan kosong agar tidak otomatis tertutup saat window di-close (X)
  });

  app.on('before-quit', () => {
    if (nextProcess) {
      try { nextProcess.kill(); } catch (e) {}
    }
    if (pumpfunProcess) {
      try { pumpfunProcess.kill(); } catch (e) {}
    }
  });
}
