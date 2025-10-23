// file: connection/WebSocketPrinterConnection.ts

export class WebSocketPrinterConnection {
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  // Kết nối đến WebSocket server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return resolve();
      }

      this.ws = new WebSocket(this.url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        console.log("WebSocket connected successfully.");
        resolve();
      };

      this.ws.onerror = (error: Event) => {
        console.error("WebSocket Error:", error);
        this.ws = null;
        reject(new Error("WebSocket connection error."));
      };

      this.ws.onclose = () => {
        console.log("WebSocket closed.");
        this.ws = null;
      };
      
      this.ws.onmessage = (event: MessageEvent) => {
        console.log('Server message received:', event.data);
      };
    });
  }

  // Ngắt kết nối WebSocket
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  // Phương thức gửi dữ liệu thô (Raw data) qua WebSocket
  transferOut(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("⚠️ WebSocket connection is not open."));
      }

      try {
        // Gửi ArrayBuffer từ Uint8Array
        this.ws.send(data.buffer);
        resolve();
      } catch (error: any) {
        reject(new Error("Failed to send data via WebSocket: " + error.message));
      }
    });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN ;
  }
}