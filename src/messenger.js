// Gửi tin nhắn qua Messenger Send API.
const BOT_TAG = "alp-bot"; // gắn vào mọi tin bot gửi, để phân biệt với tin nhân viên gõ tay

function splitText(text, max = 1900) {
  const parts = [];
  let rest = String(text || "").trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

function createMessenger({ pageAccessToken, graphVersion, fetchImpl = fetch, logger = console }) {
  const url = `https://graph.facebook.com/${graphVersion}/me/messages`;

  async function call(body) {
    const res = await fetchImpl(`${url}?access_token=${encodeURIComponent(pageAccessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      logger.error(`[messenger] Gửi thất bại ${res.status}: ${t.slice(0, 300)}`);
    }
    return res;
  }

  async function typing(psid) {
    return call({ recipient: { id: psid }, sender_action: "typing_on" });
  }

  // quickReplies: [{ title, payload }] — tối đa 13 nút, tiêu đề ≤ 20 ký tự
  async function sendText(psid, text, quickReplies) {
    const parts = splitText(text);
    for (let i = 0; i < parts.length; i++) {
      const message = { text: parts[i], metadata: BOT_TAG };
      if (quickReplies && quickReplies.length && i === parts.length - 1) {
        message.quick_replies = quickReplies.slice(0, 13).map((q) => ({
          content_type: "text",
          title: q.title.slice(0, 20),
          payload: q.payload,
        }));
      }
      await call({ recipient: { id: psid }, messaging_type: "RESPONSE", message });
    }
  }

  return { sendText, typing, call };
}

module.exports = { createMessenger, splitText, BOT_TAG };
