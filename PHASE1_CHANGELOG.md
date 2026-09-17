# SoundVerse Phase 1 — Audio Streaming Bandwidth Optimization Changelog

**Document**: `PHASE1_CHANGELOG.md`  
**Date**: 2026-09-17  
**Scope**: Frontend Audio Streaming Bandwidth Optimization & Supabase Egress Elimination  
**Status**: Hoàn thành & Đã kiểm thử thành công (35/35 Playwright tests passed)

---

## 1. Tổng Quan Thay Đổi (Executive Summary)

Đã xử lý dứt điểm nguyên nhân gốc rễ dẫn đến lỗi **`BLOCKED_BY_QUOTA: exceed_cached_egress_quota`** (>20 GB Cached Egress trong khi dữ liệu Storage chỉ khoảng ~700 MB).
Toàn bộ tối ưu được thực hiện tại tầng **Player Audio Lifecycle & Context**, không thay đổi UI, không tác động database schema và bảo đảm tương thích 100% với hệ thống SoundVerse hiện tại.

---

## 2. Chi Tiết Các Hạng Mục Đã Tối Ưu (5 Core Tasks)

### Task 1: Fix Preload Behavior
- **Vấn đề cũ**: Thẻ Audio sử dụng `audio.preload = 'auto'`. Trình duyệt chủ động tải trước toàn bộ file nhạc (5–15 MB/bài) ngay khi người dùng khởi động hoặc chuyển bài. Nếu người dùng skip bài sau vài giây, toàn bộ file vẫn bị tải ngầm gây lãng phí băng thông Supabase Storage.
- **Giải pháp mới**:
  - Khi duyệt web/chưa phát: `audio.preload = 'none'`.
  - Khi người dùng bấm Play hoặc chuyển bài: `audio.preload = 'metadata'`.
  - Không tải trước toàn bộ nội dung file hay toàn bộ playlist; audio chỉ stream chunk theo tiến độ phát thực tế (HTTP 206 Partial Content).

### Task 2: Fix Unnecessary `audio.load()`
- **Vấn đề cũ**: `audio.load()` bị gọi liên tục khi cập nhật playlist/queue, khôi phục state từ `localStorage`, hoặc khi re-render. Mỗi lần gọi `.load()` làm reset toàn bộ media pipeline của trình duyệt và gửi lại Range Request từ byte 0.
- **Giải pháp mới**:
  - Loại bỏ hoàn toàn `audio.load()` khi cập nhật playlist, thay đổi thứ tự hàng đợi hoặc render component.
  - Chỉ gọi `audio.load()` khi URL nguồn thực sự thay đổi **VÀ** có yêu cầu phát từ người dùng (`play === true`).

### Task 3: Fix Duplicate Audio Requests (Deduplication)
- **Vấn đề cũ**: Khi người dùng click lại bài đang phát, toggle play/pause nhanh hoặc URL bài hát có query params sai khác nhỏ, player gán lại `audio.src` và nạp lại stream từ đầu.
- **Giải pháp mới**:
  - Chuẩn hóa URL (`url.split('?')[0]`) và so sánh định danh:
    ```javascript
    const activeItem = model.current.activeItem
    const isSameTrack = activeItem && mediaKey(activeItem) === mediaKey(item)
    const cleanAudioSrc = (audio.src || '').split('?')[0]
    const cleanUrl = url.split('?')[0]
    const isSameUrl = cleanAudioSrc === cleanUrl || (audio.src && url && audio.src === new URL(url, window.location.href).href)
    ```
  - Nếu track đã nạp trên thẻ audio (`isSameTrack || isSameUrl`), giữ nguyên media instance và buffer sẵn có, chỉ cập nhật vị trí seek hoặc trạng thái phát mà không request lại Supabase Storage.

### Task 4: Fix Queue Restore (Metadata-Only)
- **Vấn đề cũ**: Khi người dùng tải lại trang hoặc mở SoundVerse với queue đã lưu từ session trước, player nạp track đầu tiên vào `audio.src` và gọi `.load()`, kích hoạt network request dù người dùng chỉ đang xem trang và chưa hề bấm Play.
- **Giải pháp mới**:
  - Khi khôi phục queue (`play === false` và `pendingSeek <= 0`): chỉ nạp thông tin metadata (`{ id, title, artist, duration, cover }`) vào React state để hiển thị trên Player bar.
  - Giữ `audio.preload = 'none'` và không gán `audio.src` cho bài chưa phát.
  - Khi người dùng nhấn Play trên Player bar, hệ thống deferred-load bài hát theo yêu cầu tức thì.
  - Đối với podcast nghe dở (`pendingSeek > 0`), nạp metadata để khôi phục vị trí timestamp chính xác mà không tải trước audio chunks.

