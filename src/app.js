const express = require("express");
const crypto = require("crypto");
const path = require("path");

function verifySignature(appSecret, rawBody, header) {
  if (!appSecret) return true; // chưa cấu hình APP_SECRET → bỏ qua (chỉ dùng khi thử nghiệm)
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody || "").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createApp({ config, bot, ai, logger = console }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => { req.rawBody = buf; },
    })
  );

  // Trang kiểm tra: chỉ cho biết biến nào ĐÃ/CHƯA có, không bao giờ hiện giá trị
  app.get("/", (_req, res) => {
    const mark = (v) => (v ? "✅ đã có" : "❌ CHƯA CÓ");
    res.type("text/plain; charset=utf-8").send(
      [
        "An Lạc Phát Messenger bot đang chạy ✅",
        "",
        `VERIFY_TOKEN:      ${mark(config.verifyToken)}${config.verifyToken ? ` (${config.verifyToken.length} ký tự)` : ""}`,
        `PAGE_ACCESS_TOKEN: ${mark(config.pageAccessToken)}`,
        `APP_SECRET:        ${mark(config.appSecret)}`,
        `GEMINI_API_KEY:    ${mark(config.geminiApiKey)}${config.geminiApiKey ? ` (đang dùng AI Gemini: ${config.geminiModel})` : ""}`,
        `ANTHROPIC_API_KEY: ${mark(config.anthropicApiKey)}${!config.geminiApiKey && config.anthropicApiKey ? " (đang dùng AI Claude)" : ""}`,
      ].join("\n")
    );
  });

  // Trang Chính sách quyền riêng tư (dùng cho Meta App Review)
  const privacyFile = path.join(__dirname, "privacy.html");
  app.get(["/chinh-sach-bao-mat", "/privacy"], (_req, res) => res.sendFile(privacyFile));

  // Tự kiểm tra AI: mở /test-ai?key=<VERIFY_TOKEN> trên trình duyệt
  app.get("/test-ai", async (req, res) => {
    res.type("text/plain; charset=utf-8");
    if (!config.verifyToken || req.query.key !== config.verifyToken) return res.status(403).send("Sai key. Dùng: /test-ai?key=<VERIFY_TOKEN>");
    if (!ai) return res.send("❌ Chưa có AI (thiếu GEMINI_API_KEY / ANTHROPIC_API_KEY)");
    const q = String(req.query.q || "phòng khách 20m2 nên dùng đèn gì");
    try {
      const r = await ai.reply([{ role: "user", content: q }]);
      res.send(`✅ AI hoạt động${ai.current ? ` (model: ${ai.current()})` : ""}\n\nHỏi: ${q}\n\nĐáp: ${r.text}${r.handoff ? "\n\n(→ chuyển nhân viên)" : ""}`);
    } catch (e) {
      const msg = String(e.message || e).replace(/AIza[0-9A-Za-z_-]+/g, "AIza***");
      res.send(`❌ AI LỖI:\n\n${msg}`);
    }
  });

  // Facebook gọi 1 lần để xác minh webhook
  app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && config.verifyToken && token === config.verifyToken) {
      logger.log("[webhook] Đã xác minh webhook");
      return res.status(200).send(challenge);
    }
    logger.warn(
      `[webhook] Xác minh THẤT BẠI: ` +
        (!config.verifyToken
          ? "Render chưa có biến VERIFY_TOKEN"
          : `mã Meta gửi (${String(token || "").length} ký tự) khác VERIFY_TOKEN trên Render (${config.verifyToken.length} ký tự)`)
    );
    return res.sendStatus(403);
  });

  // Facebook gửi tin nhắn của khách tới đây
  app.post("/webhook", (req, res) => {
    if (!verifySignature(config.appSecret, req.rawBody, req.get("x-hub-signature-256"))) {
      logger.warn("[webhook] Sai chữ ký, bỏ qua yêu cầu");
      return res.sendStatus(401);
    }
    const body = req.body || {};
    if (body.object !== "page") return res.sendStatus(404);

    // Trả lời Facebook ngay (bắt buộc < 20 giây), xử lý sau
    res.status(200).send("EVENT_RECEIVED");

    for (const entry of body.entry || []) {
      for (const ev of entry.messaging || []) {
        Promise.resolve(bot.handleEvent(ev)).catch((e) => logger.error("[webhook] Lỗi:", e && e.message));
      }
    }
  });

  return app;
}

module.exports = { createApp, verifySignature };
