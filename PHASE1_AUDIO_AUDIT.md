# SoundVerse Phase 1 — Audio Streaming Bandwidth Audit & Plan

**Document**: `PHASE1_AUDIO_AUDIT.md`  
**Engineer**: Senior Frontend Engineer (Audio Streaming Optimization)  
**Target File**: `src/contexts/AudioContext.jsx`  
**Goal**: Triệt tiêu lãng phí băng thông Supabase Cached Egress (> 20 GB trên ~700 MB Storage) bằng cách tối ưu vòng đời audio player, preload, deduplication và queue restore mà không làm thay đổi UI hay API.

---

## 1. Danh sách File và Function Thay Đổi

### File mục tiêu:
- [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx)

### Các function & block mã nguồn can thiệp:
1. **`safePlay`** (Dòng ~165):
   - Thay đổi preload mode khi bắt đầu phát.
2. **`load`** (Dòng ~199):
   - Chuẩn hóa deduplication check bằng `mediaKey(activeItem) === mediaKey(item)`.
   - Chuyển toàn bộ `audio.preload = 'auto'` thành `audio.preload = 'metadata'`.
   - Loại bỏ `audio.load()` dư thừa.
3. **`useEffect` (Audio element lifecycle & Handlers)** (Dòng ~308 - 360):
   - Khôi phục hàng đợi (`queue restore`): chỉ nạp metadata `{ id, title, artist, duration, cover }` vào state, không gán audio src cho bài chưa phát.
   - Thêm cơ chế giới hạn retry (`max 1 retry`) cho các event `error`, `stalled`.
   - Tối ưu event `ended` để kích hoạt Auto Next ngay lập tức.

---

## 2. So sánh Hành vi Trước và Sau (Before / After Behavior)

| Hạng mục | Trước khi sửa (Before) | Sau khi sửa (After) |
| :--- | :--- | :--- |
| **1. Preload Behavior** | - Sử dụng `audio.preload = 'auto'` khi phát nhạc.<br>- Trình duyệt tải trước 100% dung lượng file MP3 (5–15 MB) ngay khi nhấn play.<br>- Khi skip bài sau 5s, toàn bộ file vẫn bị tải hết. | - **Browsing**: `preload = "none"` hoàn toàn.<br>- **Chuẩn bị & đang phát**: `preload = "metadata"` vĩnh viễn.<br>- Trình duyệt chỉ tải header/metadata (~20 KB) và stream âm thanh theo tiến độ thực tế. |
| **2. Gọi `audio.load()`** | - `audio.load()` bị gọi mỗi khi cập nhật queue, restore state, hoặc khi đổi track.<br>- Gây hủy buffer hiện tại và gửi Range request lặp lại. | - Chỉ gọi `audio.load()` khi `audio.src` thực sự thay đổi sang URL mới **AND** người dùng yêu cầu phát (`play === true`).<br>- Không gọi `audio.load()` khi playlist/queue cập nhật. |
| **3. Duplicate Audio Request** | - Khi click lại bài đang phát hoặc chọn lại track trong queue, nếu URL sai khác nhỏ, player gán lại `audio.src` và nạp lại từ byte 0. | - So sánh `mediaKey(activeTrack) === mediaKey(requestTrack)`.<br>- Nếu trùng: giữ nguyên audio instance, tiếp tục phát, **không fetch lại bất kỳ byte nào**. |
| **4. Queue Restore** | - Khi mở web với queue đã lưu, thẻ audio có thể nhận `audio.src` và gọi `.load()`, sinh ra HTTP Range Request ngay cả khi người dùng chỉ xem web. | - Restore chỉ nạp metadata vào React state: `{ id, title, artist, duration, cover }`.<br>- Thẻ audio giữ `audio.src = ''`, `preload = 'none'`. Không có bất kỳ kết nối mạng nào cho bài chưa phát. |
| **5. Retry Loop** | - Khi lỗi mạng hoặc HTTP 402/429 từ Supabase, các sự kiện `error` / `stalled` có thể kích hoạt thử lại không giới hạn, gây spam server. | - Áp dụng quy tắc: **Tối đa 1 lần retry**.<br>- Nếu lỗi HTTP 4xx/5xx hoặc lỗi giải mã: dừng ngay lập tức (`stop`), hiển thị thông báo thân thiện (`friendly error`). |

---

## 3. Đánh Giá Rủi Ro và Biện Pháp Kiểm Soát (Risk Assessment)

### Rủi ro 1: Lag hoặc delay khi chuyển bài do `preload = "metadata"`
- **Phân tích**: Khi không dùng `preload = "auto"`, trình duyệt không tải trước cả bài tiếp theo.
- **Biện pháp**: `preload = "metadata"` vẫn cho phép trình duyệt đọc thông tin codec và độ dài tức thì. Khi lệnh `play()` được gọi, HTTP Range request bắt đầu stream ngay lập tức ở tốc độ cao mà không gây giật lag.

### Rủi ro 2: Khôi phục vị trí nghe podcast (Podcast Resume)
- **Phân tích**: Nếu `audio.src` không được nạp khi restore, vị trí nghe dở của podcast (`saved.currentTime > 0`) có thể bị mất nếu không được quản lý đúng.
- **Biện pháp**: State quản lý `currentTime` và `pendingSeek` độc lập với DOM element. Khi người dùng bấm Play tập podcast đang nghe dở, hệ thống nạp audio và seek ngay lập tức tới `pendingSeek.current`.

### Rủi ro 3: Trùng lặp so sánh `mediaKey`
- **Phân tích**: Nếu dữ liệu bài hát thiếu `id` hoặc format không đồng nhất, `mediaKey` có thể trả về key rỗng hoặc sai lệch.
- **Biện pháp**: Sử dụng hàm `mediaKey()` chuẩn của dự án kết hợp so sánh URL canonical đã chuẩn hóa (`cleanUrl = url.split('?')[0]`).

---

## 4. Kế Hoạch Kiểm Thử (Verification Plan)
1. **Unit & Integration Test**:
   - Chạy `npx playwright test tests/v2.spec.js` (31 bài test lifecycle, queue restore, repeat/shuffle, responsive).
   - Chạy `npx playwright test tests/lockscreen-playback.spec.js` (MediaSession, lockscreen controls).
2. **Build Verification**:
   - Chạy `npm run build` để đảm bảo bundle production không có lỗi cú pháp hay cảnh báo type.
3. **Network Tab Verification**:
   - Mở web với queue có sẵn -> Kiểm tra Network Tab có đúng 0 audio request.
   - Nhấn Play -> Kiểm tra chỉ có 1 request stream dạng chunked/progressive với `preload = 'metadata'`.
   - Click lại chính bài đó -> Kiểm tra không phát sinh thêm request.

