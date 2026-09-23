const express = require("express");
const crypto = require("crypto");

function verifySignature(appSecret, rawBody, header) {
  if (!appSecret) return true; // chưa cấu hình APP_SECRET → bỏ qua (chỉ dùng khi thử nghiệm)
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody || "").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createApp({ config, bot, logger = console }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => { req.rawBody = buf; },
    })
  );

  app.get("/", (_req, res) => res.send("An Lạc Phát Messenger bot đang chạy ✅"));

  // Facebook gọi 1 lần để xác minh webhook
  app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && config.verifyToken && token === config.verifyToken) {
      logger.log("[webhook] Đã xác minh webhook");
      return res.status(200).send(challenge);
    }
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
