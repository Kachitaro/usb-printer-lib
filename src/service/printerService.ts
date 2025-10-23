
export const sendData = (ws: WebSocket, escposData: Uint8Array): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (ws.readyState !== WebSocket.OPEN) {
            return reject(new Error("WebSocket connection is not open."));
        }

        try {
            // Đảm bảo gửi ArrayBuffer
            ws.send(escposData.buffer);
            resolve('Print command sent via WebSocket.');
        } catch (error: any) {
            reject(new Error("Failed to send data: " + error.message));
        }
    });
};

// Hàm hỗ trợ chuyển đổi Text sang Byte (nếu bạn muốn dùng text)
export const textToUint8Array = (text: string): Uint8Array => {
    const encoder = new TextEncoder();
    return encoder.encode(text);
};