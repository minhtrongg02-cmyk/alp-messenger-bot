const config = require("./config");
const { loadShop, loadProducts, loadFaq, catalogText } = require("./data");
const { MemoryStore } = require("./store");
const { createMessenger } = require("./messenger");
const { createAi, createGeminiAi } = require("./ai");
const { createBot } = require("./bot");
const { createApp } = require("./app");

const missing = ["PAGE_ACCESS_TOKEN", "VERIFY_TOKEN", "APP_SECRET"].filter((k) => !process.env[k]);
if (missing.length) console.warn(`⚠️  Thiếu biến môi trường: ${missing.join(", ")}`);

const shop = loadShop();
const products = loadProducts();
console.log(`Đã nạp ${products.length} sản phẩm.`);

const faq = loadFaq();
console.log(`Đã nạp ${faq.length} câu trả lời mẫu.`);
const common = { maxTokens: config.aiMaxTokens, shop, catalog: catalogText(products), faq };
let ai = null;
if (config.geminiApiKey) {
  ai = createGeminiAi({ ...common, apiKey: config.geminiApiKey, model: config.geminiModel });
  console.log(`AI: Google Gemini (${config.geminiModel})`);
} else if (config.anthropicApiKey) {
  ai = createAi({ ...common, apiKey: config.anthropicApiKey, model: config.anthropicModel });
  console.log(`AI: Claude (${config.anthropicModel})`);
} else {
  console.warn("⚠️  Chưa có GEMINI_API_KEY hoặc ANTHROPIC_API_KEY → bot chỉ chạy kịch bản, không có AI.");
}

const store = new MemoryStore(config);
const messenger = createMessenger(config);
const bot = createBot({ config, shop, store, messenger, ai });
const app = createApp({ config, bot });

app.listen(config.port, () => console.log(`Bot đang chạy ở cổng ${config.port}`));