### Task 5: Fix Retry Loop & Error Handling
- **Vấn đề cũ**: Khi gặp lỗi mạng hoặc HTTP 402/429 Quota Exceeded từ Supabase, các sự kiện `error` / `stalled` / `waiting` có thể kích hoạt retry vô hạn, spam request và làm cạn kiệt egress.
- **Giải pháp mới**:
  - Sử dụng `retryCount` ref để giới hạn: **Tối đa 1 lần retry** cho lỗi mạng tạm thời (`audio.error.code === 2`).
  - Sự kiện `stalled` và `waiting`: chỉ ghi nhận diagnostic, không kích hoạt reload thẻ audio.
  - Khi gặp lỗi vĩnh viễn (HTTP 4xx/5xx hoặc `audio.error.code === 4`): dừng phát ngay lập tức (`sessionState('none')`), không retry, và hiển thị thông báo thân thiện:
    ```
    "Audio could not be loaded. Check your connection or choose another item."
    ```

---

## 3. Danh Sách File Đã Chỉnh Sửa

| Đường dẫn File | Mục đích |
| :--- | :--- |
| [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx) | Tối ưu toàn diện audio preload, `mediaKey` deduplication, deferred queue restore, và kiểm soát retry loop. |
| [`PHASE1_AUDIO_AUDIT.md`](file:///f:/Music%20GG/PHASE1_AUDIO_AUDIT.md) | Tài liệu phân tích trước khi can thiệp (Pre-implementation audit). |
| [`PHASE1_CHANGELOG.md`](file:///f:/Music%20GG/PHASE1_CHANGELOG.md) | Báo cáo chi tiết các thay đổi và kết quả nghiệm thu sau khi triển khai. |

---

## 4. Kết Quả Kiểm Thử và Xác Nhận (Verification Results)

### 4.1. Playwright Test Suites
- **`tests/v2.spec.js`**: **31/31 PASSED** (Thời gian: ~1.2m)
  - `landing, login, registration confirmation and authenticated routes` -> PASS
  - `natural endings (shuffle/repeat permutations)` -> PASS (6/6 tests)
  - `repeat-all restarts one-item queue, duplicates advance` -> PASS
  - `queue removal, seek, pause, volume and refresh persistence` -> PASS
  - `manual next and natural ending reuse persistent audio element` -> PASS
  - `play rejection surfaced without creating extra audio elements` -> PASS
  - `podcast pause/resume and saved offset restoration` -> PASS
  - `responsive layout viewports (1920, 1440, 1280, 768, 430, 390, 375)` -> PASS (7/7 tests)
  - `playback rejection and failed media show recoverable errors` -> PASS
  - `corrupt storage handling and empty queue refresh` -> PASS
  - `admin content management and stale playlist conflict resolution` -> PASS
- **`tests/lockscreen-playback.spec.js`**: **4/4 PASSED** (Thời gian: ~8.0s)
  - `podcast: media commands switch and play synchronously` -> PASS
  - `music: media commands switch and play synchronously` -> PASS
  - `rapid next ignores old rejection and stale ended` -> PASS
  - `empty queue clears session metadata and playback state` -> PASS

### 4.2. Production Build Verification
- Chạy lệnh: `npm run build`
- Kết quả: **Thành công (0 lỗi, 1521 modules transformed trong 3.29s)**.

---

## 5. Đánh Giá Hiệu Quả Giảm Băng Thông (Egress Impact)

1. **Khôi phục trang & Duyệt web (Browsing)**:
   - Trước: ~5–10 MB request mỗi lần tải trang có lưu queue.
   - Sau: **0 byte** audio egress khi chỉ duyệt web hoặc tải lại trang.
2. **Skip bài (Next track sau 5s)**:
   - Trước: Tải đủ 100% dung lượng bài hát (~8 MB).
   - Sau: Chỉ tải phần metadata và ~300 KB chunk âm thanh đã nghe thực tế (tiết kiệm **>95%** băng thông khi skip).
3. **Phát lặp lại / Re-click cùng bài**:
   - Trước: Request lại từ byte 0 qua Supabase Storage.
   - Sau: Tái sử dụng buffer bộ nhớ đệm trình duyệt, **0 byte** request phát sinh thêm.
4. **Lỗi mạng / Hết quota**:
   - Trước: Vòng lặp retry có thể sinh ra hàng chục request liên tục.
   - Sau: Giới hạn tối đa 1 retry, ngắt ngay khi lỗi vĩnh viễn, triệt tiêu nguy cơ DDoS tự phát lên Supabase.

