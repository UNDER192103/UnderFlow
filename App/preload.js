const { contextBridge, ipcRenderer } = require('electron');

// Expõe um objeto 'electronAPI' para as janelas de renderização (ui.js e audio.js)
contextBridge.exposeInMainWorld('electronAPI', {
    // --- Funções que a UI (ui.js) pode chamar ---
    startStream: () => ipcRenderer.send('start-stream'),
    isStream: () => ipcRenderer.send('is-stream'),
    stopStream: () => ipcRenderer.send('stop-stream'),
    setVolume: (volume) => ipcRenderer.send('set-volume', volume),
    setSetting: (key, value) => ipcRenderer.send('set-setting', key, value),
    getSettings: () => ipcRenderer.send('get-settings'),
    getConnectionStatus: () => ipcRenderer.send('get-connection-status'),
    restartApp: () => ipcRenderer.send('restart-app'),

    // --- Funções que o processo de ÁUDIO (audio.js) pode chamar ---
    sendAudioData: (data) => ipcRenderer.send('send-audio-data', data),
    sendStatusUpdate: (status) => ipcRenderer.send('status-update', status),
    sendConnectionStatus: (message) => ipcRenderer.send('connection-status-update', message),
    sendVisualizerData: (data) => ipcRenderer.send('visualizer-data', data),

    // --- Funções que recebem eventos do processo principal ---
    // Para a UI (ui.js)
    onVisualizerData: (callback) => ipcRenderer.on('visualizer-data', callback),
    onStatusUpdate: (callback) => ipcRenderer.on('status-update', callback),
    onConnectionStatusUpdate: (callback) => ipcRenderer.on('connection-status-update', callback),
    onSettingsLoaded: (callback) => ipcRenderer.on('settings-loaded', callback),

    // Para o Áudio (audio.js)
    onStartStream: (callback) => ipcRenderer.on('start-stream', callback),
    onisListening: (callback) => ipcRenderer.on('is-stream', callback),
    onStopStream: (callback) => ipcRenderer.on('stop-stream', callback),
    onSetVolume: (callback) => ipcRenderer.on('set-volume', callback),
    onSetToken: (callback) => ipcRenderer.on('set-token', callback),
    onAutoStart: (callback) => ipcRenderer.on('autostart-check', callback),
    onWsReady: (callback) => ipcRenderer.on('ws-ready', callback),
});
