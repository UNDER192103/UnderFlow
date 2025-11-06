const { ipcRenderer } = require('electron');

// Como nodeIntegration está ativado e contextIsolation desativado na backgroundWindow,
// podemos anexar diretamente ao objeto 'window'.
// Isso é mais simples que o contextBridge e funciona nesse ambiente específico.

window.electronAPI = {
    // --- Funções que o processo de ÁUDIO (audio.js) pode chamar ---
    sendAudioData: (data) => ipcRenderer.send('send-audio-data', data),
    sendStatusUpdate: (status) => ipcRenderer.send('status-update', status),
    sendConnectionStatus: (message) => ipcRenderer.send('connection-status-update', message),
    sendVisualizerData: (data) => ipcRenderer.send('visualizer-data', data),

    // --- Funções que recebem eventos do processo principal ---
    // Para o Áudio (audio.js)
    onStartStream: (callback) => ipcRenderer.on('start-stream', callback),
    onisListening: (callback) => ipcRenderer.on('is-stream', callback),
    onStopStream: (callback) => ipcRenderer.on('stop-stream', callback),
    onSetVolume: (callback) => ipcRenderer.on('set-volume', callback),
    onSetToken: (callback) => ipcRenderer.on('set-token', callback),
    onAutoStart: (callback) => ipcRenderer.on('autostart-check', callback),
    onWsReady: (callback) => ipcRenderer.on('ws-ready', callback),

    // Funções não usadas pelo audio.js, mas mantidas para consistência caso necessário.
    // Se não forem usadas, podem ser removidas.
    startStream: () => {},
    stopStream: () => {},
    setVolume: () => {},
    setSetting: () => {},
    getSettings: () => {},
    restartApp: () => {},
};