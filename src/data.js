const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");

function loadShop(dir = DATA_DIR) {
  return JSON.parse(fs.readFileSync(path.join(dir, "shop.json"), "utf8"));
}

// Đọc CSV (xuất từ Excel). Hỗ trợ dấu phẩy hoặc chấm phẩy, ô có ngoặc kép, BOM UTF-8.
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || "").trim()])));
}

function loadProducts(dir = DATA_DIR) {
  const file = path.join(dir, "products.csv");
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8")).filter((p) => p.ten_san_pham || p.ma_sp);
}

function loadFaq(dir = DATA_DIR) {
  const file = path.join(dir, "faq.csv");
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, "utf8")).filter((r) => r.cau_hoi && r.tra_loi);
}

// Chuyển danh mục thành văn bản gọn để đưa cho AI.
function catalogText(products) {
  if (!products.length) return "(Danh mục sản phẩm CHƯA được cập nhật.)";
  const cols = Object.keys(products[0]);
  const lines = products.map((p) =>
    cols.filter((c) => p[c]).map((c) => `${c}=${p[c]}`).join(" | ")
  );
  return lines.join("\n");
}

module.exports = { loadShop, loadProducts, loadFaq, parseCsv, catalogText, DATA_DIR };
