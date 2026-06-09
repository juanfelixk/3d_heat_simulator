export class SolverSocket {
    private ws: WebSocket;
    onmessage: ((e: { data: unknown }) => void) | null = null;

    constructor(url = "ws://localhost:8765") {
        this.ws = new WebSocket(url);
        this.ws.onmessage = (e) => {
            if (!this.onmessage) return;
            this.onmessage({ data: JSON.parse(e.data as string) });
        };
    }

    // _transfer ignored — only needed for SharedArrayBuffer optimisation in Workers
    postMessage(data: unknown, _transfer?: unknown): void {
        const send = () => this.ws.send(JSON.stringify(data));
        if (this.ws.readyState === WebSocket.OPEN) {
            send();
        } else {
            this.ws.addEventListener("open", send, { once: true });
        }
    }

    terminate(): void {
        this.ws.close();
    }
}