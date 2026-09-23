// Chạy: npm test — giả lập Facebook và AI, không cần mạng/token thật.
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { createApp, verifySignature } = require("../src/app");
const { createBot } = require("../src/bot");
const { MemoryStore } = require("../src/store");
const { createMessenger, splitText } = require("../src/messenger");
const { createAi, buildSystemPrompt } = require("../src/ai");
const { parseCsv, catalogText, loadShop } = require("../src/data");

const SECRET = "test-secret";
const config = {
  verifyToken: "vt", appSecret: SECRET, pageAccessToken: "tok", graphVersion: "v23.0",
  pauseHours: 12, aiLimitPerHour: 3, historyTurns: 12, historyTtlHours: 24,
};
const shop = loadShop();
const quiet = { log() {}, warn() {}, error() {} };

function setup({ aiImpl } = {}) {
  const sent = [];
  const fetchImpl = async (url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, text: async () => "" }; };
  const messenger = createMessenger({ ...config, fetchImpl, logger: quiet });
  const store = new MemoryStore(config);
  const aiCalls = [];
  const ai = aiImpl === null ? null : {
    reply: async (h) => { aiCalls.push(JSON.parse(JSON.stringify(h))); return aiImpl ? aiImpl(h) : { text: "Dạ đèn này 9W ạ.", handoff: false }; },
  };
  const bot = createBot({ config, shop, store, messenger, ai, logger: quiet });
  const texts = () => sent.filter((b) => b.message).map((b) => b.message.text);
  return { bot, store, sent, texts, aiCalls };
}
let n = 0;
const msg = (psid, text, extra = {}) => ({ sender: { id: psid }, recipient: { id: "PAGE" }, message: { mid: "m" + ++n, text, ...extra } });

test("xác minh webhook đúng/sai token", async () => {
  const app = createApp({ config, bot: { handleEvent() {} }, logger: quiet });
  const srv = app.listen(0); const port = srv.address().port;
  const ok = await fetch(`http://localhost:${port}/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123`);
  assert.equal(ok.status, 200); assert.equal(await ok.text(), "123");
  const bad = await fetch(`http://localhost:${port}/webhook?hub.mode=subscribe&hub.verify_token=sai&hub.challenge=123`);
  assert.equal(bad.status, 403);
  srv.close();
});

