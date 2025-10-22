import { USBConnectionEvent, USBDevice } from "./types";

export class UsbPrinterProvider {
  private static instance: UsbPrinterProvider | null = null;
  private interfaceNumber: number | null = null;
  private device: USBDevice | null = null;
  private endpointOut: number | null = null;
  private connected = false;

  private readonly vendorId: number;
  private readonly productId: number;

  constructor(vendorId: number, productId: number) {
    this.vendorId = vendorId;
    this.productId = productId;

    (navigator as any).usb.addEventListener("disconnect", (event: USBConnectionEvent) => {
      if (this.device && event.device.productId === this.device.productId) {
        console.log("Máy in đã bị ngắt kết nối.");
        this.device = null;
        this.connected = false;
      }
    });

    (navigator as any).usb.addEventListener("connect", (event: USBConnectionEvent) => {
      if (
        event.device.vendorId === this.vendorId &&
        event.device.productId === this.productId
      ) {
        console.log("Máy in đã được cắm lại, tự động kết nối...");
        this.setupDevice(event.device).catch(console.error);
      }
    });
  }

  static getInstance(vendorId: number, productId: number): UsbPrinterProvider {
    if (!UsbPrinterProvider.instance) {
      UsbPrinterProvider.instance = new UsbPrinterProvider(vendorId, productId);
      UsbPrinterProvider.instance.autoConnect();
    }
    return UsbPrinterProvider.instance;
  }

  private async autoConnect(): Promise<void> {
    try {
      const devices = await (navigator as any).usb.getDevices();
      const device = devices.find(
        (d: { vendorId: number; productId: number; }) => d.vendorId === this.vendorId && d.productId === this.productId
      );

      if (device) {
        await this.setupDevice(device);
        console.log("Đã tự động kết nối lại máy in:", device.productName);
      } else {
        console.log("Chưa có quyền truy cập máy in. Cần user gesture để cấp quyền.");
      }
    } catch (err) {
      console.warn("Lỗi khi auto-connect máy in:", (err as Error).message);
    }
  }

  async requestPermission(): Promise<void> {
    try {
      const device = await (navigator as any).usb.requestDevice({
        filters: [{ vendorId: this.vendorId, productId: this.productId }],
      });
      await this.setupDevice(device);
      localStorage.setItem("printerAllowed", "true");
      console.log("Đã cấp quyền và kết nối máy in:", device.productName);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("No device selected")) {
        console.log("Người dùng huỷ cấp quyền thiết bị.");
      } else {
        console.error("Không thể kết nối máy in:", err);
      }
    }
  }

  private async setupDevice(device: USBDevice): Promise<void> {
    await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    const configuration = (device as any).configuration;
    if (!configuration) {
      throw new Error("Không tìm thấy configuration của thiết bị.");
    }

    const iface = (configuration as any).interfaces.find((i: any) =>
      i.alternates[0].endpoints.some((e: any) => e.direction === "out")
    );

    if (!iface) throw new Error("Không tìm thấy interface có endpoint OUT.");

    await device.claimInterface(iface.interfaceNumber);

    const endpointOut = iface.alternates[0].endpoints.find(
      (e: any) => e.direction === "out"
    );

    if (!endpointOut) throw new Error("Không tìm thấy endpoint OUT.");

    this.device = device;
    this.interfaceNumber = iface.interfaceNumber;
    this.endpointOut = endpointOut.endpointNumber;
    this.connected = true;
  }

  async printRaw(data: Uint8Array | string): Promise<void> {
    if (!this.device || this.endpointOut == null) {
      throw new Error("⚠️ Chưa kết nối máy in.");
    }

    const buffer = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    const safeView =
      buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength
        ? buffer
        : buffer.slice();

    const arrayBufferToSend = safeView.buffer as ArrayBuffer;

    await this.device.transferOut(this.endpointOut, arrayBufferToSend);
  }

  async printText(text: string): Promise<void> {
    const encoder = new TextEncoder();
    const ESC = "\x1b";
    const reset = `${ESC}@`;
    const cmd = encoder.encode(reset + text + "\n");
    await this.printRaw(cmd);
    await this.feed();
    await this.cut();
  }

  async feed(lines = 5): Promise<void> {
    await this.printRaw(new Uint8Array([0x1b, 0x64, lines]));
  }

  async cut(): Promise<void> {
    await this.printRaw(new Uint8Array([0x1d, 0x56, 0x00]));
  }

  async printPdf(): Promise<void> {
    // TODO: Implement PDF printing logic if needed
  }

  isConnected(): boolean {
    return this.connected;
  }
}
