require("dotenv").config({ quiet: true });

function num(name, def) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== "" ? v : def;
}

module.exports = {
  port: num("PORT", 3000),

  // Meta / Facebook
  pageAccessToken: process.env.PAGE_ACCESS_TOKEN || "",
  verifyToken: process.env.VERIFY_TOKEN || "",
  appSecret: process.env.APP_SECRET || "",
  graphVersion: process.env.GRAPH_API_VERSION || "v23.0",

  // AI (Claude)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
  aiMaxTokens: num("AI_MAX_TOKENS", 700),

  // Hành vi bot
  historyTurns: num("HISTORY_TURNS", 12), // số tin nhắn gần nhất gửi cho AI
  historyTtlHours: num("HISTORY_TTL_HOURS", 24), // quên hội thoại sau N giờ im lặng
  pauseHours: num("BOT_PAUSE_HOURS", 12), // bot im lặng bao lâu sau khi nhân viên vào chat
  aiLimitPerHour: num("AI_LIMIT_PER_HOUR", 30), // chống spam / tốn phí AI
  replyDelayMs: num("REPLY_DELAY_MS", 0),
};
