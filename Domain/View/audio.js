// e:\Apps\RadioWeb\Domain\View\audio.js

let localStream;
let audioContext;
let analyser;
let source; // MediaStreamAudioSourceNode
let gainNode; // Para controle de volume
let dataArray;
let isStreaming = false;
let token = '';
let volume = 100;
let audioWorkletNode;

// --- Funções de Controle do Stream ---

async function start() {
    if (isStreaming) return;
    console.log('Iniciando captura de áudio...');

    try {
        // 1. Obter stream de áudio do microfone padrão
        // A UI já enviou o 'start-stream' para o main, que repassou para cá.
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        // 2. Configurar o AudioContext e nós de processamento
        const desiredSampleRate = 44100;
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: desiredSampleRate }); // Ordem do rendere.js

        // Load the AudioWorklet processor
        const path = require('path');
        await audioContext.audioWorklet.addModule(path.join(__dirname, '..', 'Service', 'audio-processor.js'));

        // Nós de áudio (seguindo a ordem do rendere.js)
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        gainNode = audioContext.createGain();
        setVolume(volume); // Define o volume inicial

        source = audioContext.createMediaStreamSource(localStream); // Criar a fonte depois dos outros nós
        audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-data-processor');

        // Evento para receber dados do worklet e enviar para o main process
        audioWorkletNode.port.onmessage = (event) => {
            // O Worklet envia um Float32Array. O main process espera um Buffer.
            // O Float32Array.buffer é um ArrayBuffer, que pode ser convertido para Buffer.
            window.electronAPI.sendAudioData(Buffer.from(event.data));
        };

        // Conectar os nós: source -> gain (volume) -> analyser (visualizador) -> worklet (processamento) -> destination (saída)
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioWorkletNode);
        audioWorkletNode.connect(audioContext.destination); // Conectar ao destino para manter o grafo de áudio ativo

        isStreaming = true;
        updateStatus('Transmitindo...', false);

        // Inicia o envio de dados para o visualizador em um intervalo fixo
        startVisualizerLoop();

    } catch (err) {
        console.error('Erro ao iniciar a captura:', err);
        updateStatus(`Erro: ${err.message}`, true);
    }
}

async function isListening() {
    if (isStreaming) {
        updateStatus('Transmitindo...', false);
    } else {
        updateStatus('Erro ao iniciar a captura:', true);
    }
}

function stop() {
    if (!isStreaming) return;
    // Para o loop do visualizador
    stopVisualizerLoop();
    console.log('Parando captura de áudio...');

    // Parar trilhas de mídia
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // Desconectar nós para liberar recursos
    if (source) source.disconnect();
    if (gainNode) gainNode.disconnect();
    if (analyser) analyser.disconnect();
    if (audioWorkletNode) audioWorkletNode.disconnect();

    // Fechar AudioContext
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }

    localStream = null;
    audioContext = null;
    source = null;
    gainNode = null;
    analyser = null;
    audioWorkletNode = null;
    isStreaming = false;
    updateStatus('Aguardando...', false);
}

// --- Funções Auxiliares ---

function setVolume(newVolume) {
    volume = newVolume;
    if (gainNode) {
        // O valor de gain é um multiplicador (0 a 2), então dividimos por 100.
        gainNode.gain.value = volume / 100;
    }
}

function updateStatus(message, isError = false) {
    // A flag isStreaming deve ser atualizada antes de enviar o status
    window.electronAPI.sendStatusUpdate({ message, isStreaming, type: isError ? 'error' : 'info' });
}

let visualizerInterval = null;

// Inicia o loop de envio de dados do visualizador
function startVisualizerLoop() {
    // Para qualquer loop anterior para evitar múltiplos intervalos
    if (visualizerInterval) clearInterval(visualizerInterval);

    // Envia dados ~60 vezes por segundo (1000ms / 60fps ≈ 16.7ms)
    visualizerInterval = setInterval(() => {
        if (!isStreaming || !analyser) return;
        // Usando getByteFrequencyData para a visualização de barras de frequência
        analyser.getByteFrequencyData(dataArray);
        window.electronAPI.sendVisualizerData(dataArray);
    }, 1000 / 60);
}

// Para o loop do visualizador
function stopVisualizerLoop() {
    if (visualizerInterval) clearInterval(visualizerInterval);
    visualizerInterval = null;
}

// --- Listeners para eventos vindos do processo principal ---

// O start só deve ser chamado quando o main.js enviar o 'start-stream'
window.electronAPI.onStartStream(start);

// Para o stream
window.electronAPI.onStopStream(stop);

window.electronAPI.onisListening(isListening);

// Define o volume
window.electronAPI.onSetVolume((_event, vol) => {
    setVolume(vol);
});

// Define o token para a conexão
window.electronAPI.onSetToken((_event, newToken) => {
    token = newToken;
});

// Inicia automaticamente se configurado
window.electronAPI.onAutoStart((_event, settings) => {
    token = settings.token;
    setVolume(settings.volume);
    // A chamada para start() foi removida daqui, pois agora depende do onWsReady
    // para garantir que o WebSocket esteja conectado antes de iniciar o stream.
});

// Listener para iniciar o stream quando o WebSocket estiver pronto (se o autostart estiver ativo)
window.electronAPI.onWsReady(() => {
    // Verifica se o autostart está ativo (a lógica de autostart está no main.js)
    // Se o main.js enviou 'ws-ready', significa que a UI já enviou 'start-stream'
    // e o main.js liberou o início.
    // Portanto, o 'start' já está ligado ao 'onStartStream'.
    // Não é necessário chamar 'start()' diretamente aqui.
});