test("POST webhook: chặn chữ ký giả, nhận chữ ký thật", async () => {
  const got = [];
  const app = createApp({ config, bot: { handleEvent: (e) => got.push(e) }, logger: quiet });
  const srv = app.listen(0); const port = srv.address().port;
  const body = JSON.stringify({ object: "page", entry: [{ messaging: [msg("U1", "chào")] }] });
  const fake = await fetch(`http://localhost:${port}/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=abc" }, body });
  assert.equal(fake.status, 401);
  const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  const real = await fetch(`http://localhost:${port}/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body });
  assert.equal(real.status, 200);
  assert.equal(got.length, 1);
  srv.close();
  assert.equal(verifySignature(SECRET, Buffer.from("x"), undefined), false);
});

test("chào hỏi → hiện menu nút bấm, không gọi AI", async () => {
  const t = setup();
  await t.bot.handleEvent(msg("U1", "Xin chào"));
  assert.match(t.texts()[0], /An Lạc Phát xin chào anh\/chị/);
  assert.equal(t.sent[0].message.quick_replies.length, 6);
  assert.equal(t.sent[0].message.metadata, "alp-bot");
  assert.equal(t.aiCalls.length, 0);
});

test("nút Tư vấn → chọn không gian → gọi AI với ngữ cảnh", async () => {
  const t = setup();
  await t.bot.handleEvent({ sender: { id: "U2" }, postback: { payload: "TU_VAN" } });
  assert.match(t.texts()[0], /không gian nào/);
  await t.bot.handleEvent(msg("U2", "Phòng khách", { quick_reply: { payload: "KG:Phòng khách" } }));
  assert.equal(t.aiCalls.length, 1);
  assert.match(t.aiCalls[0].at(-1).content, /Phòng khách/);
  assert.match(t.texts().at(-1), /9W/);
});

test("câu hỏi tự do → AI trả lời, có nút Menu/Gặp nhân viên", async () => {
  const t = setup();
  await t.bot.handleEvent(msg("U3", "Đèn âm trần Panasonic 9W giá bao nhiêu?"));
  assert.equal(t.aiCalls.length, 1);
  const last = t.sent.filter((b) => b.message).at(-1).message;
  assert.deepEqual(last.quick_replies.map((q) => q.payload), ["MENU", "NHAN_VIEN"]);
});

test("AI yêu cầu chuyển nhân viên → bot tạm dừng, không trả lời tiếp", async () => {
  const t = setup({ aiImpl: () => ({ text: "Dạ em chuyển nhân viên ạ.", handoff: true }) });
  await t.bot.handleEvent(msg("U4", "Tôi muốn mua 200 bộ cho công trình"));
  assert.ok(t.store.isPaused("U4"));
  const before = t.sent.length;
  await t.bot.handleEvent(msg("U4", "Alo shop ơi"));
  assert.equal(t.sent.length, before);
});

test("khách gõ 'gặp nhân viên' → chuyển ngay, có hotline", async () => {
  const t = setup();
  await t.bot.handleEvent(msg("U5", "cho mình gặp nhân viên"));
  assert.match(t.texts().at(-1), /0908 53 53 53/);
  assert.ok(t.store.isPaused("U5"));
  assert.equal(t.aiCalls.length, 0);
});

test("nhân viên nhắn tay → bot dừng; gõ #bot → bot chạy lại", async () => {
  const t = setup();
  await t.bot.handleEvent({ sender: { id: "PAGE" }, recipient: { id: "U6" }, message: { mid: "e1", is_echo: true, text: "Chào anh, em là Hoài" } });
  assert.ok(t.store.isPaused("U6"));
  await t.bot.handleEvent({ sender: { id: "PAGE" }, recipient: { id: "U6" }, message: { mid: "e2", is_echo: true, text: "#bot" } });
  assert.ok(!t.store.isPaused("U6"));
  // echo của chính bot không làm dừng bot
  await t.bot.handleEvent({ sender: { id: "PAGE" }, recipient: { id: "U6" }, message: { mid: "e3", is_echo: true, text: "x", metadata: "alp-bot" } });
  assert.ok(!t.store.isPaused("U6"));
});

test("mua số lượng lớn → ghi nhận rồi chuyển nhân viên", async () => {
  const t = setup();
  await t.bot.handleEvent({ sender: { id: "U7" }, postback: { payload: "SL_LON" } });
  await t.bot.handleEvent(msg("U7", "50 bộ đèn led tube, 0901234567"));
  assert.match(t.texts().at(-1), /đã ghi nhận/);
  assert.ok(t.store.isPaused("U7"));
  assert.equal(t.aiCalls.length, 0);
});

test("bảo hành khi chính sách còn trống → chuyển nhân viên, không bịa", async () => {
  const t = setup();
  await t.bot.handleEvent({ sender: { id: "U8" }, postback: { payload: "BAO_HANH" } });
  assert.match(t.texts().at(-1), /nhân viên/);
});

test("tin nhắn trùng (Facebook gửi lại) chỉ xử lý 1 lần", async () => {
  const t = setup();
  const m = msg("U9", "đèn ốp trần");
  await t.bot.handleEvent(m); await t.bot.handleEvent(m);
  assert.equal(t.aiCalls.length, 1);
});

test("AI lỗi → xin lỗi + hotline, không im lặng", async () => {
  const t = setup({ aiImpl: () => { throw new Error("timeout"); } });
  await t.bot.handleEvent(msg("U10", "đèn nào sáng nhất"));
  assert.match(t.texts().at(-1), /hotline/);
});

test("vượt hạn mức AI/giờ → chuyển nhân viên", async () => {
  const t = setup();
  for (let i = 0; i < 4; i++) { t.store.resume("U11"); await t.bot.handleEvent(msg("U11", "câu " + i)); }
  assert.equal(t.aiCalls.length, 3);
  assert.ok(t.store.isPaused("U11"));
});

test("không có AI key → vẫn trả lời bằng kịch bản", async () => {
  const t = setup({ aiImpl: null });
  await t.bot.handleEvent(msg("U12", "đèn nào tốt"));
  assert.match(t.texts().at(-1), /nhân viên sẽ trả lời/);
});

test("nhận ảnh → chuyển nhân viên", async () => {
  const t = setup();
  await t.bot.handleEvent({ sender: { id: "U13" }, message: { mid: "img1", attachments: [{ type: "image", payload: { url: "x" } }] } });
  assert.match(t.texts().at(-1), /hình ảnh/);
});

test("đọc CSV từ Excel (chấm phẩy, ngoặc kép, BOM)", () => {
  const rows = parseCsv('﻿ma_sp;ten_san_pham;gia_ban\r\nNNP1;"Đèn LED; 9W";120000\r\n');
  assert.deepEqual(rows, [{ ma_sp: "NNP1", ten_san_pham: "Đèn LED; 9W", gia_ban: "120000" }]);
  assert.match(catalogText(rows), /gia_ban=120000/);
  assert.match(catalogText([]), /CHƯA/);
});

test("chia tin nhắn dài > 2000 ký tự", () => {
  const parts = splitText("a ".repeat(3000));
  assert.ok(parts.length >= 3 && parts.every((p) => p.length <= 1900));
});

test("AI: gộp tin cùng vai trò, tách thẻ chuyển nhân viên, prompt có luật", async () => {
  let req;
  const client = { messages: { create: async (r) => { req = r; return { content: [{ type: "text", text: "Dạ **ok** [[NHAN_VIEN]]" }] }; } } };
  const ai = createAi({ model: "m", maxTokens: 100, shop, catalog: "(trống)", client });
  const r = await ai.reply([{ role: "assistant", content: "chào" }, { role: "user", content: "a" }, { role: "user", content: "b" }]);
  assert.deepEqual(r, { text: "Dạ ok", handoff: true });
  assert.equal(req.messages.length, 1);
  assert.equal(req.messages[0].content, "a\nb");
  const sp = buildSystemPrompt(shop, "x");
  assert.match(sp, /KHÔNG bịa giá/);
  assert.match(sp, /anh\/chị/);
  assert.match(sp, /Opple CHƯA bán/);
});
