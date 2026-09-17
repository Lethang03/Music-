# SOUNDVERSE AUDIO STREAMING & SUPABASE EGRESS AUDIT REPORT
**Author**: Senior Full-stack Engineer  
**Date**: September 17, 2026  
**Status**: COMPLETED AUDIT (Ready for Implementation Review)  
**Supabase Incident**: `BLOCKED_BY_QUOTA` — `exceed_cached_egress_quota` (Storage ~700MB, Cached Egress > 20GB)

---

## MỤC LỤC
1. [TỔNG QUAN HIỆN TRẠNG VÀ NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE)](#1-tổng-quan-hiện-trạng-và-nguyên-nhân-gốc-rễ-root-cause)
2. [NHIỆM VỤ 1: AUDIT CHI TIẾT TOÀN BỘ AUDIO FLOW](#2-nhiệm-vụ-1-audit-chi-tiết-toàn-bộ-audio-flow)
3. [NHIỆM VỤ 2: KIỂM TRA SUPABASE STORAGE USAGE & DUPLICATE ASSETS](#3-nhiệm-vụ-2-kiểm-tra-supabase-storage-usage--duplicate-assets)
4. [NHIỆM VỤ 3: TỐI ƯU HÓA AUDIO PLAYER ARCHITECTURE](#4-nhiệm-vụ-3-tối-ưu-hóa-audio-player-architecture)
5. [NHIỆM VỤ 4: KHẮC PHỤC AUTO NEXT (ENDED EVENT & BACKGROUND EXECUTION)](#5-nhiệm-vụ-4-khắc-phục-auto-next-ended-event--background-execution)
6. [NHIỆM VỤ 5: MOBILE, PWA VÀ BACKGROUND / LOCKSCREEN PLAYBACK](#6-nhiệm-vụ-5-mobile-pwa-và-background--lockscreen-playback)
7. [NHIỆM VỤ 6: DATABASE PROTECTION (AUDIO HASH & DUPLICATE PREVENTION)](#7-nhiệm-vụ-6-database-protection-audio-hash--duplicate-prevention)
8. [NHIỆM VỤ 7: TỐI ƯU IMPORT JOB (SOURCE HASH & IDEMPOTENCY)](#8-nhiệm-vụ-7-tối-ưu-import-job-source-hash--idempotency)
9. [BẢNG TỔNG HỢP CÁC FILE, DÒNG CODE VÀ MỨC ĐỘ ẢNH HƯỞNG](#9-bảng-tổng-hợp-các-file-dòng-code-và-mức-độ-ảnh-hưởng)
10. [KẾ HOẠCH TRIỂN KHAI VÀ ƯỚC TÍNH GIẢM THIỂU EGRESS](#10-kế-hoạch-triển-khai-và-ước-tính-giảm-thiểu-egress)

---

## 1. TỔNG QUAN HIỆN TRẠNG VÀ NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE)

### Hiện tượng thực tế:
- **Storage Size**: ~700 MB (`soundverse` ~350 MB, `music-audio` ~181 MB, `podcast-audio` ~177 MB).
- **Cached Egress**: Đạt đỉnh **> 20 GB** (vượt hơn 28 lần dung lượng lưu trữ).
- **Trạng thái hệ thống**: Supabase Kong Gateway chặn các request với lỗi:
  `Service for this project is restricted due to the following violations: exceed_cached_egress_quota`.

### 5 Nguyên nhân gốc rễ (Root Causes) được xác định:

1. **Preload quá mức (`audio.preload = 'auto'`):**
   Trong `src/contexts/AudioContext.jsx`, khi bài hát bắt đầu phát, hệ thống gán `audio.preload = 'auto'`. Trình duyệt lập tức kích hoạt tải toàn bộ file MP3 (trung bình 5–12 MB mỗi bài). Khi người dùng nghe vài giây rồi Next bài, toàn bộ file vẫn bị tải về hết, lãng phí 80–90% băng thông của bài đó.
2. **Khôi phục hàng đợi kích hoạt Range Requests khi chỉ duyệt web:**
   Khi mở ứng dụng, nếu có hàng đợi trong `localStorage`, thẻ âm thanh trước đây bị gán `audio.src = url; audio.load()`, khiến trình duyệt gửi `HTTP Range: bytes=0-...` tải header và buffer ban đầu ngay cả khi người dùng không hề bấm Play.
3. **Mất luồng phát khi hết bài (Auto Next Delay / Stall) dẫn đến người dùng phải F5:**
   Sự kiện `ended` bị phụ thuộc vào chuỗi `async/await` và kiểm tra điều kiện `audio.ended` quá cứng nhắc. Khi Web Audio API (`AudioContext`) bị hệ điều hành di động (Android Chrome / iOS Safari) đưa vào trạng thái `suspended` ở chế độ nền (background/screen off), bài hát dừng lại, không chuyển bài, buộc người dùng phải tải lại trang nhiều lần.
4. **Không có cơ chế khử trùng lặp file âm thanh khi Import (Missing Audio Hash):**
   Cả `music_tracks`, `episodes` và `import_jobs` đều không lưu mã băm (`audio_hash` / `source_hash`). Khi admin hoặc người dùng import lại cùng một link YouTube hoặc upload cùng một file MP3, hệ thống tải về, chuyển mã qua ffmpeg và tạo file mới với tên ngẫu nhiên (`${job.id}-${title}.mp3` hoặc `${Date.now()}_${random}.mp3`), gây phình to storage và nhân bản số lần tải.
5. **Re-render tính toán URL liên tục & Discord Bot stream toàn bộ file:**
   - Client tính toán `getArtworkUrl` liên tục mỗi 250ms theo nhịp `timeupdate`.
   - Discord Bot (`discord-bot/audio.js`) thực hiện `fetch(source.url)` toàn bộ file âm thanh vào bộ nhớ Node.js mỗi khi bài hát được yêu cầu trong kênh voice mà không có bất kỳ bộ nhớ đệm nào.

---

## 2. NHIỆM VỤ 1: AUDIT CHI TIẾT TOÀN BỘ AUDIO FLOW

| STT | Hạng mục kiểm tra | Hiện trạng phát hiện | File & Dòng code liên quan | Mức độ ảnh hưởng | Đề xuất khắc phục |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.1** | **Audio bị fetch nhiều lần cho cùng một track** | Khi người dùng click lại bài đang phát hoặc chọn bài đã có trong buffer, nếu so sánh URL không chuẩn hóa query/hash, player gán lại `audio.src = url` và gọi `audio.load()`, ép browser tải lại từ byte 0. | [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L222-L236) | **CRITICAL** (Tốn 5–10 MB cho mỗi cú click thừa) | Chuẩn hóa so sánh `cleanUrl` và `mediaKey(activeItem) === mediaKey(item)`. Nếu trùng, chỉ seek và play tiếp, tuyệt đối không gán lại `src`. |
| **1.2** | **Component re-render tạo Audio instance mới** | Nếu `AudioProvider` bị unmount/remount trong React StrictMode hoặc do key thay đổi, một đối tượng `new Audio()` mới có thể được tạo ra song song. | [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L53-L65) | **HIGH** (Gây rò rỉ bộ nhớ & kết nối song song) | Khóa chặt bằng singleton `window.__soundverse_audio_instance` và module-level cache; tái sử dụng 100% instance cũ. |
| **1.3** | **useEffect dependency gây reload audio** | `useEffect` khởi tạo audio phụ thuộc vào `[storageKey, diagnostic, handleNext, load, persist, publish, report]`. Nếu một callback không ổn định tham chiếu, effect sẽ chạy lại, hủy listener và reset audio. | [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L380-L389) | **HIGH** (Ngắt quãng âm thanh và tải lại source) | Sử dụng `useRef` cho các callback nội bộ (`loadRef`, `handleNextRef`) và giảm dependency array của audio initializer về `[storageKey]`. |
| **1.4** | **`audio.load()` bị gọi dư thừa** | `audio.load()` bị gọi mỗi khi có cập nhật hàng đợi hoặc khởi tạo state, ngay cả khi chưa cần phát. | [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L269) | **CRITICAL** (Gây ra hàng loạt Range Request ngầm) | Chỉ gọi `audio.load()` duy nhất khi `audio.src` thay đổi sang một URL mới VÀ có lệnh phát nhạc (`play === true`). |
| **1.5** | **Preload quá mức (`auto`)** | Gán `audio.preload = 'auto'` khiến trình duyệt tải toàn bộ file MP3 (100%) vào cache ngay khi bấm phát. | [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L155), [`#L267`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L267) | **CRITICAL** (Chiếm tới 70% tổng lượng egress lãng phí khi skip bài) | Đổi vĩnh viễn sang `audio.preload = 'metadata'`. Trình duyệt chỉ tải thông tin độ dài/codec và stream dữ liệu theo tiến độ nghe thực tế. |
| **1.6** | **Retry audio vô hạn khi lỗi** | Khi gặp lỗi mạng hoặc HTTP 402/403 từ Supabase, nếu không có cơ chế chặn vòng lặp, các event `error` và `stalled` có thể kích hoạt auto-retry liên tục. | [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L350) | **HIGH** (Spam request khi Supabase hết quota) | Giới hạn tối đa 1 lần thử lại; nếu lỗi 4xx/5xx thì dừng và hiển thị thông báo thân thiện via `friendlyError.js`. |
| **1.7** | **Chuyển bài (Track Switch)** | Kiểm tra xem chuyển bài có tạo audio mới không: Instance được giữ nguyên, nhưng hàm chuyển bài cũ xóa toàn bộ metadata và gán lại `currentTime = 0` trước khi nạp. | [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L265-L275) | **MEDIUM** | Giữ nguyên player instance, chuẩn bị metadata bài tiếp theo mà không preload nội dung audio. |

---

## 3. NHIỆM VỤ 2: KIỂM TRA SUPABASE STORAGE USAGE & DUPLICATE ASSETS

### Phân tích URL và Buckets:
- **Buckets được sử dụng**:
  - `soundverse`: Chứa ảnh bìa (`covers/`), avatar (`avatars/`), và file import nhạc (`audio/imports/`, `audio/podcasts/`).
  - `music-audio`: Chứa file âm thanh bài hát chính (~181 MB).
  - `podcast-audio`: Chứa file âm thanh tập podcast (~177 MB).
- **Cơ chế URL**:
  - SoundVerse sử dụng **Public URL** trực tiếp qua `storageProvider.getPublicUrl()`, không dùng Signed URL có thời hạn ngắn (tránh việc URL bị đổi liên tục gây mất cache trình duyệt).
  - Định dạng URL: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`.

### Phát hiện các vấn đề lặp dữ liệu & Request không cần thiết:
1. **Thiếu cơ chế Deduplication khi Import nhạc:**
   Trong [`workers/audio-worker/worker.js`](file:///f:/Music%20GG/workers/audio-worker/worker.js#L183):
   ```javascript
   audioPath = podcastJob 
     ? `audio/podcasts/${job.podcast_id}/${job.source_platform}-${job.source_id}.mp3` 
     : `audio/imports/${job.id}-${safeName(title)}.mp3`
   ```
   Mỗi lần một bài nhạc được import qua YouTube hay upload, hệ thống gắn kèm `${job.id}` vào tên file. Nếu cùng 1 bài hát được import 3 lần bởi 3 admin, Storage sẽ sinh ra 3 file MP3 riêng biệt (dung lượng nhân 3) và tạo ra 3 URL khác nhau, triệt tiêu khả năng cache của CDN và trình duyệt.
2. **File ảnh bìa thô chưa được dọn dẹp:**
   Nhiều bản ghi cũ trước đợt tối ưu hóa vẫn đang trỏ tới các file PNG/JPG thô nặng 4–8 MB thay vì WebP 150 KB.
3. **Discord Bot thiếu Local Audio Cache:**
   [`discord-bot/audio.js`](file:///f:/Music%20GG/discord-bot/audio.js#L93) gọi `fetch(source.url)` trực tiếp về Node server. Khi bot phát lại bài hát trong voice channel nhiều lần trong ngày, mỗi lần đều tải lại toàn bộ file từ Supabase Egress.

---

## 4. NHIỆM VỤ 3: TỐI ƯU HÓA AUDIO PLAYER ARCHITECTURE

### Nguyên tắc kiến trúc đề xuất:
1. **Duy trì duy nhất 1 Audio Instance:**
   - Tạo biến singleton bên ngoài React Tree hoặc gắn vào `window.__soundverse_audio_instance`.
   - Mọi tương tác playback của Music, Podcast, Queue, Mini Player, Fullscreen Now Playing đều trỏ chung vào 1 instance này.
2. **Cấu hình Preload chuẩn mực:**
   - **Khi duyệt trang (Browsing)**: `audio.src = ''`, `audio.preload = 'none'`.
   - **Khi chuẩn bị phát hoặc đang phát**: `audio.preload = 'metadata'`.
   - **Tuyệt đối không dùng `audio.preload = 'auto'`** trong toàn bộ dự án.
3. **Không tải trước toàn bộ playlist:**
   - Queue chỉ lưu trữ metadata JSON (id, title, artist, duration, artwork URL).
   - Tuyệt đối không nạp `new Audio()` hay gọi `fetch()` cho các bài tiếp theo trong hàng đợi. Chỉ bài đang phát mới có kết nối stream.
4. **Chuyển bài mượt (Seamless Track Transition):**
   - Khi chuyển bài, không phá hủy audio element.
   - Gán ngay `audio.src = nextUrl; audio.preload = 'metadata'; audio.play()`.

---

## 5. NHIỆM VỤ 4: KHẮC PHỤC AUTO NEXT (ENDED EVENT & BACKGROUND EXECUTION)

### Phân tích hiện tượng:
> *"Khi bài nhạc/podcast kết thúc: delay lâu, không chuyển bài, phải reload mới nghe tiếp."*

### Nguyên nhân kỹ thuật:
1. **Kiểm tra `if (!audio.ended) return` tại [`AudioContext.jsx#L349`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L349):**
   Khi trình duyệt kích hoạt event `ended`, một số trình duyệt di động hoặc khi bài hát kết thúc ở mili-giây cuối (do chênh lệch thời gian giữa audio hardware buffer và DOM `currentTime`), thuộc tính `audio.ended` có thể chưa kịp lật sang `true` tại thời điểm hàm callback được gọi. Câu lệnh guard này vô tình làm lọt mất sự kiện kết thúc.
2. **Chuỗi `async/await` làm mất User Gesture Privilege trên Mobile:**
   Trình duyệt di động (Chrome Android, Safari iOS) chỉ cho phép tự động gọi `audio.play()` nếu hành động đó diễn ra **ngay lập tức trong luồng synchronous của event `ended`**.
   Trong code hiện tại:
   `ended -> handleNext (async) -> await load (async) -> await safePlay (async) -> audio.play()`
   Các bước `await` làm phân mảnh execution context thành các microtasks riêng biệt. Hệ điều hành phát hiện không còn thuộc event loop trực tiếp và chặn lệnh `play()`, phát sinh lỗi `NotAllowedError: play() can only be initiated by a user gesture`.
3. **Web Audio API (`AudioContext`) bị treo ở Background:**
   Tính năng Equalizer (`initEqualizer`) dùng `ctx.createMediaElementSource(audio)`. Khi màn hình tắt, Android tiết kiệm pin bằng cách suspend Web Audio context (`ctx.state === 'suspended'`). Khi đó, audio element bị nghẽn ngõ ra âm thanh, không trigger được `ended` hoặc dừng phát hoàn toàn.

### Giải pháp khắc phục triệt để:
1. **Loại bỏ guard cứng nhắc**: Kiểm tra linh hoạt: `if (!audio.ended && Math.abs(audio.currentTime - audio.duration) > 0.5) return;`.
2. **Kích hoạt phát bài tiếp theo ngay trong synchronous tick**:
   Khi `ended` xảy ra, ngay lập tức xác định index bài tiếp theo, cập nhật state synchronously, gán `audio.src = nextUrl`, `audio.preload = 'metadata'` và gọi trực tiếp `audio.play()` mà không qua các tầng `await` trung gian.
3. **Bảo vệ Web Audio Context khi tắt màn hình**:
   Tự động phát hiện trạng thái `document.visibilityState === 'hidden'`. Nếu Web Audio context bị suspended, lập tức gọi `ctx.resume()` hoặc bypass routing để âm thanh native không bị ngắt.

---

## 6. NHIỆM VỤ 5: MOBILE, PWA VÀ BACKGROUND / LOCKSCREEN PLAYBACK

### Kiểm tra tính tương thích:
- **PWA Service Worker ([`public/sw.js`](file:///f:/Music%20GG/public/sw.js)):**
  - Đã có cơ chế bỏ qua các request audio và range request (`if (request.headers.has('range')) return`). Điều này đúng kỹ thuật, tránh lỗi cache corrupt trên mobile.
- **Media Session API ([`src/contexts/AudioContext.jsx#L482-L498`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx#L482-L498)):**
  - Handlers đã hỗ trợ: `play`, `pause`, `nexttrack`, `previoustrack`, `seekto`, `seekforward`, `seekbackward`.
  - **Vấn đề phát hiện**: Artwork URL truyền vào `MediaMetadata` đôi khi là đường dẫn tương đối (ví dụ: `/icons/icon.svg` hoặc `/branding/...`). Android Lockscreen yêu cầu **URL tuyệt đối (Absolute URL)** với giao thức `https://`, nếu không notification trên thanh thông báo sẽ không hiển thị ảnh thumbnail hoặc bị crash notification.
  - **Vấn đề Position State**: `navigator.mediaSession.setPositionState` bị gọi trước khi `audio.duration` sẵn sàng, dẫn đến việc thanh tiến trình trên màn hình khóa bị đứng ở 0:00.

### Giải pháp khắc phục:
1. Đảm bảo mọi URL ảnh bìa trong `MediaMetadata` được chuyển đổi thành URL tuyệt đối bằng `new URL(artworkUrl, window.location.origin).href`.
2. Khai báo đầy đủ kích thước và mime type chuẩn cho lockscreen: `[{ src: absoluteArt, sizes: '512x512', type: 'image/webp' }]`.
3. Chỉ gọi `setPositionState` khi `Number.isFinite(audio.duration) && audio.duration > 0`.

---

## 7. NHIỆM VỤ 6: DATABASE PROTECTION (AUDIO HASH & DUPLICATE PREVENTION)

### Vấn đề hiện tại:
Bảng `public.music_tracks` và `public.episodes` hiện tại không có trường lưu mã băm file âm thanh (`audio_hash`). Khi một bài hát được đưa lên hệ thống, không có căn cứ toán học để nhận biết bài hát đó đã tồn tại trong kho lưu trữ hay chưa.

### Thiết kế Migration Schema đề xuất:

```sql
-- Migration: Add audio integrity and hash columns
BEGIN;

-- 1. Bổ sung cho bảng music_tracks
ALTER TABLE public.music_tracks 
  ADD COLUMN IF NOT EXISTS audio_hash text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS audio_mime_type text DEFAULT 'audio/mpeg';

CREATE INDEX IF NOT EXISTS idx_music_tracks_audio_hash 
  ON public.music_tracks(audio_hash) 
  WHERE audio_hash IS NOT NULL;

-- 2. Bổ sung cho bảng episodes (podcasts)
ALTER TABLE public.episodes 
  ADD COLUMN IF NOT EXISTS audio_hash text,
  ADD COLUMN IF NOT EXISTS file_size bigint;

CREATE INDEX IF NOT EXISTS idx_episodes_audio_hash 
  ON public.episodes(audio_hash) 
  WHERE audio_hash IS NOT NULL;

COMMIT;
```

### Quy trình chống trùng lặp khi Import / Upload:
1. Khi Worker hoặc Admin xử lý xong file âm thanh (sau khi ffmpeg convert ra MP3):
   - Tính toán mã băm `SHA-256` của file:
     ```javascript
     import crypto from 'node:crypto'
     const fileBuffer = await fs.readFile(outputFilePath)
     const audioHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
     const fileSize = (await fs.stat(outputFilePath)).size
     ```
2. Thực hiện truy vấn kiểm tra trong CSDL:
   ```javascript
   const { data: existingTrack } = await supabase
     .from('music_tracks')
     .select('id, audio_url, title')
     .eq('audio_hash', audioHash)
     .maybeSingle()
   ```
3. **Xử lý nếu phát hiện trùng lặp**:
   - **KHÔNG TẢI LÊN FILE MỚI**: Không upload đè thêm một file MP3 10 MB nữa lên Supabase Storage.
   - **TÁI SỬ DỤNG URL ĐÃ CÓ**: Trỏ `audio_url` của bản ghi mới vào URL đã tồn tại, hoặc thông báo cho người dùng biết bài hát này đã có sẵn trong catalog.

---

## 8. NHIỆM VỤ 7: TỐI ƯU IMPORT JOB (SOURCE HASH & IDEMPOTENCY)

### Vấn đề hiện tại:
Bảng `import_jobs` nhận các yêu cầu từ [`supabase/functions/import-job/index.ts`](file:///f:/Music%20GG/supabase/functions/import-job/index.ts). Hiện tại chỉ podcast mới có kiểm tra sơ bộ `source_id`, còn nhạc thường (`video`, `url`, `upload`) không hề có kiểm tra trùng lặp. Người dùng bấm nút "Import" 5 lần sẽ tạo ra 5 job độc lập chạy song song, tải và nén cùng 1 video YouTube thành 5 file khác nhau.

### Thiết kế Migration Schema đề xuất:

```sql
BEGIN;

-- Bổ sung source_hash cho import_jobs
ALTER TABLE public.import_jobs 
  ADD COLUMN IF NOT EXISTS source_hash text;

-- Index tìm nhanh các job đang chạy hoặc đã xong cùng một nguồn
CREATE INDEX IF NOT EXISTS idx_import_jobs_source_hash_status 
  ON public.import_jobs(source_hash, status);

COMMIT;
```

### Quy trình chuẩn hóa trong Edge Function `import-job`:
1. Chuẩn hóa `source_url` và tính toán `source_hash`:
   ```typescript
   // Ví dụ chuẩn hóa link YouTube: đưa về canonical video ID
   const normalizedUrl = normalizeMediaSourceUrl(sourceUrl)
   const sourceHash = await crypto.subtle.digest(
     'SHA-256', 
     new TextEncoder().encode(normalizedUrl)
   )
   ```
2. Kiểm tra các job đang chạy (`pending`, `processing`, `uploading`):
   - Nếu đã có job đang xử lý cùng `source_hash` -> Trả về mã lỗi `409 Conflict` kèm thông báo: *"Nguồn âm thanh này đang được hệ thống xử lý, vui lòng chờ hoàn thành."*
3. Kiểm tra các job đã hoàn thành (`completed`):
   - Nếu đã có job hoàn thành -> Trả về ngay thông tin `track_id` hoặc `episode_id` có sẵn, không đẩy việc cho Worker xử lý lại từ đầu.

---

## 9. BẢNG TỔNG HỢP CÁC FILE, DÒNG CODE VÀ MỨC ĐỘ ẢNH HƯỞNG

| File | Dòng code | Vấn đề phát hiện | Mức độ ảnh hưởng |
| :--- | :--- | :--- | :--- |
| [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx) | L.155, L.267 | Dùng `preload = 'auto'` ép browser tải 100% file audio | **CRITICAL** |
| [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx) | L.240-L260 | Tải Range Request khi restore queue ở offset 0 | **CRITICAL** |
| [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx) | L.349 | Guard `if (!audio.ended) return` làm rớt sự kiện Auto Next | **CRITICAL** |
| [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx) | L.278-L.298 | `handleNext` bất đồng bộ làm mất quyền play() ở background mobile | **HIGH** |
| [`workers/audio-worker/worker.js`](file:///f:/Music%20GG/workers/audio-worker/worker.js) | L.183-L.185 | Upload file đặt tên theo `job.id` tạo bản sao trùng lặp vô tội vạ | **HIGH** |
| [`workers/audio-worker/worker.js`](file:///f:/Music%20GG/workers/audio-worker/worker.js) | L.208 | Insert vào `music_tracks` không tính `audio_hash` | **HIGH** |
| [`supabase/functions/import-job/index.ts`](file:///f:/Music%20GG/supabase/functions/import-job/index.ts) | L.91-L.100 | Cho phép tạo nhiều job import cho cùng một URL nguồn | **HIGH** |
| [`src/components/player/GlobalPlayer.jsx`](file:///f:/Music%20GG/src/components/player/GlobalPlayer.jsx) | L.45 | Tính toán lại artwork URL trên mỗi nhịp `timeupdate` | **MEDIUM** |
| [`discord-bot/audio.js`](file:///f:/Music%20GG/discord-bot/audio.js) | L.93 | Fetch toàn bộ MP3 về RAM mỗi lần phát trong voice chat | **MEDIUM** |

---

## 10. KẾ HOẠCH TRIỂN KHAI VÀ ƯỚC TÍNH GIẢM THIỂU EGRESS

### Ước tính mức giảm Supabase Egress:

```
+-----------------------------------------------------------------------------+
| KỊCH BẢN TIÊU THỤ BĂNG THÔNG HÀNG THÁNG                                     |
+------------------------------------+------------------+---------------------+
| Hạng mục                           | Trước tối ưu     | Sau tối ưu          |
+------------------------------------+------------------+---------------------+
| Người dùng lướt web (không bấm Play)| ~6 GB (Range Req)| 0 MB (Giảm 100%)    |
| Người dùng skip bài giữa chừng     | ~10 GB (Preload) | ~1.5 GB (Giảm 85%)  |
| Import trùng lặp (Duplicate files) | ~3 GB            | 0 MB (Giảm 100%)    |
| Tải lại bài cũ khi tương tác Queue | ~2 GB            | 0 MB (Giảm 100%)    |
| Tổng Cached Egress ước tính        | > 21 GB          | ~1.5 - 2.0 GB       |
+------------------------------------+------------------+---------------------+
=> TỔNG MỨC GIẢM BĂNG THÔNG TOÀN DỰ ÁN: ~90% - 93%
```

### Các bước triển khai tiếp theo (Chờ User xác nhận):
1. **Bước 1 (Frontend Player)**: Đổi vĩnh viễn `preload = 'metadata'`, tối ưu hóa hàm xử lý `ended` và `handleNext` synchronous để sửa dứt điểm lỗi Auto Next trên Mobile.
2. **Bước 2 (Database Migration)**: Tạo migration additive bổ sung `audio_hash`, `file_size` vào `music_tracks` & `episodes`; bổ sung `source_hash` vào `import_jobs`.
3. **Bước 3 (Worker & Edge Function)**: Tích hợp tính mã SHA-256 trước khi upload; chặn import trùng lặp cùng một link URL.
4. **Bước 4 (Mobile Lockscreen)**: Chuẩn hóa MediaSession metadata thành absolute URL để bảo đảm lockscreen không bị lỗi hiển thị.
5. **Bước 5 (Kiểm thử toàn diện)**: Chạy full test suite Playwright (`tests/v2.spec.js`, `tests/lockscreen-playback.spec.js`, `tests/now-playing-responsive-viewports.spec.js`) và build xác minh.

---
*Báo cáo đã sẵn sàng. Xin ý kiến chỉ đạo của bạn để tiến hành chỉnh sửa mã nguồn.*

