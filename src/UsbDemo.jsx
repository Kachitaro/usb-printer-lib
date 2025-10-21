import { useState, useEffect } from "react";

export default function UsbDemo() {
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devices = await navigator.usb.getDevices();
        setDevices(devices);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchDevices();

    navigator.usb.addEventListener("connect", (event) => {
      setDevices((prev) => [...prev, event.device]);
    });

    navigator.usb.addEventListener("disconnect", (event) => {
      setDevices((prev) => prev.filter((d) => d !== event.device));
    });
  }, []);

  const requestDevice = async () => {
    try {
      const device = await navigator.usb.requestDevice({
        filters: [],
      });
      setDevices((prev) => [...prev, device]);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const connectToDevice = async (device) => {
    try {
      await device.open();
      for (const config of device.configurations) {
        for (const iface of config.interfaces) {
          if (!iface.claimed) {
            await device.claimInterface(iface.interfaceNumber);
          }
        }
      }
      const data = 'Hello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\nHello from Web USB!\n';
      const dataBuffer = new TextEncoder().encode(data);
      await device.transferOut(1, dataBuffer);
      console.log("✅ Gửi dữ liệu thành công!");
      await device.close();
    } catch (err) {
      console.error("❌ Lỗi:", err);
      setError(err.message);
    }
  };


  return (
    <div style={{ padding: 20 }}>
      <h2>🔌 Danh sách thiết bị USB</h2>
      <button
        onClick={requestDevice}
        style={{
          backgroundColor: "#0078ff",
          color: "white",
          border: "none",
          padding: "8px 12px",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        + Thêm thiết bị USB
      </button>

      {error && <p style={{ color: "red" }}>Lỗi: {error}</p>}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 20,
          border: "1px solid #ccc",
        }}
      >
        <thead >
          <tr>
            <th style={cellStyle}>#</th>
            <th style={cellStyle}>Tên thiết bị</th>
            <th style={cellStyle}>Hãng sản xuất</th>
            <th style={cellStyle}>Vendor ID</th>
            <th style={cellStyle}>Product ID</th>
            <th style={cellStyle}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {devices.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: 12 }}>
                Không có thiết bị nào được cấp quyền.
              </td>
            </tr>
          ) : (
            devices.map((device, index) => (
              <tr key={index}>
                <td style={cellStyle}>{index + 1}</td>
                <td style={cellStyle}>
                  {device.productName || "Không rõ"}
                </td>
                <td style={cellStyle}>
                  {device.manufacturerName || "Không rõ"}
                </td>
                <td style={cellStyle}>
                  {device.vendorId?.toString(16) || "?"}
                </td>
                <td style={cellStyle}>
                  {device.productId?.toString(16) || "?"}
                </td>
                <td style={cellStyle}>
                  <button onClick={() => connectToDevice(device)}>In</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = {
  border: "1px solid ",
  padding: "8px 10px",
  textAlign: "left",
};
