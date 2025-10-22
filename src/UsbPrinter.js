// ID của máy in
const TARGET_VENDOR_ID = 8137;
const TARGET_PRODUCT_ID = 8214;

class UsbPrinter {
    static instance = null;

    static getInstance() {
        if (!UsbPrinter.instance) {
            UsbPrinter.instance = new UsbPrinter();
            UsbPrinter.instance.autoConnect();
        }
        return UsbPrinter.instance;
    }

    constructor() {
        this.device = null;
        this.interfaceNumber = null;
        this.endpointOut = null;
        this.connected = false;

        navigator.usb.addEventListener("disconnect", (event) => {
            if (this.device && event.device.productId === this.device.productId) {
                console.log("🔌 Máy in đã bị ngắt kết nối.");
                this.device = null;
                this.connected = false;
            }
        });

        navigator.usb.addEventListener("connect", (event) => {
            if (
                event.device.vendorId === TARGET_VENDOR_ID &&
                event.device.productId === TARGET_PRODUCT_ID
            ) {
                console.log("🔗 Máy in đã được cắm lại, tự động kết nối...");
                this.setupDevice(event.device);
            }
        });
    }

    async autoConnect() {
        try {
            const devices = await navigator.usb.getDevices();
            const device = devices.find(
                (d) =>
                    d.vendorId === TARGET_VENDOR_ID &&
                    d.productId === TARGET_PRODUCT_ID
            );

            if (device) {
                await this.setupDevice(device);
                console.log("✅ Đã tự động kết nối lại máy in:", device.productName);
            } else {
                console.log(
                    "Chưa có quyền truy cập máy in. Cần user gesture để cấp quyền."
                );
            }
        } catch (err) {
            console.warn("⚠️ Lỗi khi auto-connect máy in:", err.message);
        }
    }

    async requestPermission() {
        try {
            const device = await navigator.usb.requestDevice({
                filters: [{ vendorId: TARGET_VENDOR_ID, productId: TARGET_PRODUCT_ID }],
            });
            await this.setupDevice(device);
            localStorage.setItem("printerAllowed", "true");
            console.log("✅ Đã cấp quyền và kết nối máy in:", device.productName);
        } catch (err) {
            if (err.message.includes("No device selected")) {
                console.log("❎ Người dùng huỷ cấp quyền thiết bị.");
            } else {
                console.error("❌ Không thể kết nối máy in:", err);
            }
        }
    }

    async setupDevice(device) {
        await device.open();
        if (!device.configuration) await device.selectConfiguration(1);
        const iface = device.configuration.interfaces.find((i) =>
            i.alternates[0].endpoints.some((e) => e.direction === "out")
        );
        await device.claimInterface(iface.interfaceNumber);
        this.device = device;
        this.interfaceNumber = iface.interfaceNumber;
        this.endpointOut = iface.alternates[0].endpoints.find(
            (e) => e.direction === "out"
        ).endpointNumber;
        this.connected = true;
    }

    async printRaw(data) {
        if (!this.device) throw new Error("⚠️ Chưa kết nối máy in.");
        if (!(data instanceof Uint8Array)) data = new TextEncoder().encode(data);
        await this.device.transferOut(this.endpointOut, data);
    }

    async printText(text) {
        const encoder = new TextEncoder();
        const ESC = "\x1b";
        const reset = `${ESC}@`;
        const cmd = encoder.encode(reset + text + "\n");
        await this.printRaw(cmd);
        await this.feed();
        await this.cut();
    }

    async feed(lines = 5) {
        await this.printRaw(new Uint8Array([0x1b, 0x64, lines]));
    }

    async cut() {
        await this.printRaw(new Uint8Array([0x1d, 0x56, 0x00]));
    }

    async printPdf() { }
}

export default UsbPrinter;
