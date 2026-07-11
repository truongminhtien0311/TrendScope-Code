// Viết CSV chuẩn RFC 4180 tay, không cần thêm dependency. Thêm BOM để
// Excel mở file tiếng Việt có dấu không bị lỗi font.
const BOM = "﻿";

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((line) => line.map(escapeCell).join(","));
  return BOM + lines.join("\r\n");
}
