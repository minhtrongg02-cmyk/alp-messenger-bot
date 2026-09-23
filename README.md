# Chatbot Messenger – An Lạc Phát

Bot tự trả lời tin nhắn Fanpage: **kịch bản nút bấm** cho câu hỏi thường gặp + **AI (Claude)** cho câu hỏi tự do + **chuyển nhân viên** khi cần.

## Bot làm được gì

| Khách làm | Bot phản hồi |
|---|---|
| Nhắn "chào", bấm Bắt đầu | Lời chào + 6 nút: Tư vấn chọn đèn, Báo giá, Mua Shopee/TikTok, Mua số lượng lớn, Bảo hành/đổi trả, Gặp nhân viên |
| Bấm "Tư vấn chọn đèn" | Hỏi không gian (phòng khách, bếp, nhà xưởng…) → AI tư vấn tiếp |
| Hỏi tự do ("đèn âm trần 9W giá bao nhiêu?") | AI trả lời **chỉ dựa trên dữ liệu shop** — không bịa giá, không tự giảm giá |
| Mua ít, hàng có trên sàn | Gửi link Shopee / TikTok Shop |
| Mua số lượng lớn / công trình | Xin sản phẩm + số lượng + SĐT → chuyển nhân viên |
| Muốn gặp người thật, khiếu nại, gửi ảnh | Chuyển nhân viên + gửi hotline, **bot im lặng 12 giờ** với khách đó |
| Nhân viên tự nhắn trong hộp thư | Bot tự động im lặng 12 giờ với khách đó |
| Nhân viên gõ `#bot` trong hộp thư | Bật lại bot cho khách đó |

---

# HƯỚNG DẪN CÀI ĐẶT (từng bước)

> Tổng thời gian: khoảng 1–2 giờ làm việc + thời gian chờ Meta duyệt (vài ngày đến vài tuần).
> Bước nào vướng, chụp màn hình gửi Claude để được hướng dẫn tiếp.

## Bước 1 – Điền dữ liệu shop (quan trọng nhất)

**a) `data/shop.json`** – ✅ đã điền: địa chỉ, giờ làm việc, bảo hành, đổi trả, giao hàng, thanh toán, VAT, ngưỡng số lượng lớn (5), kiến thức tư vấn từ tab FAQ.
Muốn sửa: mở bằng Notepad/VS Code. Mục nào để trống `""` → bot **không tự trả lời** mà chuyển nhân viên (an toàn, không bịa).

**b) `data/products.csv`** – danh sách sản phẩm cho AI tra cứu. **Đã tạo sẵn 77 sản phẩm** từ tab PRODUCT_MASTER (bỏ 2 dòng combo nháp).
File chỉ chứa thông tin được phép cho khách xem: tên, mã, thương hiệu, loại, giá Shopee/TikTok (làm tròn nghìn), còn/hết hàng, màu. **Không** có giá nhập, lợi nhuận, số tồn kho.
Khi cập nhật giá/tồn kho trong Excel: gửi file cho Claude tạo lại, hoặc tự chạy
`python scripts/excel_to_csv.py "Plan Shopee An Lạc Phát Lighting.xlsx"` rồi đưa file mới lên GitHub.

> ⚠️ Giá trong file này là giá bot báo cho khách (ghi rõ là giá tham khảo trên sàn).

## Bước 2 – Lấy khóa AI (Claude API)

1. Vào **console.anthropic.com** → đăng ký → nạp tiền (trả trước theo mức dùng).
2. Mục **API Keys** → Create Key → copy (dạng `sk-ant-...`). Giữ bí mật, không gửi cho ai.
3. Nên đặt **giới hạn chi tiêu hằng tháng** trong phần Billing/Limits để không phát sinh ngoài dự kiến.

Model mặc định là `claude-haiku-4-5` (rẻ, nhanh, đủ cho CSKH). Kiểm tra giá hiện tại trên trang Anthropic.

## Bước 3 – Đưa code lên GitHub

1. Tạo tài khoản github.com → **New repository** → chọn **Private** → tên `alp-messenger-bot`.
2. Kéo thả toàn bộ thư mục này lên (trừ `node_modules` và file `.env` nếu có).

## Bước 4 – Chạy bot trên Render

1. Vào **render.com** → đăng nhập bằng GitHub → **New → Web Service** → chọn repo `alp-messenger-bot`.
2. Cấu hình: Runtime **Node**, Build Command `npm install`, Start Command `npm start`.
3. Gói: gói **Free sẽ "ngủ" khi không có truy cập** → khách nhắn phải chờ lâu, có thể mất tin. Nên chọn gói trả phí thấp nhất (xem giá trên Render).
4. Mục **Environment** → thêm biến (tạm thời để trống 2 biến của Facebook, điền ở Bước 5):
   - `ANTHROPIC_API_KEY` = khóa ở Bước 2
   - `VERIFY_TOKEN` = tự đặt 1 chuỗi bất kỳ, ví dụ `alp-2026-xacminh`
   - `PAGE_ACCESS_TOKEN` = (Bước 5)
   - `APP_SECRET` = (Bước 5)
