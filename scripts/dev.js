#!/usr/bin/env node
// Chạy Next.js dev server + tự động mở browser khi server ready

const { spawn } = require("child_process");

(async () => {
  const open = (await import("open")).default;
  const port = process.env.PORT || "3000";

  const nextProcess = spawn("next", ["dev", "-p", port], {
    stdio: "inherit",
    shell: true,
  });

  // Đợi 2 giây cho server startup, rồi mở browser
  setTimeout(() => {
    open(`http://localhost:${port}`).catch((err) => {
      console.error("Không thể mở browser:", err.message);
    });
  }, 2000);

  // Nếu process bị kill thì thoát
  nextProcess.on("exit", (code) => {
    process.exit(code);
  });
})();
