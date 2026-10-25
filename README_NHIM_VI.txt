# Hedge Hotpot Conveyor

Game lẩu băng chuyền với nhân vật nhím, thay cho bản mèo trong ZIP nguồn. Toàn bộ thay đổi hiện ở local của repo `ybdstudio/hedgehotpot`; chưa commit hoặc push.

## Xem trước

- Mở trực tiếp **dist/hedge-hotpot-preview.html** bằng Edge/Chrome. Đây là một file HTML độc lập (~14.4 MB), đã nhúng CSS, JavaScript và toàn bộ ảnh; chạy khi tắt mạng.
- Hoặc chạy `node tools/serve_preview.js 8789`, rồi mở `http://127.0.0.1:8789/dist/hedge-hotpot-preview.html?noads=1`.
- Chơi bản source: mở `index.html` trên máy chủ local. Di chuyển bằng kéo màn hình, WASD hoặc phím mũi tên. Bật AUTO trong Settings để xem bot chơi.

## Đã tích hợp

- 10 vai nhím: người chơi, nhân viên chạy món, phục vụ, thu ngân, dọn dẹp, quản lý, 2 khách thường và 2 VIP.
- Atlas và pivot chuẩn hóa, 8 hướng idle/walk/carry; dùng đúng ảnh nhím từ các ZIP tham chiếu, ưu tiên bản cập nhật v1.2.
- Tách khách, bàn, ghế, nồi và đĩa thành lớp renderer riêng. Mọi khách thường có thể dùng cả hai phía bàn; không còn giới hạn do ảnh mèo ghép sẵn.
- Nhân viên bếp dùng sprite người thật trong scene, bỏ overlay cũ làm nhân vật phình to. Ghế băng chuyền/ghế chờ được vẽ riêng, không biến mất khi có khách.
- Icon, loading, chia sẻ, bảng hiệu, rèm, đèn lồng, tượng, bình phong, thảm và huy hiệu quầy bếp/ghế đổi sang nhím. Đổi tên hiển thị thành Hedge Hotpot.
- Giữ chủ đề lẩu, kinh tế, nhiệm vụ, save key và cấu hình SDK/ads gốc. `cust_orange`, `cust_gray`, `sit_cat` và thư mục native `meow-hotpot` chỉ là định danh tương thích.

## Build

Python cần Pillow để đóng atlas; các bước preview và server dùng thư viện chuẩn, game không có phụ thuộc mạng.

```powershell
python tools/build_hedgehog_assets.py
python tools/build_hedgehog_environment.py
python tools/build_preview.py
node tools/build_native.js dist/native
```

`tools/build_assets.py` và `tools/bundle.py` chuyển tiếp sang pipeline nhím mới. Không chạy các script thử nghiệm art cũ để tái tạo asset mèo.

## Kiểm tra

- Bộ hồi quy trình duyệt: **14/14 PASS**, hoàn thành Grand Opening ở phút 39:24 thời gian mô phỏng, không có page error.
- Kiểm tra riêng: đủ 11 atlas, 10 vai, các action/hướng/pivot hợp lệ; bàn phím, 5 panel, bàn trống/1/2 khách, toàn bộ khu mở khóa, HTML file offline và native emulator đều chạy.
- Native build: main 1.20 MB / 4 MB; tổng 11.08 MB / 30 MB. App ID và SDK vẫn là placeholder của source gốc.
- Báo cáo: `docs/HEDGEHOG_QA.json`, `docs/qa/browser-regression.json`, `docs/qa/hedgehog-preview.json`.
- Ảnh: `docs/hedgehog_runtime.png`, `docs/hedgehog_dining.png`, `docs/hedgehog_all_areas.png`, `docs/hedgehog_native.png`, `docs/hedgehog_characters.jpg`.

### Giới hạn hình động

Bộ tham chiếu chưa có đủ động tác chuyên biệt hoặc walk 8 hướng cho mọi NPC. Các hướng thiếu dùng idle đúng hướng kèm chuyển động bước chân/thân bằng code; nấu/lau/đặt món dùng chuyển động và đạo cụ vẽ riêng. Đây không phải bộ animation vẽ mới đầy đủ. Các view ngồi là trái/phải. Frame quầy bếp dùng chung art nhím mới; trạng thái chế biến hiển thị qua thanh tiến trình và món trên kệ. Chưa kiểm thử trên thiết bị TikTok thật.

Các tài liệu lịch sử được nhập từ ZIP mô tả bản mèo trước đây; báo cáo hiện tại ở các đường dẫn trên.
