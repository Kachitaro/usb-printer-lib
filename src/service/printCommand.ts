import { formatPrinterText } from "../formatPrinterText";
import { BasePrinterConnection } from "../types";
import { UsbPrinterConnection } from "./UsbPrinterConnection";
import { WebSocketPrinterConnection } from "./webSocketPrinterConnection";


export const textToUint8Array = (text: string): Uint8Array => {
    const encoder = new TextEncoder();
    return encoder.encode(text);
};


export class PrinterCommand {
  private connection: BasePrinterConnection;

  constructor(connection: BasePrinterConnection) {
    this.connection = connection;
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  async printRaw(data: Uint8Array | string): Promise<void> {
    if (typeof data === 'string') {
        data = textToUint8Array(data);
    }

    if (this.connection instanceof UsbPrinterConnection) {
        await this.connection.transferOut(data);
    } else if (this.connection instanceof WebSocketPrinterConnection) {
        if (data instanceof Uint8Array) {
            await this.connection.transferOut(data);
        } else {
            throw new Error("Dữ liệu gửi qua WebSocket phải là Uint8Array.");
        }
    } else {
        throw new Error("Lớp kết nối không hợp lệ.");
    }
  }

  async feed(lines: number = 5): Promise<void> {
    // ESC d n: [0x1b, 0x64, n]
    await this.printRaw(new Uint8Array([0x1b, 0x64, lines]));
  }

  async cut(): Promise<void> {
    // GS V 0: [0x1d, 0x56, 0x00]
    await this.printRaw(new Uint8Array([0x1d, 0x56, 0x00]));
  }

  // In format text 
  async printText(text: string): Promise<void> {
    const data = formatPrinterText(text); 
    await this.printRaw(data);
    await this.feed();
    await this.cut();
  }

  // In PDF (Placeholder)
  async printPdf(): Promise<void> {
    console.warn("Chức năng in PDF chưa được cài đặt.");
    // TODO: Implement PDF printing logic if needed
  }
}