import { useState } from "react";

export default function SerialPrinter() {
    const [port, setPort] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    const log = (msg) => setLogs((prev) => [...prev, msg]);

    const connect = async () => {
        try {
            const newPort = await navigator.serial.requestPort();
            await newPort.open({ baudRate: 9600 });

            log("✅ Đã kết nối với thiết bị serial.");
            setPort(newPort);
            setIsConnected(true);

            // Bắt đầu đọc dữ liệu từ thiết bị (nếu có phản hồi)
            const reader = newPort.readable.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                log("📥 Nhận: " + decoder.decode(value));
            }
        } catch (err) {
            log("❌ Lỗi: " + err.message);
        }
    };

    const send = async () => {
        if (!port) return log("⚠️ Chưa kết nối thiết bị.");
        try {
            const encoder = new TextEncoder();
            const writer = port.writable.getWriter();
            await writer.write(encoder.encode("Hello từ Web Serial!\n"));
            writer.releaseLock();
            log("📤 Đã gửi dữ liệu thành công.");
        } catch (err) {
            log("❌ Lỗi gửi dữ liệu: " + err.message);
        }
    };

    const disconnect = async () => {
        try {
            await port.close();
            setIsConnected(false);
            log("🔌 Đã ngắt kết nối.");
        } catch (err) {
            log("❌ Lỗi khi ngắt: " + err.message);
        }
    };

    return (
        <div style={{ padding: 20, fontFamily: "sans-serif" }}>
            <h2>🖨️ Web Serial Printer Demo</h2>

            <div style={{ marginBottom: 10 }}>
                {!isConnected ? (
                    <button onClick={connect} style={btnStyle}>
                        🔌 Kết nối thiết bị
                    </button>
                ) : (
                    <button onClick={disconnect} style={btnStyle}>
                        ❎ Ngắt kết nối
                    </button>
                )}

                <button
                    onClick={send}
                    style={{ ...btnStyle, marginLeft: 10 }}
                    disabled={!isConnected}
                >
                    📨 Gửi dữ liệu
                </button>
            </div>

            <div
                style={{
                    border: "1px solid #ccc",
                    padding: 10,
                    height: 200,
                    overflowY: "auto",
                }}
            >
                {logs.map((l, i) => (
                    <div key={i}>{l}</div>
                ))}
            </div>
        </div>
    );
}

const btnStyle = {
    padding: "8px 14px",
    backgroundColor: "#0078ff",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
};