5. Deploy → Render cho 1 địa chỉ dạng `https://alp-messenger-bot.onrender.com`. Mở địa chỉ đó thấy dòng **"An Lạc Phát Messenger bot đang chạy ✅"** là được.

## Bước 5 – Tạo ứng dụng Meta và nối với Fanpage

1. Vào **developers.facebook.com** bằng tài khoản Facebook là **quản trị viên Fanpage** → Ứng dụng của tôi → **Tạo ứng dụng**.
2. Chọn trường hợp sử dụng liên quan đến **Messenger** / tương tác khách hàng (tên mục Meta đặt có thể thay đổi), liên kết với Business Manager của công ty nếu có.
3. Trong phần cài đặt **Messenger API**:
   - **Tạo mã truy cập (Access Token)** cho Fanpage An Lạc Phát → copy → dán vào `PAGE_ACCESS_TOKEN` trên Render.
   - **Cấu hình Webhook**:
     - Callback URL: `https://<địa-chỉ-render>/webhook`
     - Verify token: đúng chuỗi `VERIFY_TOKEN` đã đặt
     - Bấm Xác minh và lưu.
   - **Đăng ký trường webhook** cho Fanpage: tích `messages`, `messaging_postbacks`, `message_echoes`.
4. **Cài đặt ứng dụng → Cơ bản → Khóa bí mật của ứng dụng** → copy → dán vào `APP_SECRET` trên Render.
5. Render sẽ tự khởi động lại bot.

## Bước 6 – Cài nút "Bắt đầu" và menu ☰

Trên Render → mục **Shell** của service → gõ:
```
npm run setup-profile
```
Thấy `200 {"result":"success"}` là xong.

## Bước 7 – Chạy thử

Dùng tài khoản Facebook là **admin của app/Fanpage** nhắn cho Fanpage. Ở chế độ phát triển, bot **chỉ trả lời admin/tester**, khách thật chưa thấy — đây là bình thường.
Thử: "chào", bấm các nút, hỏi giá 1 mã có trong CSV, hỏi 1 mã không có, "cho mình gặp nhân viên", nhắn tay từ hộp thư rồi gõ `#bot`.

## Bước 8 – Xin Meta duyệt để trả lời khách thật

1. Trong app → **Xét duyệt ứng dụng** → yêu cầu quyền **`pages_messaging`** (quyền truy cập nâng cao). Meta có thể yêu cầu thêm các quyền liên quan đến Fanpage.
2. **Xác minh doanh nghiệp** trong Business Manager (giấy phép kinh doanh, MST 0311944829, website, email tên miền nếu có).
3. Chuẩn bị: video quay màn hình bot hoạt động, mô tả cách dùng, link **Chính sách quyền riêng tư** (có thể đặt trên anlacphat.com – Claude có thể soạn giúp).
4. Được duyệt → chuyển app sang chế độ **Live (Công khai)**.

## Bước 9 – Lưu ý khi vận hành

- **Tắt trả lời tự động cũ** trong Meta Business Suite (nếu có) để khách không nhận 2 câu trả lời.
- Khi bot báo "đã chuyển nhân viên", nhân viên vào **Hộp thư Meta Business Suite** trả lời. Bot tự im lặng 12 giờ với khách đó. Xong việc muốn bot hỗ trợ tiếp → gõ `#bot`.
- Theo dõi log trên Render: dòng `CHUYỂN NHÂN VIÊN` và `KHÁCH SỐ LƯỢNG LỚN` cho biết khách cần xử lý.
- Quy định Meta: bot chỉ được nhắn khách trong **24 giờ** kể từ tin nhắn cuối của khách.
- Đổi giá/sản phẩm/chính sách: sửa file trong `data/` trên GitHub → Render tự cập nhật.
- Đọc lại hội thoại định kỳ, câu nào bot trả lời chưa tốt gửi Claude để chỉnh lại hướng dẫn trong `src/ai.js`.

## Giới hạn hiện tại

- Hội thoại lưu trong bộ nhớ: khi bot khởi động lại, khách không mất tin nhắn nhưng bot quên ngữ cảnh cũ và trạng thái "im lặng".
- Bot chưa đọc nội dung ảnh (nhận ảnh → chuyển nhân viên).
- Chưa tự gửi thông báo cho nhân viên qua Zalo/Telegram (có thể bổ sung).

---

## Dành cho lập trình viên

```
npm install
cp .env.example .env   # điền biến
npm test               # 18 kiểm thử, giả lập Facebook + AI, không cần mạng
npm start
```
Cấu trúc: `src/app.js` (webhook + kiểm tra chữ ký X-Hub-Signature-256), `src/bot.js` (kịch bản, chuyển nhân viên), `src/ai.js` (system prompt + Claude API), `src/messenger.js` (Send API), `src/store.js` (trạng thái), `data/` (dữ liệu shop).
Tham khảo ý tưởng webhook từ repo `yuvayt/SE04-Nhom24.2`; mã nguồn viết mới hoàn toàn.
