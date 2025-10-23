// file: components/PrintComponent.tsx (Đã sửa đổi để chọn kết nối)

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { PrinterCommand, textToUint8Array } from '../service/printCommand'; 
import { UsbPrinterConnection } from '../service/UsbPrinterConnection';
import { WebSocketPrinterConnection } from '../service/webSocketPrinterConnection';
import { UsbWsPrinterConnection } from '../types';

const PRINTER_USB_VENDOR_ID: number = 0x04b8; 
const PRINTER_USB_PRODUCT_ID: number = 0x0202; 
const WEBSOCKET_URL: string = 'ws://localhost:5048';

// Định nghĩa Interface chung cho các lớp kết nối
interface PrinterConnection {
  connect?(): Promise<void>; // WebSocket cần connect()
  disconnect?(): void;
  requestPermission?(): Promise<void>; // USB cần requestPermission()
  isConnected(): boolean;
}

type ConnectionType = 'usb' | 'websocket';

const PrintComponent: React.FC<{ content: string }> = ({ content }) => {
    const [status, setStatus] = useState<string>('Disconnected');
    // Trạng thái chọn phương thức in
    const [connectionType, setConnectionType] = useState<ConnectionType>('websocket'); 

    const connectionRef = useRef<PrinterConnection | null>(null);   
    // Lưu trữ lớp xử lý lệnh in
    const printerCommandRef = useRef<PrinterCommand | null>(null);

    // Xóa kết nối và lệnh in hiện tại
    const clearConnection = useCallback(() => {
        if (connectionRef.current && connectionRef.current.disconnect) {
            connectionRef.current.disconnect();
        }
        connectionRef.current = null;
        printerCommandRef.current = null;
    }, []);

    // Hàm kết nối chung cho cả USB và WebSocket
    const handleConnect = useCallback(async () => {
        // Nếu đã kết nối, không làm gì
        if (connectionRef.current?.isConnected()) {
            setStatus('Already connected.');
            return;
        }

        clearConnection(); // Xóa kết nối cũ (nếu có)

        setStatus(`Connecting via ${connectionType.toUpperCase()}...`);

        try {
            let connection: UsbWsPrinterConnection;

            if (connectionType === 'websocket') {
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
            
            setStatus(`Connected via ${connectionType.toUpperCase()} (Ready to print).`);

        } catch (error: any) {
            console.error('Connection failed:', error);
            setStatus(`Connection Error (${connectionType.toUpperCase()}): ${error.message}`);
            connectionRef.current = null;
            printerCommandRef.current = null;
        }
    }, [connectionType, clearConnection]);

    // Hàm ngắt kết nối chung
    const handleDisconnect = useCallback(() => {
        if (connectionRef.current) {
            // Chỉ WebSocket có hàm disconnect rõ ràng
            if (connectionRef.current.disconnect) {
                connectionRef.current.disconnect();
            }
            // USB không cần disconnect thủ công (trừ khi gọi device.close()),
            // nhưng ta vẫn reset trạng thái và ref
            connectionRef.current = null;
            printerCommandRef.current = null;
            setStatus('Disconnected.');
        }
    }, []);

    // Hàm in chung
    const handlePrint = useCallback(async () => {
        const command = printerCommandRef.current;
        if (!command || !command.isConnected()) {
            setStatus('Error: Not connected. Please connect first.');
            return;
        }

        setStatus(`Sending print data via ${connectionType.toUpperCase()}...`);

        try {
            // Chuẩn bị dữ liệu in ESC/POS
            const escposBytes: Uint8Array = textToUint8Array(content);
            
            // Gửi dữ liệu thô qua lớp PrinterCommand
            await command.printRaw(escposBytes); 
            
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

            {/* Lựa chọn phương thức kết nối */}
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

            {/* Nút MỞ/ĐÓNG KẾT NỐI */}
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

            {/* Nút GỬI LỆNH IN */}
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