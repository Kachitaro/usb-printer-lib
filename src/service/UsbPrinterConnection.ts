// file: connection/UsbPrinterConnection.ts
// import { formatPrinterText } from "../formatPrinterText"; // Không dùng ở đây
import { USBConnectionEvent, USBDevice } from "../types";

export class UsbPrinterConnection {
  private static instance: UsbPrinterConnection | null = null;
  private interfaceNumber: number | null = null;
  private device: USBDevice | null = null;
  private endpointOut: number | null = null;
  private connected = false;

  private readonly vendorId: number;
  private readonly productId: number;

  constructor(vendorId: number, productId: number) {
    this.vendorId = vendorId;
    this.productId = productId;

    // Thiết lập sự kiện ngắt kết nối
    (navigator as any)?.usb?.addEventListener(
      "disconnect",
      (event: USBConnectionEvent) => {
        if (this.device && event.device.productId === this.device.productId) {
          console.log("Máy in USB đã bị ngắt kết nối.");
          this.device = null;
          this.connected = false;
        }
      }
    );

    // Thiết lập sự kiện cắm lại
    (navigator as any)?.usb?.addEventListener(
      "connect",
      (event: USBConnectionEvent) => {
        if (
          event.device.vendorId === this.vendorId &&
          event.device.productId === this.productId
        ) {
          console.log("Máy in USB đã được cắm lại, tự động kết nối...");
          this.setupDevice(event.device).catch(console.error);
        }
      }
    );
  }

  static getInstance(vendorId: number, productId: number): UsbPrinterConnection {
    if (!UsbPrinterConnection.instance) {
      UsbPrinterConnection.instance = new UsbPrinterConnection(
        vendorId,
        productId
      );
      UsbPrinterConnection.instance.autoConnect();
    }
    return UsbPrinterConnection.instance;
  }

  private async autoConnect(): Promise<void> {
    try {
      const devices = await (navigator as any).usb.getDevices();
      const device = devices.find(
        (d: { vendorId: number; productId: number }) =>
          d.vendorId === this.vendorId && d.productId === this.productId
      );

      if (device) {
        await this.setupDevice(device);
        console.log("Đã tự động kết nối lại máy in USB:", device.productName);
      } else {
        console.log(
          "Chưa có quyền truy cập máy in USB. Cần user gesture để cấp quyền."
        );
      }
    } catch (err) {
      console.warn("Lỗi khi auto-connect máy in USB:", (err as Error).message);
    }
  }

  // Phương thức yêu cầu quyền (public)
  async requestPermission(): Promise<void> {
    try {
      const device = await (navigator as any).usb.requestDevice({
        filters: [{ vendorId: this.vendorId, productId: this.productId }],
      });
      await this.setupDevice(device);
      console.log("Đã cấp quyền và kết nối máy in USB:", device.productName);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("No device selected")) {
        console.log("Người dùng huỷ cấp quyền thiết bị USB.");
      } else {
        console.error("Không thể kết nối máy in USB:", err);
        throw new Error("Không thể kết nối máy in USB: " + message);
      }
    }
  }

  // Logic thiết lập thiết bị USB
  private async setupDevice(device: USBDevice): Promise<void> {
    await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    const configuration = (device as any).configuration;
    if (!configuration) {
      throw new Error("Không tìm thấy configuration của thiết bị USB.");
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

  // Phương thức gửi dữ liệu thô (Raw data)
  async transferOut(data: Uint8Array | string): Promise<void> {
    if (!this.device || this.endpointOut == null) {
      throw new Error("⚠️ Chưa kết nối máy in USB.");
    }

    const buffer =
      data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    const safeView =
      buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength
        ? buffer
        : buffer.slice();

    const arrayBufferToSend = safeView.buffer as ArrayBuffer;

    await this.device.transferOut(this.endpointOut, arrayBufferToSend);
  }

  isConnected(): boolean {
    return this.connected;
  }
}