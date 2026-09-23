const config = require("./config");
const { loadShop, loadProducts, catalogText } = require("./data");
const { MemoryStore } = require("./store");
const { createMessenger } = require("./messenger");
const { createAi } = require("./ai");
const { createBot } = require("./bot");
const { createApp } = require("./app");

const missing = ["PAGE_ACCESS_TOKEN", "VERIFY_TOKEN", "APP_SECRET"].filter((k) => !process.env[k]);
if (missing.length) console.warn(`⚠️  Thiếu biến môi trường: ${missing.join(", ")}`);

const shop = loadShop();
const products = loadProducts();
console.log(`Đã nạp ${products.length} sản phẩm.`);

const ai = config.anthropicApiKey
  ? createAi({
      apiKey: config.anthropicApiKey,
      model: config.anthropicModel,
      maxTokens: config.aiMaxTokens,
      shop,
      catalog: catalogText(products),
    })
  : null;
if (!ai) console.warn("⚠️  Chưa có ANTHROPIC_API_KEY → bot chỉ chạy kịch bản, không có AI.");

const store = new MemoryStore(config);
const messenger = createMessenger(config);
const bot = createBot({ config, shop, store, messenger, ai });
const app = createApp({ config, bot });

app.listen(config.port, () => console.log(`Bot đang chạy ở cổng ${config.port}`));
