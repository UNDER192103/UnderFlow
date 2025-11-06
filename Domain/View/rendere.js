document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const restartButton = document.getElementById('restartButton');
    const tokenInput = document.getElementById('tokenInput');
    const visualizerCanvas = document.getElementById('visualizer');
    const toggleVisualizerButton = document.getElementById('toggleVisualizer');
    const volumeControl = document.getElementById('volumeControl');
    const volumeValueSpan = document.getElementById('volumeValue');
    const saveTokenButton = document.getElementById('saveTokenButton');
    const toggleTokenVisibility = document.getElementById('toggleTokenVisibility');
    const autoStartWindows = document.getElementById('autoStartWindows');
    const autoStartStream = document.getElementById('autoStartStream');
    const statusDiv = document.getElementById('status');

    const canvasCtx = visualizerCanvas.getContext('2d');
    let WIDTH = visualizerCanvas.width;
    let HEIGHT = visualizerCanvas.height;



    let sourceStream = null;
    let isVisualizerVisible = true; // Estado inicial do visualizador
    let audioContext = null;
    let audioWorkletNode = null; // New variable for AudioWorkletNode
    let analyser = null;
    let gainNode = null; // Adicionado para controle de volume
    let dataArray = null; // Adicionado para o visualizador
    let animationFrameId = null;

    async function startStreaming() {
        const token = tokenInput.value.trim();
        if (!token) {
            statusDiv.textContent = 'Erro: Por favor, insira o Token de Acesso.';
            return;
        }

        // O token agora é salvo pelo botão dedicado, mas garantimos que está no localStorage antes de iniciar
        const savedToken = localStorage.getItem('underflowToken');
        if (token !== savedToken) {
            statusDiv.textContent = 'Erro: Token não salvo. Por favor, clique em "Salvar" primeiro.';
            return;
        }

        try {
            // Passa o token para o processo principal (a implementação no main.js deve ser ajustada para receber o token)
            window.api.startStreaming(token);
            const audioStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            sourceStream = audioStream;

            const desiredSampleRate = 44100;
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: desiredSampleRate }); // Corrected typo here

            // Load the AudioWorklet processor
            const path = require('path');
            const audioProcessorPath = path.join(__dirname, '..', 'Service', 'audio-processor.js');
            await audioContext.audioWorklet.addModule(audioProcessorPath);

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength); // Usa a variável de escopo superior

            gainNode = audioContext.createGain();
            gainNode.gain.value = volumeControl.value / 100; // Define o volume inicial

            const source = audioContext.createMediaStreamSource(audioStream);
            audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-data-processor');

            audioWorkletNode.port.onmessage = (event) => {
                // event.data will be the ArrayBuffer from the AudioWorkletProcessor
                // console.log('Renderer: Received audio data from AudioWorklet (ArrayBuffer length):', event.data.byteLength);
                window.api.sendAudioData(Buffer.from(event.data));
            };

            // Conexões para o visualizador e controle de volume
            source.connect(gainNode); // Conecta a fonte ao GainNode
            gainNode.connect(analyser); // Conecta o GainNode ao Analyser
            analyser.connect(audioWorkletNode); // Conecta o Analyser ao Worklet
            audioWorkletNode.connect(audioContext.destination); // Connect to destination to keep it alive

            drawVisualizer(); // Inicia o visualizador
        } catch (error) {
            console.error('Error starting streaming:', error);
            statusDiv.textContent = `Error starting streaming: ${error.message}`;
            stopStreaming();
        }
    }

    function stopStreaming() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (gainNode) {
            gainNode.disconnect();
            gainNode = null;
        }
        if (analyser) {
            analyser.disconnect();
            analyser = null;
        }
        if (audioWorkletNode) {
            audioWorkletNode.disconnect();
            audioWorkletNode = null;
        }
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        if (sourceStream) {
            sourceStream.getTracks().forEach(track => track.stop());
            sourceStream = null;
        }
        window.api.stopStreaming();
    }

    startButton.addEventListener('click', startStreaming);
    stopButton.addEventListener('click', stopStreaming);
    restartButton.addEventListener('click', restartStreaming);
    toggleVisualizerButton.addEventListener('click', toggleVisualizer);

    volumeControl.addEventListener('input', () => {
        const volume = volumeControl.value;
        volumeValueSpan.textContent = `${volume}%`;
        localStorage.setItem('underflowVolume', volume); // Salva o volume no localStorage
        if (gainNode) {
            // O valor do gainNode é linear, onde 1.0 é 100%
            gainNode.gain.value = volume / 100;
        }
    });

    // Lógica do botão Salvar Token
    saveTokenButton.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
            localStorage.setItem('underflowToken', token);
            statusDiv.textContent = 'Token de Acesso salvo com sucesso!';
        } else {
            statusDiv.textContent = 'Erro: O campo Token de Acesso não pode estar vazio.';
        }
    });

    // Lógica do toggle de visibilidade do Token
    toggleTokenVisibility.addEventListener('click', () => {
        if (tokenInput.type === 'password') {
            tokenInput.type = 'text';
            toggleTokenVisibility.textContent = '🙈'; // Ícone de olho fechado
        } else {
            tokenInput.type = 'password';
            toggleTokenVisibility.textContent = '👁️'; // Ícone de olho aberto
        }
    });

    // Lógica de persistência dos toggles
    autoStartWindows.addEventListener('change', () => {
        localStorage.setItem('autoStartWindows', autoStartWindows.checked);
        // TODO: Enviar evento para o processo principal para configurar o registro no Windows
        window.api.setAutoStartWindows(autoStartWindows.checked);
    });

    autoStartStream.addEventListener('change', () => {
        localStorage.setItem('autoStartStream', autoStartStream.checked);
    });

    // Função para carregar configurações salvas
    function loadSettings() {
        // Carregar Token
        const savedToken = localStorage.getItem('underflowToken');
        if (savedToken) {
            tokenInput.value = savedToken;
        }

        // Carregar Volume
        const savedVolume = localStorage.getItem('underflowVolume');
        if (savedVolume !== null) {
            volumeControl.value = savedVolume;
            volumeValueSpan.textContent = `${savedVolume}%`;
        }

        // Carregar Toggles
        const savedAutoStartWindows = localStorage.getItem('autoStartWindows') === 'true';
        autoStartWindows.checked = savedAutoStartWindows;

        const savedAutoStartStream = localStorage.getItem('autoStartStream') === 'true';
        autoStartStream.checked = savedAutoStartStream;

        // Iniciar transmissão automaticamente se a opção estiver marcada
        if (savedAutoStartStream && savedToken) {
            startStreaming();
        }
    }

    // Carregar configurações ao iniciar
    loadSettings();

    // Lógica para garantir que o volume seja exibido corretamente ao carregar
    volumeValueSpan.textContent = `${volumeControl.value}%`;
    window.api.onStatusUpdate((message) => {
      statusDiv.textContent = message;
    });

    window.api.onStreamingStarted(() => {
      startButton.disabled = true;
      stopButton.disabled = false;
      statusDiv.textContent = 'Streaming...';
      drawVisualizer(); // Garante que o visualizador comece a desenhar se estiver visível
    });

    window.api.onStreamingStopped(() => {
      startButton.disabled = false;
      stopButton.disabled = true;
      statusDiv.textContent = 'Stopped';
    });

    // Lógica para garantir que o volume seja exibido corretamente ao carregar
    volumeValueSpan.textContent = `${volumeControl.value}%`;

    function restartStreaming() {
        statusDiv.textContent = 'Reiniciando Audio Streamer...';
        stopStreaming();
        // Pequeno delay para garantir que o stop seja processado antes de iniciar
        setTimeout(startStreaming, 1000); 
    }

    function toggleVisualizer() {
        isVisualizerVisible = !isVisualizerVisible;
        visualizerCanvas.style.display = isVisualizerVisible ? 'block' : 'none';
        toggleVisualizerButton.textContent = isVisualizerVisible ? 'Ocultar Visualizador' : 'Mostrar Visualizador';
        if (isVisualizerVisible && analyser) {
            drawVisualizer();
        } else if (!isVisualizerVisible && animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function drawVisualizer() {
        if (!isVisualizerVisible || !analyser || !dataArray) {
            return;
        }

        // Analyser.getByteTimeDomainData(dataArray) é para o osciloscópio (onda)
        // Analyser.getByteFrequencyData(dataArray) é para o analisador de espectro (barras)
        // Vou usar o de frequência para um visual mais dinâmico (barras)
        // Atualiza a largura e altura do canvas para garantir que ele ocupe 100% do container
        WIDTH = visualizerCanvas.clientWidth;
        HEIGHT = visualizerCanvas.clientHeight;
        visualizerCanvas.width = WIDTH;
        visualizerCanvas.height = HEIGHT;

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = '#2c2c2c'; // Cor de fundo escura do visualizador
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / analyser.frequencyBinCount) * 2.5;
        let barHeight;
        let x = 0;

        for(let i = 0; i < analyser.frequencyBinCount; i++) {
            barHeight = dataArray[i];

            // Cor das barras (tom de azul para combinar com o tema escuro)
            const colorValue = Math.min(255, barHeight + 100);
            canvasCtx.fillStyle = `rgb(0, ${colorValue}, 255)`;
            canvasCtx.fillRect(x, HEIGHT - barHeight/2, barWidth, barHeight/2);

            x += barWidth + 1;
        }

        animationFrameId = requestAnimationFrame(drawVisualizer);
    }
});