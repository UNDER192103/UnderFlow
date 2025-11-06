const { app, BrowserWindow, ipcMain, session, desktopCapturer, Tray, Menu } = require('electron');
const AutoLaunch = require('auto-launch');
const path = require('path');
const Store = require('electron-store');
const store = new Store.default();
const WebSocketManager = require('../Domain/Service/WebSocket');
const { autoUpdater } = require("electron-updater");
var autoLaunch = new AutoLaunch({ name: app.getName(), path: app.getPath('exe') });
autoLaunch.isEnabled().then(isEnabled => {
    if (!isEnabled) {
        if (store.get('autoStartWindows', false)) autoLaunch.enable(); else autoLaunch.disable();
    }
    else {
        if (store.get('autoStartWindows', false)) autoLaunch.enable();
    }
});

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let mainWindow;
let backgroundWindow;
let wsManager; // Instância do WebSocketManager
let APP_ICON;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 750,
        frame: true,
        title: app.getName(),
        autoHideMenuBar: true,
        icon: path.join(app.getAppPath(), 'Domain', 'src', 'img', 'UFx256.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'Domain', 'View', 'index.html'));

    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (backgroundWindow) {
            backgroundWindow.close();
        }
        // Fecha a conexão WebSocket quando a janela principal é fechada
        if (wsManager) {
            wsManager.close();
        }
    });

    APP_ICON.on('double-click', function (e) {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.maximize();
        }
    });

    mainWindow.on('minimize', function (event) {
        event.preventDefault();
        mainWindow.hide();
    });
}

function createBackgroundWindow() {
    backgroundWindow = new BrowserWindow({
        show: false, // Janela invisível
        webPreferences: {
            preload: path.join(__dirname, 'background-preload.js'), // Usar o preload específico do background
            contextIsolation: false,
            nodeIntegration: true,
            backgroundThrottling: false
        }
    });

    backgroundWindow.loadFile(path.join(__dirname, '..', 'Domain', 'View', 'background.html'));

    // backgroundWindow.webContents.openDevTools({ mode: 'detach' });

    backgroundWindow.on('closed', () => {
        backgroundWindow = null;
    });
}

function setupWebSocket() {
    wsManager = new WebSocketManager();

    // Configura os callbacks do WebSocket
    wsManager.onOpen = () => {
        console.log('WebSocket Conectado!');
        if (mainWindow) mainWindow.webContents.send('connection-status-update', 'Conectado');
        // Envia o comando para o processo de áudio começar a enviar dados
        if (backgroundWindow) backgroundWindow.webContents.send('ws-ready');
        wsManager.send(JSON.stringify({ type: 'token', token: store.get('token') }));
    };

    wsManager.onMessage = (data) => {
        if (data === 'token') {
            wsManager.send(JSON.stringify({ type: 'token', token: store.get('token') }));
        }
    }

    wsManager.onClose = () => {
        console.log('WebSocket Desconectado!');
        if (mainWindow) mainWindow.webContents.send('connection-status-update', 'Desconectado');
    };

    wsManager.onError = (error) => {
        console.error('Erro no WebSocket:', error);
        if (mainWindow) mainWindow.webContents.send('status-update', { message: 'Erro de conexão', isStreaming: false, type: 'error' });
    };

    // Inicia a conexão
    wsManager.connect();
}

app.whenReady().then(async () => {
    const isRunning = app.requestSingleInstanceLock();
    if (!isRunning) {
        return app.quit();
    }

    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen'] });
            if (sources.length === 0) {
                return callback({ video: null, audio: 'none' });
            }
            callback({ video: sources[0], audio: 'loopback' });
        } catch (e) {
            console.error('Failed to get capture sources:', e);
            callback({ video: null, audio: 'none' });
        }
    });
    APP_ICON = new Tray(path.join(app.getAppPath(), 'Domain', 'src', 'img', 'UFx256.ico'));

    setContextMenu();
    createMainWindow();
    createBackgroundWindow();
    setupWebSocket(); // Configura e inicia o WebSocket
    startAllServicesAutoUpdater();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
            createBackgroundWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC (Comunicação entre processos) ---

// UI -> Main -> Audio Process
ipcMain.on('is-stream', () => {
    backgroundWindow.webContents.send('is-stream');
});

