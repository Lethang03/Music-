# SoundVerse Phase 2 — Auto Next & Background Playback Changelog

**Document**: `PHASE2_CHANGELOG.md`  
**Engineer**: Senior Web Audio Engineer  
**Date**: 2026-09-17  
**Scope**: Auto Next Seamless Transition, Web Audio Context Resume, Media Session API & Background Playback Fix  
**Status**: Hoàn thành & Đã kiểm thử thành công (40/40 Playwright tests passed)

---

## 1. Tóm Tắt Thay Đổi (Summary)

Toàn bộ các can thiệp trong Phase 2 tập trung vào tầng **Web Audio & Media Lifecycle** nhằm khắc phục lỗi dừng nhạc khi kết thúc bài, mất kết nối khi tắt màn hình điện thoại (Screen off / Lockscreen) và tối ưu hóa điều khiển qua tai nghe Bluetooth:
1. Chuyển đổi toàn bộ luồng chuyển bài tự động (`ended` event -> `handleNext`) thành **đồng bộ hoàn toàn** trong cùng call stack.
2. Tích hợp khả năng tự động khôi phục Web Audio context (`ctx.resume()`) khi ứng dụng chạy ngầm hoặc tab bị ẩn (`document.visibilityState === 'hidden'`).
3. Bổ sung chế độ **Fallback Native Audio** tự nhiên khi không bật Equalizer để loại bỏ hoàn toàn nguy cơ đình chỉ âm thanh từ OS.
4. Chuẩn hóa bộ điều khiển Media Session API (thêm action `stop` cho tai nghe Bluetooth, bảo toàn `playbackState`).
5. Bảo vệ hàm `setPositionState` theo đúng chuẩn W3C (không bao giờ gọi khi `duration = 0` hoặc `NaN`).

---

## 2. Danh Sách File Can Thiệp

| File Path | Thay Đổi Chính |
| :--- | :--- |
| [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx) | - Triển khai hàm `safeSetPositionState`<br>- Viết lại `handleNext` và `handlePrev` thành luồng thực thi đồng bộ<br>- Đồng bộ hóa sự kiện `ended`<br>- Xử lý `visibilitychange` để resume Web Audio<br>- Thêm action `stop` trong `navigator.mediaSession`<br>- Quản lý cờ `stopping.current` trong `pause` event |
| [`tests/phase2-playback.spec.js`](file:///f:/Music%20GG/tests/phase2-playback.spec.js) | - Bộ test tự động chuyên sâu cho Phase 2 (5 test cases kiểm tra đồng bộ, auto-next, setPositionState, MediaSession, Web Audio resume) |
| [`PHASE2_PLAYBACK_REPORT.md`](file:///f:/Music%20GG/PHASE2_PLAYBACK_REPORT.md) | - Báo cáo kỹ thuật chi tiết về cơ chế hoạt động trên Android Chrome, iOS Safari, PWA và Bluetooth |
| [`PHASE2_CHANGELOG.md`](file:///f:/Music%20GG/PHASE2_CHANGELOG.md) | - Nhật ký thay đổi chi tiết và hướng dẫn kiểm thử |

---

## 3. So Sánh Chi Tiết Trước và Sau Khi Sửa (Before / After)

| Hạng Mục | Trước Khi Tối Ưu (Before) | Sau Khi Tối Ưu (After) |
| :--- | :--- | :--- |
| **1. Sự kiện `ended`** | `ended` gọi `await handleNext()` -> `await load()` -> `await safePlay()`. Chuỗi microtask khiến trình duyệt mobile hủy quyền phát tự động. | `ended` gọi trực tiếp `handleNext(true)`. Tính toán bài tiếp theo, gán `audio.src` và gọi `audio.play()` ngay trong cùng tick thực thi đồng bộ. |
| **2. Tái tạo Audio Instance** | Có nguy cơ tạo thẻ Audio mới hoặc tải lại trang khi xử lý hàng đợi. | Giữ nguyên 100% singleton `HTMLAudioElement` (`window.__soundverse_audio_instance`), chỉ đổi thuộc tính `src`. |
| **3. Web Audio khi tắt màn hình** | `AudioContext` rơi vào trạng thái `suspended` khi màn hình tắt, dẫn đến câm tiếng hoặc ngắt luồng. | Lắng nghe `visibilitychange` (`hidden`), tự động gọi `ctx.resume()`. Nếu Equalizer tắt, phát trực tiếp qua native audio pipeline không qua Web Audio graph. |
| **4. Điều khiển Media Session** | Thiếu action `stop` cho tai nghe Bluetooth. Khi gọi stop, sự kiện `pause` của audio ghi đè lại trạng thái thành `'paused'`. | Đăng ký đầy đủ `play`, `pause`, `nexttrack`, `previoustrack`, `seekto`, `seekforward`, `seekbackward`, và `stop`. Dùng cờ `stopping.current` giữ vững trạng thái `'none'`. |
| **5. `setPositionState`** | Có các lời gọi không tham số `setPositionState?.()` hoặc truyền `duration = 0`/`NaN`, gây lỗi `TypeError` trên các trình duyệt mobile. | Hàm `safeSetPositionState` kiểm tra nghiêm ngặt `Number.isFinite(duration) && duration > 0` trước khi gửi xuống OS. |

---

## 4. Kết Quả Kiểm Thử (Verification Results)

### 4.1. Playwright Test Suites
1. **`tests/phase2-playback.spec.js`**: **5/5 PASSED**
   - Synchronous transition on `ended` (verified zero microtask delay) -> PASS
   - Auto next continuous playback through queue -> PASS
   - Strict `setPositionState` validation -> PASS
   - Media Session actions (`play`, `pause`, `nexttrack`, `previoustrack`, `seekto`, `stop`) -> PASS
   - Web Audio resume on visibility hidden -> PASS
2. **`tests/lockscreen-playback.spec.js`**: **4/4 PASSED**
   - Stable handler registrations & background lockscreen commands -> PASS
3. **`tests/v2.spec.js`**: **31/31 PASSED**
   - Natural endings (all shuffle & repeat combinations), responsive viewports, podcast pause/resume -> PASS

### 4.2. Production Build Check
- `npm run build`: **✓ built in 2.97s (0 errors)**.

---

## 5. Hướng Dẫn Kiểm Thử Thủ Công Trên Thiết Bị Thực Tế

1. **Trên Android Chrome / iOS Safari**:
   - Mở bài hát trong playlist.
   - Khóa màn hình điện thoại (Screen Off) khi bài hát còn khoảng 5–10 giây.
   - Quan sát: Bài hát 1 kết thúc -> Bài hát 2 tự động phát liền mạch không cần mở màn hình.
   - Bảng điều khiển Media Notification trên màn hình khóa hiển thị đúng tên bài, hình ảnh và thanh thời lượng chính xác.
2. **Trên Tai Nghe Bluetooth**:
   - Nhấn nút Next trên tai nghe: chuyển sang bài tiếp theo ngay lập tức.
   - Nhấn nút Stop / tháo tai nghe: bài hát dừng lại, trạng thái session chuyển về `'none'` chuẩn xác.

