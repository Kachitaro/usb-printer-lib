export interface UsbPrinterOptions {
  vendorId: number;
  productId: number;
}


declare interface USBConnectionEvent extends Event {
  readonly device: USBDevice;
}

export interface USBEndpoint {
  readonly endpointNumber: number;
  readonly direction: "in" | "out";
  readonly type?: string;
}

export interface USBAlternateInterface {
  readonly interfaceClass: number;
  readonly interfaceSubclass: number;
  readonly interfaceProtocol: number;
  readonly endpoints: USBEndpoint[];
}

export interface USBInterface {
  readonly interfaceNumber: number;
  readonly alternates: USBAlternateInterface[];
  readonly claimed?: boolean;
}

export interface USBDevice extends EventTarget {
  readonly productId: number;
  readonly vendorId: number;
  readonly productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  reset(): Promise<void>;
  configuration: RTCConfiguration | null;
  interfaces: USBInterface[];
}

/**
 * Minimal WebUSB types to satisfy transfer result typing.
 * These match the shape used by the WebUSB API: status and optional bytesWritten.
 */
export type USBTransferStatus = "ok" | "stall" | "babble" | "error";

export interface USBOutTransferResult {
  readonly status: USBTransferStatus;
  readonly bytesWritten?: number;
}