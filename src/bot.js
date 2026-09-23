// Bộ não của bot: kịch bản nút bấm + AI + chuyển nhân viên.
const { BOT_TAG } = require("./messenger");
const { hotlineText } = require("./ai");

const MAIN_MENU = [
  { title: "💡 Tư vấn chọn đèn", payload: "TU_VAN" },
  { title: "💰 Báo giá", payload: "BAO_GIA" },
  { title: "🛒 Mua Shopee/TikTok", payload: "MUA_ONLINE" },
  { title: "📦 Mua số lượng lớn", payload: "SL_LON" },
  { title: "🛡️ Bảo hành/đổi trả", payload: "BAO_HANH" },
  { title: "👤 Gặp nhân viên", payload: "NHAN_VIEN" },
];

const AFTER_AI = [
  { title: "📋 Menu", payload: "MENU" },
  { title: "👤 Gặp nhân viên", payload: "NHAN_VIEN" },
];

const SPACES = ["Phòng khách", "Phòng ngủ", "Nhà bếp", "Văn phòng", "Cửa hàng", "Nhà xưởng", "Ngoài trời"];

const RE_MENU = /^\s*(menu|bắt đầu|start|hi|hello|chào|xin chào|alo)\s*[.!]*\s*$/i;
const RE_HUMAN = /(gặp|nói chuyện với|cho (tôi|mình|em) gặp).{0,15}(nhân viên|người thật|tư vấn viên|admin|quản lý)|^\s*(nhân viên|người thật)\s*$/i;
const RESUME_CMD = "#bot"; // nhân viên gõ "#bot" trong hộp thư để bật lại bot cho khách đó

