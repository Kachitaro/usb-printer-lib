import React, { useState, useEffect } from "react";
import { Usb, Power, Wifi, AlertCircle, Check } from "lucide-react";

export default function WebUSBDemo() {
    const [supported, setSupported] = useState(false);
    const [device, setDevice] = useState(null);
    const [devices, setDevices] = useState([]);
    const [status, setStatus] = useState("");
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [error, setError] = useState("");
    const [transferData, setTransferData] = useState("");
    const [receiveData, setReceiveData] = useState("");

    useEffect(() => {
        if ("usb" in navigator) {
            setSupported(true);
            loadDevices();

            navigator.usb.addEventListener("connect", handleConnect);
            navigator.usb.addEventListener("disconnect", handleDisconnect);

            return () => {
                navigator.usb.removeEventListener("connect", handleConnect);
                navigator.usb.removeEventListener("disconnect", handleDisconnect);
            };
        }
    }, []);

    const loadDevices = async () => {
        try {
            const devicesList = await navigator.usb.getDevices();
            setDevices(devicesList);
        } catch (err) {
            setError(`Failed to load devices: ${err.message}`);
        }
    };

    const handleConnect = (e) => {
        setStatus(`Device connected: ${e.device.productName || "Unknown"}`);
        loadDevices();
    };

    const handleDisconnect = (e) => {
        setStatus(`Device disconnected: ${e.device.productName || "Unknown"}`);
        if (device && device === e.device) {
            setDevice(null);
            setDeviceInfo(null);
        }
        loadDevices();
    };

    const requestDevice = async () => {
        try {
            setError("");
            setStatus("Requesting device...");
            const selectedDevice = await navigator.usb.requestDevice({ filters: [] });
            setDevice(selectedDevice);
            setStatus("Device selected! Opening...");

            await selectedDevice.open();
            setStatus("Device opened!");

            const info = {
                productName: selectedDevice.productName,
                manufacturerName: selectedDevice.manufacturerName,
                serialNumber: selectedDevice.serialNumber,
                vendorId: `0x${selectedDevice.vendorId.toString(16).padStart(4, "0")}`,
                productId: `0x${selectedDevice.productId.toString(16).padStart(4, "0")}`,
                deviceClass: selectedDevice.deviceClass,
                deviceSubclass: selectedDevice.deviceSubclass,
                deviceProtocol: selectedDevice.deviceProtocol,
                configurations: selectedDevice.configurations.length,
            };

            setDeviceInfo(info);
            loadDevices();
        } catch (err) {
            setError(`Error: ${err.message}`);
            setStatus("Failed to connect");
        }
    };

    const prepareDevice = async () => {
        if (!device) throw new Error("No device connected");

        if (!device.opened) await device.open();
        if (!device.configuration) await device.selectConfiguration(1);

        const iface = device.configuration.interfaces.find((i) =>
            i.alternates[0].endpoints.some((e) => e.direction === "out")
        );

        if (!iface) throw new Error("No OUT interface found");

        const interfaceNumber = iface.interfaceNumber;

        try {
            await device.claimInterface(interfaceNumber);
        } catch (e) {
            console.warn("Interface already claimed or cannot claim:", e);
        }

        const outEndpoint = iface.alternates[0].endpoints.find(
            (e) => e.direction === "out"
        );

        if (!outEndpoint) throw new Error("No OUT endpoint found");

        return { interfaceNumber, outEndpointNumber: outEndpoint.endpointNumber };
    };

    const sendData = async () => {
        if (!device || !transferData) {
            setError("No device or data to send");
            return;
        }

        try {
            setStatus("Preparing device...");
            const { outEndpointNumber } = await prepareDevice();

            const encoder = new TextEncoder();
            const data = encoder.encode(transferData);

            setStatus(`Sending ${data.length} bytes...`);
            const result = await device.transferOut(outEndpointNumber, data);
            setStatus(`✅ Sent ${result.bytesWritten} bytes`);
        } catch (err) {
            setError(`Transfer error: ${err.message}`);
        }
    };

    const printReceipt = async () => {
        try {
            const { outEndpointNumber } = await prepareDevice();

            const encoder = new TextEncoder();
            const ESC = "\x1B";
            const data = encoder.encode(
                ESC +
                "@Hello from WebUSB Printer!\n\nThank you!\n\n" +
                ESC +
                "d" +
                "\x02" +
                ESC +
                "m"
            );

            const result = await device.transferOut(outEndpointNumber, data);
            setStatus(`✅ Printed receipt (${result.bytesWritten} bytes)`);
        } catch (err) {
            setError(`Print error: ${err.message}`);
        }
    };

    const closeDevice = async () => {
        if (device && device.opened) {
            await device.close();
            setStatus("Device closed");
        }
    };

    // === UI ===
    if (!supported) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-red-200">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertCircle size={32} />
                            <h1 className="text-2xl font-bold">WebUSB Not Supported</h1>
                        </div>
                        <p className="text-gray-700">
                            Your browser doesn't support WebUSB API. Please use Chrome, Edge,
                            or Opera over HTTPS.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white shadow-xl rounded-2xl p-8 border border-blue-100">
                    <div className="flex items-center gap-3 mb-6">
                        <Usb className="text-blue-600" size={32} />
                        <h1 className="text-3xl font-bold">WebUSB Printer Demo</h1>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-6">
                        <button
                            onClick={requestDevice}
                            className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"
                        >
                            🔌 Request Device
                        </button>
                        <button
                            onClick={sendData}
                            disabled={!device}
                            className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700"
                        >
                            📤 Send Data
                        </button>
                        <button
                            onClick={printReceipt}
                            disabled={!device}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700"
                        >
                            🖨️ Print Test
                        </button>
                        <button
                            onClick={closeDevice}
                            disabled={!device}
                            className="bg-gray-500 text-white px-4 py-2 rounded-xl hover:bg-gray-600"
                        >
                            ❌ Close Device
                        </button>
                    </div>

                    {status && <div className="text-blue-700 mb-3">{status}</div>}
                    {error && <div className="text-red-700 mb-3">{error}</div>}

                    <div className="mb-6">
                        <textarea
                            value={transferData}
                            onChange={(e) => setTransferData(e.target.value)}
                            placeholder="Enter data to send..."
                            className="w-full p-3 border border-gray-300 rounded-xl"
                        />
                    </div>

                    {deviceInfo && (
                        <div className="bg-gray-50 p-4 rounded-xl">
                            <h2 className="font-bold mb-2">Connected Device Info:</h2>
                            <pre className="text-sm">
                                {JSON.stringify(deviceInfo, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
