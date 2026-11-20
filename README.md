# Web Workflow Utility

Userscript hỗ trợ một số thao tác trong SSV Farm và cung cấp Guild Chat.

## Cài đặt

Cài Tampermonkey, sau đó chọn **một** phiên bản:

- [Bản thành viên](https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/script.user.js)
- [Bản admin](https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/script.admin.user.js)

Tải lại trang game và mở bảng điều khiển bằng biểu tượng ngôi sao.

## Thiết lập Guild Chat

Admin cần cấu hình Firebase một lần:

1. Bật **Anonymous Authentication** và tạo **Realtime Database**.
2. Đăng nội dung mới nhất trong [`firebase.database.rules.json`](./firebase.database.rules.json) lên **Realtime Database → Rules** trước khi cập nhật userscript.
3. Tạo mã mời 16–64 ký tự không dấu, gồm chữ cái A–Z, số và dấu gạch ngang giữa các cụm, tại `guildInvites/<INVITE_CODE>`. Ví dụ định dạng: `HOI-LUOI-BIEN-2026-7K4P` (không dùng ví dụ này làm mã thật):

   ```json
   {
     "guildId": "your-guild",
     "enabled": true
   }
   ```

Giữ mã mời riêng tư; đặt `enabled` thành `false` để thu hồi. Không đưa Firebase Service Account key hoặc thông tin quản trị vào userscript. Quyền truy cập dữ liệu được kiểm soát bằng Firebase Security Rules.

## Sử dụng

Mở **Chung → Guild Chat**, nhập tên hiển thị (2–12 ký tự), mã mời và chọn avatar; bỏ qua avatar để được chọn ngẫu nhiên. Thành viên cần cài userscript và dùng cùng mã mời.

## Cập nhật

Kiểm tra cập nhật trong Tampermonkey Dashboard hoặc cài lại từ các liên kết phía trên. Khi phát hành phiên bản mới, cập nhật `guild-chat.js`, userscript và metadata trên GitHub; đồng bộ giá trị `@version`.
