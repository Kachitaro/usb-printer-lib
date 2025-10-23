import { formatPrinterText } from "../formatPrinterText";
import { BasePrinterConnection } from "../types";

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

  async setPrinterCodePage(command?: number | Uint8Array): Promise<void> {
    let finalCommand = new Uint8Array([0x1C, 0x26, 0x1C, 0x43, 0xFF]);;

    if (command instanceof Uint8Array) {
      // This is often required for complex Vietnamese character sets on Sunmi devices.
      finalCommand = new Uint8Array([0x1C, 0x26, 0x1C, 0x43, 0xFF]);
    }
    else if (typeof command == 'number'){
      // Standard ESC/POS Code Page Command:
      // 1. ESC t n (0x1B 0x74 n) - Select Code Page
      const setCodePageCmd = new Uint8Array([0x1B, 0x74, command]);
      // 2. ESC R n (0x1B 0x52 n) - Select International Character Set (Often combined)
      const setCharSetCmd = new Uint8Array([0x1B, 0x52, command]);

      finalCommand = new Uint8Array([...setCodePageCmd, ...setCharSetCmd]);
    } 
    
    console.log(`Sending standard ESC/POS Code Page command: ${finalCommand}.`);
    await this.connection.transferOut(finalCommand);
  }

  async printRaw(data: Uint8Array | string): Promise<void> {
    if (typeof data === "string") data = textToUint8Array(data);
    await this.connection.transferOut(data);
  }

  async feed(lines: number = 5): Promise<void> {
    // ESC d n: [0x1b, 0x64, n]
    await this.printRaw(new Uint8Array([0x1b, 0x64, lines]));
  }

  async cut(): Promise<void> {
    // GS V 0: [0x1d, 0x56, 0x00]
    await this.printRaw(new Uint8Array([0x1d, 0x56, 0x00]));
  }

  async printText(text: string): Promise<void> {
    const data = formatPrinterText(text);
    await this.printRaw(data);
    await this.feed();
    await this.cut();
  }

  async printPdf(): Promise<void> {
    console.warn("Chức năng in PDF chưa được cài đặt.");
    // TODO: Implement PDF printing logic if needed
  }
}
