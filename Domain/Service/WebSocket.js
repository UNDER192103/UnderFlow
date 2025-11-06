const ReconnectingWebSocket = require('reconnecting-websocket');
const WebSocket = require('ws');

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.onOpen = null;
        this.onClose = null;
        this.onError = null;
    }

    connect() {
        this.ws = new ReconnectingWebSocket(process.env.WS_URL, [], { WebSocket: WebSocket });

        this.ws.addEventListener('open', () => {
            if (this.onOpen) {
                this.onOpen();
            }
        });

        this.ws.addEventListener('close', () => {
            if (this.onClose) {
                this.onClose();
            }
        });

        this.ws.addEventListener('error', (error) => {
            if (this.onError) {
                this.onError(error);
            }
        });
    }

    send(data) {
        if (this.ws && this.ws.readyState === ReconnectingWebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

module.exports = WebSocketManager;
