// Cầu nối an toàn giữa tiến trình chính Electron (main.js) và trang web
// đang hiển thị (renderer) — chỉ để BÁO TRẠNG THÁI CẬP NHẬT, không cấp
// quyền Node.js nào khác cho trang web. `window.electronAPI` chỉ tồn
// tại khi chạy trong app đã đóng gói (không có khi mở bằng trình duyệt
// thường lúc `npm run dev`) — xem src/components/UpdateNotifier.tsx.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onUpdateStatus: (callback) => {
    ipcRenderer.on("update-status", (_event, data) => callback(data));
  },
  restartAndInstall: () => ipcRenderer.send("restart-and-install"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
