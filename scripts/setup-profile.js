// Chạy 1 lần: npm run setup-profile
// Cài nút "Bắt đầu", lời chào và menu cố định (☰) cho Fanpage.
const config = require("../src/config");

const body = {
  get_started: { payload: "GET_STARTED" },
  greeting: [
    {
      locale: "default",
      text: "Chào {{user_first_name}}! An Lạc Phát - thiết bị điện & đèn LED chính hãng. Bấm Bắt đầu để được tư vấn nhanh ạ.",
    },
  ],
  persistent_menu: [
    {
      locale: "default",
      composer_input_disabled: false,
      call_to_actions: [
        { type: "postback", title: "💡 Tư vấn chọn đèn", payload: "TU_VAN" },
        { type: "postback", title: "💰 Báo giá", payload: "BAO_GIA" },
        { type: "postback", title: "📦 Mua số lượng lớn", payload: "SL_LON" },
        { type: "postback", title: "👤 Gặp nhân viên", payload: "NHAN_VIEN" },
        { type: "web_url", title: "🌐 Website", url: "https://anlacphat.com" },
      ],
    },
  ],
};

(async () => {
  if (!config.pageAccessToken) {
    console.error("Thiếu PAGE_ACCESS_TOKEN trong file .env");
    process.exit(1);
  }
  const url = `https://graph.facebook.com/${config.graphVersion}/me/messenger_profile?access_token=${encodeURIComponent(config.pageAccessToken)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(res.status, await res.text());
})();
