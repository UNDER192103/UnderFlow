// e:\Apps\RadioWeb\Domain\View\ui.js

// Elementos da UI
const tokenInput = document.getElementById('tokenInput');
const toggleTokenVisibility = document.getElementById('toggleTokenVisibility');
const saveTokenButton = document.getElementById('saveTokenButton');
const volumeControl = document.getElementById('volumeControl');
const volumeValue = document.getElementById('volumeValue');
const autoStartWindows = document.getElementById('autoStartWindows');
const autoStartStream = document.getElementById('autoStartStream');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const restartButton = document.getElementById('restartButton');
const toggleVisualizer = document.getElementById('toggleVisualizer');
const statusDiv = document.getElementById('status');
const connectionStatusDiv = document.getElementById('connectionStatus');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

// --- Configuração Inicial e Carregamento de Preferências ---
document.addEventListener('DOMContentLoaded', () => {
    // Solicita as configurações salvas ao processo principal do Electron
    window.electronAPI.getSettings();
    window.electronAPI.getConnectionStatus(); // Solicita o status da conexão ao carregar
    resizeCanvas();
});

window.addEventListener('resize', resizeCanvas);

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

// --- Funções de Desenho do Visualizador ---
function drawVisualizer(dataArray) {
    // dataArray here is frequency data (getByteFrequencyData)
    if (canvas.style.display === 'none') return;

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    canvasCtx.fillStyle = '#2c2c2c'; // Cor de fundo escura do visualizador
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // O dataArray que chega do audio.js é o `analyser.frequencyBinCount`
    const bufferLength = dataArray.length;
    const barWidth = (WIDTH / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];
        const colorValue = Math.min(255, barHeight + 100); // Aumenta o brilho
        canvasCtx.fillStyle = `rgb(0, ${colorValue}, 255)`;
        canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
    }

    startButton.disabled = true;
    stopButton.disabled = false;

    statusDiv.style.backgroundColor = '#343a40';
    statusDiv.style.color = '#adb5bd';
    statusDiv.textContent = 'Transmitindo...';
}

// --- Event Listeners da UI ---

// Botões de controle do stream
startButton.addEventListener('click', () => {
    // Envia o comando para o processo principal iniciar o stream
    window.electronAPI.startStream();
});

stopButton.addEventListener('click', () => {
    // Envia o comando para o processo principal parar o stream
    window.electronAPI.stopStream();
});

restartButton.addEventListener('click', () => {
    window.electronAPI.restartApp();
});

// Controle de Volume
volumeControl.addEventListener('input', () => {
    const volume = parseInt(volumeControl.value, 10);
    volumeValue.textContent = `${volume}%`;
    // Envia o volume para o processo principal salvar e para o processo de áudio
    window.electronAPI.setVolume(volume);
});

// Salvar Token
saveTokenButton.addEventListener('click', () => {
    // Envia o token para o processo principal salvar
    window.electronAPI.setSetting('token', tokenInput.value);
    alert('Token salvo!');
});

// Visibilidade do Token
toggleTokenVisibility.addEventListener('click', () => {
    const isPassword = tokenInput.type === 'password';
    tokenInput.type = isPassword ? 'text' : 'password';
    toggleTokenVisibility.textContent = isPassword ? '🙈' : '👁️';
});

// Toggle do Visualizador
toggleVisualizer.addEventListener('click', () => {
    const isHidden = canvas.style.display === 'none';
    canvas.style.display = isHidden ? 'block' : 'none';
    toggleVisualizer.textContent = isHidden ? 'Ocultar Visualizador' : 'Mostrar Visualizador';
    if (isHidden) {
        resizeCanvas();
    }
});

// Toggles de inicialização
autoStartWindows.addEventListener('change', () => {
    // Envia o estado para o processo principal salvar
    window.electronAPI.setSetting('autoStartWindows', autoStartWindows.checked);
});

autoStartStream.addEventListener('change', () => {
    // Envia o estado para o processo principal salvar
    window.electronAPI.setSetting('autoStartStream', autoStartStream.checked);
});


// --- Listeners para eventos vindos do processo de áudio/principal ---

// Recebe dados para o visualizador
window.electronAPI.onVisualizerData((_event, dataArray) => {
    // O dataArray é um Uint8Array, que pode ser usado diretamente
    drawVisualizer(dataArray);
});

// Atualiza o status da UI
window.electronAPI.onStatusUpdate((_event, status) => {
    statusDiv.textContent = status.message;
    if (status.type === 'error') {
        statusDiv.style.backgroundColor = '#dc3545'; // Vermelho para erro
        statusDiv.style.color = '#fff';
    } else {
        statusDiv.style.backgroundColor = '#343a40';
        statusDiv.style.color = '#adb5bd';
    }

    // Habilita/desabilita botões
    startButton.disabled = status.isStreaming;
    stopButton.disabled = !status.isStreaming;
});

// Atualiza o status da conexão
window.electronAPI.onConnectionStatusUpdate((_event, message) => {
    connectionStatusDiv.textContent = message;
});

// Recebe as configurações iniciais e atualiza a UI
window.electronAPI.onSettingsLoaded((_event, settings) => {
    if (settings.token) {
        tokenInput.value = settings.token;
    }
    if (settings.volume) {
        volumeControl.value = settings.volume;
        volumeValue.textContent = `${settings.volume}%`;
    }
    if (settings.autoStartWindows) {
        autoStartWindows.checked = settings.autoStartWindows;
    }
    if (settings.autoStartStream) {
        autoStartStream.checked = settings.autoStartStream;
        // Se autoStartStream estiver ativado, iniciar o stream automaticamente
        window.electronAPI.startStream();
    }
});
