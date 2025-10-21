import { useState, useEffect } from 'react';
import { Usb, Power, Wifi, AlertCircle, Check } from 'lucide-react';

const WebUSBDemo = () => {
    const [supported, setSupported] = useState(false);
    const [device, setDevice] = useState(null);
    const [devices, setDevices] = useState([]);
    const [status, setStatus] = useState('');
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [error, setError] = useState('');
    const [transferData, setTransferData] = useState('');
    const [receiveData, setReceiveData] = useState('');

    useEffect(() => {
        // Check WebUSB support
        if ('usb' in navigator) {
            setSupported(true);
            loadDevices();

            // Listen for device connect/disconnect
            navigator.usb.addEventListener('connect', handleConnect);
            navigator.usb.addEventListener('disconnect', handleDisconnect);

            return () => {
                navigator.usb.removeEventListener('connect', handleConnect);
                navigator.usb.removeEventListener('disconnect', handleDisconnect);
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
        setStatus(`Device connected: ${e.device.productName || 'Unknown'}`);
        loadDevices();
    };

    const handleDisconnect = (e) => {
        setStatus(`Device disconnected: ${e.device.productName || 'Unknown'}`);
        if (device && device === e.device) {
            setDevice(null);
            setDeviceInfo(null);
        }
        loadDevices();
    };

    const requestDevice = async () => {
        try {
            setError('');
            setStatus('Requesting device...');

            // Request any USB device
            // In production, you should specify filters
            const selectedDevice = await navigator.usb.requestDevice({
                filters: []
                // Example filter for specific vendor:
                // filters: [{ vendorId: 0x2341 }] // Arduino
            });

            setDevice(selectedDevice);
            setStatus('Device selected! Opening...');

            // Open device - may fail if device is in use
            try {
                await selectedDevice.open();
                setStatus('Device opened!');
            } catch (openErr) {
                if (openErr.name === 'NotFoundError') {
                    setError('Device disconnected or not found');
                    return;
                }
                if (openErr.message.includes('Access denied')) {
                    setError('Access denied: Device may be in use by another program or need WinUSB driver. See troubleshooting tips below.');
                    setStatus('Failed - Access Denied');
                } else {
                    throw openErr;
                }
            }

            // Get device info
            const info = {
                productName: selectedDevice.productName,
                manufacturerName: selectedDevice.manufacturerName,
                serialNumber: selectedDevice.serialNumber,
                vendorId: `0x${selectedDevice.vendorId.toString(16).padStart(4, '0')}`,
                productId: `0x${selectedDevice.productId.toString(16).padStart(4, '0')}`,
                deviceClass: selectedDevice.deviceClass,
                deviceSubclass: selectedDevice.deviceSubclass,
                deviceProtocol: selectedDevice.deviceProtocol,
                usbVersion: `${selectedDevice.usbVersionMajor}.${selectedDevice.usbVersionMinor}.${selectedDevice.usbVersionSubminor}`,
                configurations: selectedDevice.configurations.length,
                opened: selectedDevice.opened
            };

            setDeviceInfo(info);
            loadDevices();
        } catch (err) {
            setError(`Error: ${err.message}`);
            setStatus('Failed to connect');
        }
    };

    const selectConfiguration = async () => {
        if (!device) return;

        try {
            setStatus('Selecting configuration...');
            // Select first configuration if none selected
            if (!device.configuration) {
                await device.selectConfiguration(1);
                setStatus('Configuration selected!');
            }
        } catch (err) {
            setError(`Configuration error: ${err.message}`);
        }
    };

    const claimInterface = async (interfaceNumber = 0) => {
        if (!device) return;

        try {
            setStatus(`Claiming interface ${interfaceNumber}...`);
            await device.claimInterface(interfaceNumber);
            setStatus(`Interface ${interfaceNumber} claimed!`);
        } catch (err) {
            setError(`Claim interface error: ${err.message}`);
        }
    };

    const sendData = async () => {
        if (!device || !transferData) return;

        try {
            setStatus('Sending data...');

            // Convert string to Uint8Array
            const encoder = new TextEncoder();
            const data = encoder.encode(transferData);

            // Send to endpoint 1 (OUT)
            // Note: This is example code. Real implementation depends on your device
            const result = await device.transferOut(1, data);

            setStatus(`Sent ${result.bytesWritten} bytes`);
        } catch (err) {
            setError(`Transfer error: ${err.message}`);
        }
    };

    // ESC/POS Printer Commands
    const printerCommands = {
        // Initialize printer
        INIT: [0x1B, 0x40],

        // Line feed
        LF: [0x0A],

        // Carriage return
        CR: [0x0D],

        // Cut paper (full cut)
        CUT_FULL: [0x1D, 0x56, 0x00],

        // Cut paper (partial cut)
        CUT_PARTIAL: [0x1D, 0x56, 0x01],

        // Cut paper with feed (ESC i)
        CUT_FEED: [0x1B, 0x69],

        // Cut paper (alternative - GS V m)
        CUT_ALT: [0x1D, 0x56, 0x41, 0x00],

        // Feed and cut
        FEED_CUT: [0x1D, 0x56, 0x42, 0x00],

        // Text alignment
        ALIGN_LEFT: [0x1B, 0x61, 0x00],
        ALIGN_CENTER: [0x1B, 0x61, 0x01],
        ALIGN_RIGHT: [0x1B, 0x61, 0x02],

        // Text style
        BOLD_ON: [0x1B, 0x45, 0x01],
        BOLD_OFF: [0x1B, 0x45, 0x00],
        UNDERLINE_ON: [0x1B, 0x2D, 0x01],
        UNDERLINE_OFF: [0x1B, 0x2D, 0x00],

        // Font size
        NORMAL_SIZE: [0x1D, 0x21, 0x00],
        DOUBLE_WIDTH: [0x1D, 0x21, 0x10],
        DOUBLE_HEIGHT: [0x1D, 0x21, 0x01],
        DOUBLE_SIZE: [0x1D, 0x21, 0x11],
    };

    const printWithCut = async () => {
        if (!device) {
            setError('No device connected');
            return;
        }

        try {
            setStatus('Printing...');

            // Prepare data
            const textData = transferData || 'Hello from WebUSB Printer!\n';
            const encoder = new TextEncoder();
            const textBytes = encoder.encode(textData);

            // Build command sequence
            const commands = [];

            // 1. Initialize printer
            commands.push(...printerCommands.INIT);

            // 2. Add text content
            commands.push(...textBytes);

            // 3. Feed some lines before cut (optional)
            commands.push(...printerCommands.LF);
            commands.push(...printerCommands.LF);
            commands.push(...printerCommands.LF);

            // 4. Cut paper (choose one method)
            commands.push(...printerCommands.CUT_PARTIAL);  // Partial cut (recommended)
            // OR use full cut:
            // commands.push(...printerCommands.CUT_FULL);
            // OR use alternative cut:
            // commands.push(...printerCommands.FEED_CUT);

            // Convert to Uint8Array
            const commandBuffer = new Uint8Array(commands);

            // Send to printer
            const result = await device.transferOut(1, commandBuffer);

            setStatus(`✅ Printed and cut! Sent ${result.bytesWritten} bytes`);
        } catch (err) {
            setError(`Print error: ${err.message}`);
            setStatus('Print failed');
        }
    };

    const printReceipt = async () => {
        if (!device) {
            setError('No device connected');
            return;
        }

        try {
            setStatus('Printing receipt...');

            const encoder = new TextEncoder();
            const commands = [];

            // Initialize
            commands.push(...printerCommands.INIT);

            // Center align
            commands.push(...printerCommands.ALIGN_CENTER);

            // Bold & Double size for header
            commands.push(...printerCommands.BOLD_ON);
            commands.push(...printerCommands.DOUBLE_SIZE);
            commands.push(...encoder.encode('RECEIPT\n'));

            // Reset to normal
            commands.push(...printerCommands.NORMAL_SIZE);
            commands.push(...printerCommands.BOLD_OFF);
            commands.push(...printerCommands.LF);

            // Left align for details
            commands.push(...printerCommands.ALIGN_LEFT);
            commands.push(...encoder.encode('Date: ' + new Date().toLocaleString() + '\n'));
            commands.push(...printerCommands.LF);

            // Items
            commands.push(...encoder.encode('Item 1.............$10.00\n'));
            commands.push(...encoder.encode('Item 2.............$15.50\n'));
            commands.push(...encoder.encode('Item 3..............$8.00\n'));
            commands.push(...printerCommands.LF);

            // Total (bold)
            commands.push(...printerCommands.BOLD_ON);
            commands.push(...encoder.encode('TOTAL..............$33.50\n'));
            commands.push(...printerCommands.BOLD_OFF);

            // Footer
            commands.push(...printerCommands.LF);
            commands.push(...printerCommands.ALIGN_CENTER);
            commands.push(...encoder.encode('Thank you!\n'));
            commands.push(...encoder.encode('Visit again\n'));

            // Feed lines before cut
            commands.push(...printerCommands.LF);
            commands.push(...printerCommands.LF);
            commands.push(...printerCommands.LF);

            // Cut paper
            commands.push(...printerCommands.CUT_PARTIAL);

            // Send to printer
            const commandBuffer = new Uint8Array(commands);
            const result = await device.transferOut(1, commandBuffer);

            setStatus(`✅ Receipt printed! Sent ${result.bytesWritten} bytes`);
        } catch (err) {
            setError(`Print error: ${err.message}`);
            setStatus('Print failed');
        }
    };

    const receiveDataFromDevice = async () => {
        if (!device) return;

        try {
            setStatus('Reading data...');

            // Read from endpoint 1 (IN) - 64 bytes
            const result = await device.transferIn(1, 64);

            if (result.data) {
                const decoder = new TextDecoder();
                const text = decoder.decode(result.data);
                setReceiveData(text);
                setStatus(`Received ${result.data.byteLength} bytes`);
            }
        } catch (err) {
            setError(`Receive error: ${err.message}`);
        }
    };

    const controlTransfer = async () => {
        if (!device) return;

        try {
            setStatus('Sending control transfer...');

            // Example: Get device descriptor
            const result = await device.controlTransferIn({
                requestType: 'standard',
                recipient: 'device',
                request: 0x06, // GET_DESCRIPTOR
                value: 0x0100, // DEVICE descriptor
                index: 0x00
            }, 18); // Device descriptor is 18 bytes

            if (result.data) {
                setStatus(`Control transfer completed: ${result.data.byteLength} bytes`);
            }
        } catch (err) {
            setError(`Control transfer error: ${err.message}`);
        }
    };

    const closeDevice = async () => {
        if (!device) return;

        try {
            setStatus('Closing device...');
            await device.close();
            setStatus('Device closed');
            setDevice(null);
            setDeviceInfo(null);
        } catch (err) {
            setError(`Close error: ${err.message}`);
        }
    };

    const forgetDevice = async () => {
        if (!device) return;

        try {
            setStatus('Forgetting device...');
            await device.forget();
            setStatus('Device forgotten');
            setDevice(null);
            setDeviceInfo(null);
            loadDevices();
        } catch (err) {
            setError(`Forget error: ${err.message}`);
        }
    };

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
                            Your browser doesn't support WebUSB API. Please use Chrome, Edge, or Opera.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                        <div className="flex items-center gap-3">
                            <Usb size={32} />
                            <div>
                                <h1 className="text-3xl font-bold">WebUSB Demo</h1>
                                <p className="text-blue-100">Connect and control USB devices from your browser</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {/* Status Bar */}
                        {status && (
                            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-blue-700">
                                    <Wifi className="animate-pulse" size={20} />
                                    <span className="font-medium">{status}</span>
                                </div>
                            </div>
                        )}

                        {/* Error Alert */}
                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-red-700">
                                    <AlertCircle size={20} />
                                    <span className="font-medium">{error}</span>
                                </div>
                            </div>
                        )}

                        {/* Main Actions */}
                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-3">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">Device Control</h2>

                                <button
                                    onClick={requestDevice}
                                    disabled={device !== null}
                                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Power size={20} />
                                        Connect Device
                                    </div>
                                </button>

                                <button
                                    onClick={selectConfiguration}
                                    disabled={!device}
                                    className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Select Configuration
                                </button>

                                <button
                                    onClick={() => claimInterface(0)}
                                    disabled={!device}
                                    className="w-full bg-indigo-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Claim Interface 0
                                </button>

                                <button
                                    onClick={controlTransfer}
                                    disabled={!device}
                                    className="w-full bg-pink-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Control Transfer
                                </button>

                                <div className="flex gap-2">
                                    <button
                                        onClick={closeDevice}
                                        disabled={!device}
                                        className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={forgetDevice}
                                        disabled={!device}
                                        className="flex-1 bg-red-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Forget
                                    </button>
                                </div>
                            </div>

                            {/* Data Transfer */}
                            <div className="space-y-3">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">Data Transfer</h2>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Send Data
                                    </label>
                                    <textarea
                                        value={transferData}
                                        onChange={(e) => setTransferData(e.target.value)}
                                        placeholder="Enter text to print..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows="3"
                                    />
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button
                                            onClick={sendData}
                                            disabled={!device || !transferData}
                                            className="bg-green-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                                        >
                                            Send Only
                                        </button>
                                        <button
                                            onClick={printWithCut}
                                            disabled={!device || !transferData}
                                            className="bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                                        >
                                            🖨️ Print & Cut
                                        </button>
                                    </div>
                                    <button
                                        onClick={printReceipt}
                                        disabled={!device}
                                        className="w-full mt-2 bg-purple-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        🧾 Print Sample Receipt
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Receive Data
                                    </label>
                                    <textarea
                                        value={receiveData}
                                        readOnly
                                        placeholder="Received data will appear here..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                                        rows="3"
                                    />
                                    <button
                                        onClick={receiveDataFromDevice}
                                        disabled={!device}
                                        className="w-full mt-2 bg-teal-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Read from Device
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Device Info */}
                        {deviceInfo && (
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Check className="text-green-500" size={24} />
                                    Connected Device Info
                                </h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {Object.entries(deviceInfo).map(([key, value]) => (
                                        <div key={key} className="bg-white rounded-lg p-3 shadow-sm">
                                            <span className="text-sm text-gray-500 font-medium block mb-1">
                                                {key.replace(/([A-Z])/g, ' $1').trim()}:
                                            </span>
                                            <span className="text-gray-900 font-semibold">
                                                {value?.toString() || 'N/A'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Previously Authorized Devices */}
                        {devices.length > 0 && (
                            <div className="mt-6">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">
                                    Previously Authorized Devices ({devices.length})
                                </h2>
                                <div className="space-y-2">
                                    {devices.map((dev, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-gray-800">
                                                        {dev.productName || 'Unknown Device'}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {dev.manufacturerName || 'Unknown Manufacturer'} •
                                                        VID: 0x{dev.vendorId.toString(16).padStart(4, '0')} •
                                                        PID: 0x{dev.productId.toString(16).padStart(4, '0')}
                                                    </p>
                                                </div>
                                                {dev.opened && (
                                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                                                        Connected
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Info Box */}
                        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h3 className="font-bold text-yellow-800 mb-2">⚠️ Important Notes:</h3>
                            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                                <li>This demo requires HTTPS (or localhost)</li>
                                <li>Not all USB devices are accessible (HID, Audio, Video are protected)</li>
                                <li>You need user permission to access each device</li>
                                <li>Data transfer examples may not work with all devices</li>
                                <li>Check your device's documentation for specific endpoints and protocols</li>
                            </ul>
                        </div>

                        {/* Windows Troubleshooting */}
                        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                            <h3 className="font-bold text-red-800 mb-3">🪟 Windows: Fix "Access Denied" Error</h3>
                            <div className="text-sm text-red-700 space-y-3">
                                <div>
                                    <p className="font-semibold mb-1">1️⃣ Close other programs using the device:</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li>Device Manager</li>
                                        <li>Arduino IDE / PlatformIO</li>
                                        <li>Serial Monitor tools</li>
                                        <li>Other browser tabs accessing USB</li>
                                    </ul>
                                </div>

                                <div>
                                    <p className="font-semibold mb-1">2️⃣ Install WinUSB driver using Zadig:</p>
                                    <ol className="list-decimal list-inside ml-4 space-y-1">
                                        <li>Download Zadig: <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">zadig.akeo.ie</a></li>
                                        <li>Run as Administrator</li>
                                        <li>Options → List All Devices</li>
                                        <li>Select your USB device</li>
                                        <li>Choose "WinUSB" driver</li>
                                        <li>Click "Replace Driver" or "Install Driver"</li>
                                    </ol>
                                    <p className="mt-2 text-red-600 font-semibold">⚠️ Warning: This replaces the original driver!</p>
                                </div>

                                <div>
                                    <p className="font-semibold mb-1">3️⃣ Alternative: Use libusb driver (for testing):</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li>Download libusbK or libusb-win32</li>
                                        <li>Use INF Wizard to create driver installer</li>
                                        <li>Install driver for your device</li>
                                    </ul>
                                </div>

                                <div>
                                    <p className="font-semibold mb-1">4️⃣ Check Device Manager:</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li>Open Device Manager (devmgmt.msc)</li>
                                        <li>Find your device under "Universal Serial Bus devices"</li>
                                        <li>Right-click → Properties → Driver tab</li>
                                        <li>Check if driver is "WinUSB" or "libusbK"</li>
                                    </ul>
                                </div>

                                <div>
                                    <p className="font-semibold mb-1">5️⃣ For Arduino/ESP32/CH340:</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li>Some devices need special handling</li>
                                        <li>May need to upload custom firmware that enables WebUSB</li>
                                        <li>Check: <a href="https://github.com/webusb/arduino" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">WebUSB Arduino library</a></li>
                                    </ul>
                                </div>

                                <div className="bg-red-100 p-3 rounded border border-red-300 mt-3">
                                    <p className="font-bold mb-1">💡 Quick Test:</p>
                                    <p>Try connecting your device on <strong>Linux</strong> or <strong>macOS</strong> first - they usually work without driver changes!</p>
                                </div>
                            </div>
                        </div>

                        {/* ESC/POS Printer Commands Reference */}
                        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                            <h3 className="font-bold text-green-800 mb-3">🖨️ ESC/POS Printer Commands Reference</h3>
                            <div className="text-sm text-green-700 space-y-3">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="font-semibold mb-2">Cut Commands:</p>
                                        <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                                            <li><code className="bg-white px-1 rounded">1D 56 00</code> - Full cut</li>
                                            <li><code className="bg-white px-1 rounded">1D 56 01</code> - Partial cut (recommended)</li>
                                            <li><code className="bg-white px-1 rounded">1B 69</code> - Cut with feed</li>
                                            <li><code className="bg-white px-1 rounded">1D 56 42 00</code> - Feed and cut</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-2">Text Style:</p>
                                        <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                                            <li><code className="bg-white px-1 rounded">1B 45 01</code> - Bold ON</li>
                                            <li><code className="bg-white px-1 rounded">1B 45 00</code> - Bold OFF</li>
                                            <li><code className="bg-white px-1 rounded">1D 21 11</code> - Double size</li>
                                            <li><code className="bg-white px-1 rounded">1B 61 01</code> - Center align</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="bg-white p-3 rounded mt-3">
                                    <p className="font-semibold text-green-800 mb-2">💡 Tips for Thermal Printers:</p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Always send <code className="bg-green-100 px-1 rounded">1B 40</code> (INIT) first</li>
                                        <li>Feed 2-3 lines before cutting (prevents cutting text)</li>
                                        <li>Use partial cut to keep receipt attached</li>
                                        <li>Endpoint is usually 1 or 2 (check with device.configurations)</li>
                                        <li>Some printers need <code className="bg-green-100 px-1 rounded">0x0A</code> (LF) after each line</li>
                                    </ul>
                                </div>

                                <div className="bg-yellow-50 border border-yellow-300 p-3 rounded">
                                    <p className="font-semibold text-yellow-800 mb-1">⚠️ Common Issues:</p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>If nothing prints: Check endpoint number and configuration</li>
                                        <li>If text is garbled: Try different encodings (UTF-8, ASCII)</li>
                                        <li>If cut doesn't work: Try different cut commands (some printers use vendor-specific codes)</li>
                                        <li>Partial cut recommended: Keeps receipt attached for easy tear-off</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Protected Classes Info */}
                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="font-bold text-blue-800 mb-2">🛡️ Protected Device Classes (Cannot Access):</h3>
                            <div className="grid md:grid-cols-2 gap-2 text-sm text-blue-700">
                                <div>• Audio (0x01)</div>
                                <div>• HID - Keyboard/Mouse (0x03)</div>
                                <div>• Mass Storage (0x08)</div>
                                <div>• Smart Card (0x0B)</div>
                                <div>• Video (0x0E)</div>
                                <div>• Audio/Video (0x10)</div>
                                <div>• Wireless Controller (0xE0)</div>
                            </div>
                            <p className="text-sm text-blue-600 mt-2">
                                These are blocked for security. Use specific APIs instead (WebHID, WebMIDI, etc.)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WebUSBDemo;