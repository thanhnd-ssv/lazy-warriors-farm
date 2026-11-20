# Web Workflow Utility

## Cài đặt tool

Cài Tampermonkey, sau đó chọn đúng phiên bản:

- **Thành viên:** [Cài bản giới hạn Ruộng/Chuồng](https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/script.user.js)
- **Admin:** [Cài bản đầy đủ](https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm/refs/heads/main/script.admin.user.js)

Chỉ cài một phiên bản. Mở trang game, bấm biểu tượng ngôi sao để mở bảng điều khiển.

## Thiết lập Guild Chat (admin làm một lần)

1. Trong Firebase project `web-workflow-utility-chat`, bật **Authentication → Sign-in method → Anonymous**.
2. Tạo hoặc mở Realtime Database ở chế độ khóa.
3. Vào **Realtime Database → Rules**, thay nội dung bằng file [`firebase.database.rules.json`](./firebase.database.rules.json), rồi bấm **Publish**.
4. Trong tab **Data**, tạo một mã mời ngẫu nhiên dài 32 ký tự chữ in hoa/số tại `guildInvites/<MA_MOI>`, ví dụ:

   ```json
   {
     "guildId": "web-workflow",
     "enabled": true
   }
   ```

   Thay `<MA_MOI>` bằng mã bí mật thực tế; không dùng ví dụ làm mã thật. Chỉ chia sẻ mã này với thành viên. Tắt mã bằng cách đặt `enabled` thành `false`.

Mã mời chỉ cho phép tham gia hội, không cấp quyền quản trị Firebase. Không đưa Service Account key hoặc thông tin đăng nhập quản trị vào userscript. Firebase Web config trong `guild-chat.js` là cấu hình client; quyền truy cập dữ liệu được giới hạn bằng Security Rules.

## Thành viên sử dụng

1. Cài một trong hai bản ở trên và tải lại trang game.
2. Mở bảng điều khiển, vào **Chung → Guild Chat**.
3. Nhập nickname (2–24 ký tự) và mã mời, rồi bấm **Join Guild**.
4. Thành viên khác làm tương tự trên trình duyệt/máy tính của họ. Chat tải tối đa 150 tin nhắn gần nhất, có số tin chưa đọc, âm thanh bật/tắt và tự kết nối lại.

Anonymous Authentication tạo UID riêng theo trình duyệt. Nếu đổi máy hoặc xóa dữ liệu trình duyệt, hãy tham gia lại bằng mã mời; UID ngắn cạnh nickname giúp phân biệt người trùng tên.

## Giới hạn và bảo trì

- Tool chỉ hiển thị/tải 150 tin gần nhất; dữ liệu cũ hơn vẫn nằm trong Realtime Database và không tự xóa. Admin cần chủ động dọn dữ liệu cũ nếu cần.
- Giới hạn gửi 1,5 giây là phía client, không phải cơ chế chống spam bảo đảm trước người cố tình sửa script.
- Để kiểm tra, publish Rules, tạo mã mời rồi tham gia từ hai tài khoản/trình duyệt riêng. Chưa thể xác nhận trao đổi liên máy cho đến khi các bước Firebase này được thực hiện.

## Cập nhật

Tampermonkey tự kiểm tra phiên bản mới. Có thể kiểm tra thủ công trong **Dashboard → Utilities → Check for userscript updates**, rồi tải lại trang game.

Khi phát hành bản mới, admin cần push module `guild-chat.js`, userscript và metadata tương ứng lên GitHub; tăng `@version` trong mỗi cặp script/metadata để Tampermonkey nhận cập nhật.
