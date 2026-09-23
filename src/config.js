require("dotenv").config({ quiet: true });

// Đọc biến môi trường, tự bỏ dấu cách / xuống dòng thừa (hay bị dính khi copy-paste)
function str(name) {
  return String(process.env[name] || "").replace(/[\s\u200B-\u200D\uFEFF]+/g, " ").trim();
}

function num(name, def) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== "" ? v : def;
}

module.exports = {
  port: num("PORT", 3000),

  // Meta / Facebook
  pageAccessToken: str("PAGE_ACCESS_TOKEN"),
  verifyToken: str("VERIFY_TOKEN"),
  appSecret: str("APP_SECRET"),
  graphVersion: process.env.GRAPH_API_VERSION || "v23.0",

  // AI (Claude)
  anthropicApiKey: str("ANTHROPIC_API_KEY"),
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
  aiMaxTokens: num("AI_MAX_TOKENS", 700),

  // AI (Google Gemini) — nếu có GEMINI_API_KEY thì bot dùng Gemini
  geminiApiKey: str("GEMINI_API_KEY"),
  geminiModel: str("GEMINI_MODEL") || "gemini-flash-latest",

  // Hành vi bot
  historyTurns: num("HISTORY_TURNS", 12), // số tin nhắn gần nhất gửi cho AI
  historyTtlHours: num("HISTORY_TTL_HOURS", 24), // quên hội thoại sau N giờ im lặng
  pauseHours: num("BOT_PAUSE_HOURS", 12), // bot im lặng bao lâu sau khi nhân viên vào chat
  aiLimitPerHour: num("AI_LIMIT_PER_HOUR", 30), // chống spam / tốn phí AI
  replyDelayMs: num("REPLY_DELAY_MS", 0),
};
