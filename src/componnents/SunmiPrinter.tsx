import React, { useState, useCallback, useRef } from 'react';
import { PrinterCommand } from '../service/printCommand';
import { UsbPrinterConnection } from '../service/UsbPrinterConnection';
import { WebSocketPrinterConnection } from '../service/webSocketPrinterConnection';
import { UsbWsPrinterConnection } from '../types';

const PRINTER_USB_VENDOR_ID: number = 8137;
const PRINTER_USB_PRODUCT_ID: number = 8214;

const WEBSOCKET_URL: string = 'ws://10.191.56.134:5048';

interface PrinterConnection {
    connect?(): Promise<void>;
    disconnect?(): void;
    requestPermission?(): Promise<void>;
    isConnected(): boolean;
}

type ConnectionType = 'usb' | 'websocket';

const PrintComponent: React.FC<{ content: string }> = ({ content }) => {
    const [status, setStatus] = useState<string>('Disconnected');
    const [connectionType, setConnectionType] = useState<ConnectionType>('websocket');
    const connectionRef = useRef<PrinterConnection | null>(null);
    const printerCommandRef = useRef<PrinterCommand | null>(null);

    const clearConnection = useCallback(() => {
        if (connectionRef.current && connectionRef.current.disconnect) {
            connectionRef.current.disconnect();
        }
        connectionRef.current = null;
        printerCommandRef.current = null;
    }, []);

    const handleConnect = useCallback(async () => {
        if (connectionRef.current?.isConnected()) {
            setStatus('Already connected.');
            return;
        }

        clearConnection();

        setStatus(`Connecting via ${connectionType.toUpperCase()}...`);

        try {
            let connection: UsbWsPrinterConnection;
            const isWS = connectionType === 'websocket'
            if (isWS) {
                const wsConnection = new WebSocketPrinterConnection(WEBSOCKET_URL);
                await wsConnection.connect();
                connection = wsConnection;
            } else { // connectionType === 'usb'
                const usbConnection = UsbPrinterConnection.getInstance(
                    PRINTER_USB_VENDOR_ID,
                    PRINTER_USB_PRODUCT_ID
                );
                // Với USB, ta yêu cầu quyền truy cập (user gesture)
                await usbConnection.requestPermission();
                connection = usbConnection;
            }

            connectionRef.current = connection;
            printerCommandRef.current = new PrinterCommand(connection);

            // printerCommandRef.current.setPrinterCodePage(isWS ? undefined : 28)

            setStatus(`Connected via ${connectionType.toUpperCase()} (Ready to print).`);

        } catch (error: any) {
            console.error('Connection failed:', error);
            setStatus(`Connection Error (${connectionType.toUpperCase()}): ${error.message}`);
            connectionRef.current = null;
            printerCommandRef.current = null;
        }
    }, [connectionType, clearConnection]);

    const handleDisconnect = useCallback(() => {
        if (connectionRef.current) {
            if (connectionRef.current.disconnect) {
                connectionRef.current.disconnect();
            }

            connectionRef.current = null;
            printerCommandRef.current = null;
            setStatus('Disconnected.');
        }
    }, []);


    const handlePrint = useCallback(async () => {
        const command = printerCommandRef.current;
        if (!command || !command.isConnected()) {
            setStatus('Error: Not connected. Please connect first.');
            return;
        }

        setStatus(`Sending print data via ${connectionType.toUpperCase()}...`);

        try {
            await command.printText(content);

            setStatus('Print command sent successfully.');
        } catch (error: any) {
            console.error(error);
            setStatus(`Printing failed: ${error.message}`);
        }
    }, [content, connectionType]);

    const isConnected: boolean = connectionRef.current?.isConnected() ?? false;
    const isConnecting: boolean = status.includes('Connecting');
    const isSending: boolean = status.includes('Sending');

    return (
        <div>
            <h2>Print Selection and Status</h2>

            <div style={{ marginBottom: '10px' }}>
                <label>
                    <input
                        type="radio"
                        value="websocket"
                        checked={connectionType === 'websocket'}
                        onChange={() => setConnectionType('websocket')}
                        disabled={isConnected || isConnecting}
                    />
                    WebSocket ({WEBSOCKET_URL})
                </label>
                <label style={{ marginLeft: '15px' }}>
                    <input
                        type="radio"
                        value="usb"
                        checked={connectionType === 'usb'}
                        onChange={() => setConnectionType('usb')}
                        disabled={isConnected || isConnecting}
                    />
                    USB (Vendor: {PRINTER_USB_VENDOR_ID}, Product: {PRINTER_USB_PRODUCT_ID})
                </label>
            </div>

            <button
                onClick={isConnected ? handleDisconnect : handleConnect}
                disabled={isConnecting}
                style={{
                    backgroundColor: isConnected ? 'red' : 'green',
                    color: 'white',
                    margin: '5px'
                }}
            >
                {isConnected ? 'Disconnect' : isConnecting ? 'Connecting...' : 'Connect'}
            </button>

            <button
                onClick={handlePrint}
                disabled={!isConnected || isSending}
                style={{ margin: '5px' }}
            >
                {isSending ? 'Sending...' : 'Print (Send Data)'}
            </button>

            <p>Status: <strong>{status}</strong></p>
        </div>
    );
};

export default PrintComponent;