ipcMain.on('start-stream', () => {
    // Apenas inicia o stream se o WebSocket estiver pronto
    if (wsManager && wsManager.ws && wsManager.ws.readyState === wsManager.ws.OPEN) {
        if (backgroundWindow) backgroundWindow.webContents.send('start-stream');
    } else {
        // Informa a UI que não pode iniciar sem conexão
        if (mainWindow) mainWindow.webContents.send('status-update', { message: 'Aguardando conexão WebSocket...', isStreaming: false, type: 'info' });
    }
});

ipcMain.on('stop-stream', () => {
    if (backgroundWindow) backgroundWindow.webContents.send('stop-stream');
});

ipcMain.on('set-volume', (event, volume) => {
    store.set('volume', volume); // Salva o volume no store
    if (backgroundWindow) backgroundWindow.webContents.send('set-volume', volume);
});

// Audio Process -> Main (Para enviar dados de áudio)
ipcMain.on('send-audio-data', (event, data) => {
    if (wsManager) {
        wsManager.send(data);
    }
});

// UI -> Main (Para salvar configurações)
ipcMain.on('set-setting', (event, key, value) => {
    store.set(key, value);
    // Se o token for atualizado, envie para a janela de áudio imediatamente
    if (key === 'token' && backgroundWindow) {
        if (wsManager.ws.readyState === wsManager.ws.OPEN) {
            wsManager.send(JSON.stringify({ type: 'token', token: value }));
        }
        backgroundWindow.webContents.send('set-token', value);
    }
});

// UI -> Main (Para carregar configurações)
ipcMain.on('get-settings', (event) => {
    const settings = {
        token: store.get('token'),
        volume: store.get('volume', 100),
        autoStartWindows: store.get('autoStartWindows', false),
        autoStartStream: store.get('autoStartStream', false)
    };
    // Envia as configurações para a UI
    if (mainWindow) mainWindow.webContents.send('settings-loaded', settings);
    // Envia as configurações para o processo de áudio para auto-start
    if (backgroundWindow) backgroundWindow.webContents.send('autostart-check', settings);
});

// UI -> Main (Para obter o status da conexão ao carregar)
ipcMain.on('get-connection-status', (event) => {
    let statusMessage = 'Desconectado';
    if (wsManager && wsManager.ws) {
        switch (wsManager.ws.readyState) {
            case wsManager.ws.OPEN:
                statusMessage = 'Conectado';
                break;
            case wsManager.ws.CONNECTING:
                statusMessage = 'Conectando...';
                break;
            default:
                statusMessage = 'Desconectado';
                break;
        }
    }
    // Envia o status apenas para a janela que solicitou
    event.sender.send('connection-status-update', statusMessage);
});

// Main -> UI (Para reiniciar o app)
ipcMain.on('restart-app', () => {
    app.relaunch();
    app.quit();
});

// Audio Process -> Main -> UI
ipcMain.on('status-update', (event, status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('status-update', status);
    }
});

ipcMain.on('visualizer-data', (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('visualizer-data', data);
    }
});

function setContextMenu() {
    var contextMenu = Menu.buildFromTemplate([
        {
            label: app.getName(), type: 'normal', click: () => {
                mainWindow.show();
                mainWindow.maximize();
            }
        },
        { type: 'separator' },
        {
            label: "Reiniciar Aplicativo", type: 'normal', click: () => {
                app.relaunch();
                app.exit();
            }
        },
        {
            label: "Atualizar Tela", type: 'normal', click: () => {
                mainWindow.show();
                mainWindow.maximize();
                mainWindow.reload();
            }
        },
        {
            label: "Sair", type: 'normal', click: async () => {
                app.quit();
            }
        }
    ]);

    APP_ICON.setToolTip(app.getName());
    APP_ICON.setContextMenu(contextMenu);
}

function startAllServicesAutoUpdater() {
    ///////   Updater   ///////

    autoUpdater.on("update-available", (info) => {

    });

    autoUpdater.on('download-progress', (info) => {

    });

    autoUpdater.on("update-downloaded", (event, releaseNotes, releaseName) => {
        setTimeout(() => {
            mainWindow.close();
            backgroundWindow.close();
            app.quit();
            autoUpdater.quitAndInstall(false, true);
        }, 5000);
    });

    autoUpdater.on("update-not-available", (info) => { ///Not update

    });

    autoUpdater.on("error", async info => { ///Error

    });

    try {
        autoUpdater.checkForUpdates();
    } catch (error) {
        console.log(error);
    }
    ///////   Updater   ///////
}