function createBot({ config, shop, store, messenger, ai, logger = console }) {
  const hotline = hotlineText(shop);
  const queues = new Map(); // xử lý tuần tự từng khách để không trả lời lộn thứ tự

  function enqueue(psid, fn) {
    const prev = queues.get(psid) || Promise.resolve();
    const next = prev.then(fn).catch((e) => logger.error("[bot] Lỗi xử lý:", e && e.message));
    queues.set(psid, next);
    next.finally(() => { if (queues.get(psid) === next) queues.delete(psid); });
    return next;
  }

  async function say(psid, text, qr) {
    store.addHistory(psid, "assistant", text);
    await messenger.sendText(psid, text, qr);
  }

  async function handoff(psid, intro) {
    const text = `${intro ? intro + "\n\n" : ""}Dạ em đã báo nhân viên, anh/chị vui lòng đợi trong giây lát, nhân viên sẽ phản hồi sớm nhất ạ 🙏\nNếu cần gấp, anh/chị gọi hotline/Zalo: ${hotline}.`;
    await say(psid, text);
    store.pause(psid, config.pauseHours);
    logger.log(`[bot] CHUYỂN NHÂN VIÊN: khách ${psid}`);
  }

  async function greet(psid) {
    await say(
      psid,
      `Dạ ${shop.ten_goi_tat} xin chào anh/chị 👋\nEm là trợ lý tự động của shop, chuyên thiết bị điện và đèn LED chính hãng Panasonic, Philips, Megaman, Nanoco, Opple...\nAnh/chị chọn nội dung bên dưới hoặc nhắn trực tiếp câu hỏi cho em nhé!`,
      MAIN_MENU
    );
  }

  async function handlePayload(psid, payload) {
    const u = store.get(psid);
    u.step = null;
    switch (payload) {
      case "GET_STARTED":
      case "MENU":
        return greet(psid);

      case "TU_VAN":
        store.addHistory(psid, "user", "Tôi cần tư vấn chọn đèn.");
        return say(
          psid,
          "Dạ anh/chị cần lắp đèn cho không gian nào ạ?",
          SPACES.map((s) => ({ title: s, payload: `KG:${s}` }))
        );

      case "BAO_GIA":
        store.addHistory(psid, "user", "Tôi muốn hỏi giá.");
        return say(psid, "Dạ anh/chị gửi em tên hoặc mã sản phẩm (có thể gửi kèm ảnh) và số lượng cần mua, em báo giá ngay ạ.");

      case "MUA_ONLINE": {
        store.addHistory(psid, "user", "Tôi muốn mua trên Shopee/TikTok.");
        const chua = (shop.thuong_hieu_chua_len_san || []).join(", ");
        return say(
          psid,
          `Dạ anh/chị có thể đặt hàng chính hãng tại:\n🛒 Shopee: ${shop.shopee}\n🎵 TikTok Shop: ${shop.tiktok}\n\n` +
            (chua ? `Riêng hàng ${chua} hiện chưa lên sàn, anh/chị nhắn em để đặt trực tiếp nhé.` : ""),
          AFTER_AI
        );
      }

      case "SL_LON":
        store.addHistory(psid, "user", "Tôi muốn mua số lượng lớn.");
        u.step = "SL_LON";
        return say(
          psid,
          "Dạ đơn số lượng lớn, công trình hoặc đại lý sẽ được nhân viên báo giá riêng ạ.\nAnh/chị nhắn giúp em trong 1 tin: sản phẩm cần mua, số lượng và số điện thoại liên hệ nhé."
        );

      case "BAO_HANH": {
        store.addHistory(psid, "user", "Tôi muốn hỏi về bảo hành/đổi trả.");
        const parts = [];
        if (shop.chinh_sach_bao_hanh) parts.push(`🛡️ Bảo hành: ${shop.chinh_sach_bao_hanh}`);
        if (shop.chinh_sach_doi_tra) parts.push(`🔄 Đổi trả: ${shop.chinh_sach_doi_tra}`);
        if (!parts.length) return handoff(psid, "Dạ về bảo hành/đổi trả, nhân viên sẽ kiểm tra theo đơn hàng và tư vấn chính xác cho anh/chị ạ.");
        return say(psid, `Dạ chính sách của shop:\n${parts.join("\n")}\n\nNếu sản phẩm đang gặp lỗi, anh/chị bấm "Gặp nhân viên" để được hỗ trợ ngay ạ.`, AFTER_AI);
      }

      case "NHAN_VIEN":
        store.addHistory(psid, "user", "Tôi muốn gặp nhân viên.");
        return handoff(psid);

      default:
        if (payload && payload.startsWith("KG:")) {
          return askAi(psid, `Tôi cần tư vấn đèn cho ${payload.slice(3)}.`);
        }
        return greet(psid);
    }
  }

  async function askAi(psid, text) {
    store.addHistory(psid, "user", text);
    if (!ai) {
      return say(psid, `Dạ em đã nhận câu hỏi, nhân viên sẽ trả lời anh/chị sớm ạ. Cần gấp anh/chị gọi ${hotline} nhé.`, MAIN_MENU);
    }
    if (!store.allowAi(psid, config.aiLimitPerHour)) {
      return handoff(psid);
    }
    messenger.typing(psid).catch(() => {});
    let result;
    try {
      result = await ai.reply(store.get(psid).history);
    } catch (e) {
      logger.error("[bot] Lỗi AI:", e && e.message);
      return handoff(psid, "Dạ hệ thống tư vấn tự động đang bận một chút ạ.");
    }
    if (!result.text) return handoff(psid);
    if (result.handoff) {
      store.addHistory(psid, "assistant", result.text);
      await messenger.sendText(psid, result.text);
      store.pause(psid, config.pauseHours);
      logger.log(`[bot] CHUYỂN NHÂN VIÊN (AI đề xuất): khách ${psid}`);
      return;
    }
    return say(psid, result.text, AFTER_AI);
  }

  async function handleText(psid, text) {
    const u = store.get(psid);
    if (u.step === "SL_LON") {
      u.step = null;
      store.addHistory(psid, "user", text);
      logger.log(`[bot] KHÁCH SỐ LƯỢNG LỚN ${psid}: ${text.slice(0, 300)}`);
      return handoff(psid, "Dạ em đã ghi nhận yêu cầu của anh/chị.");
    }
    if (RE_MENU.test(text) && u.history.length === 0) return greet(psid);
    if (/^\s*menu\s*$/i.test(text)) return greet(psid);
    if (RE_HUMAN.test(text)) {
      store.addHistory(psid, "user", text);
      return handoff(psid);
    }
    return askAi(psid, text);
  }

  // Xử lý 1 sự kiện messaging từ webhook
  async function handleEvent(ev) {
    const msg = ev.message;

    // Tin do Fanpage gửi đi (echo): của bot → bỏ qua; của nhân viên gõ tay → tạm dừng bot
    if (msg && msg.is_echo) {
      if (msg.metadata === BOT_TAG) return;
      const customer = ev.recipient && ev.recipient.id;
      if (!customer) return;
      if ((msg.text || "").trim().toLowerCase() === RESUME_CMD) {
        store.resume(customer);
        logger.log(`[bot] Nhân viên bật lại bot cho khách ${customer}`);
      } else {
        store.pause(customer, config.pauseHours);
      }
      return;
    }

    const psid = ev.sender && ev.sender.id;
    if (!psid) return;
    if (msg && store.markSeen(msg.mid)) return;

    return enqueue(psid, async () => {
      if (store.isPaused(psid)) return; // nhân viên đang xử lý, bot im lặng

      if (ev.postback) return handlePayload(psid, ev.postback.payload);
      if (!msg) return;
      if (msg.quick_reply && msg.quick_reply.payload) return handlePayload(psid, msg.quick_reply.payload);

      const text = (msg.text || "").trim().slice(0, 1500);
      if (text) return handleText(psid, text);

      if (msg.attachments && msg.attachments.length) {
        const type = msg.attachments[0].type;
        if (type === "image" && !msg.sticker_id) {
          store.addHistory(psid, "user", "(Khách gửi một hình ảnh)");
          return handoff(psid, "Dạ em đã nhận được hình ảnh của anh/chị.");
        }
        if (msg.sticker_id) return say(psid, "Dạ 😊 Anh/chị cần em hỗ trợ gì ạ?", MAIN_MENU);
        return say(psid, "Dạ anh/chị vui lòng nhắn nội dung bằng chữ giúp em nhé, hoặc bấm Gặp nhân viên ạ.", MAIN_MENU);
      }
    });
  }

  return { handleEvent, MAIN_MENU };
}

module.exports = { createBot, MAIN_MENU, RESUME_CMD };
