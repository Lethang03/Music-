# Soundverse — LDPlayer background playback E2E

Ngày: 2026-09-15. Device duy nhất: `emulator-5554`.

## Kết luận

**Chưa thể kết luận đã sửa hoàn toàn bug được mô tả.** Đã trực tiếp chạy ADB trên LDPlayer, thử baseline trước bản sửa và retest working tree. Playback tiến bình thường khi Android chuyển media action đến Soundverse. Nhưng `shell input keyevent KEYCODE_MEDIA_NEXT` sau khi màn hình đã OFF không chuyển bài trên emulator này, cả trước và sau bản sửa. Không đánh PASS cho trường hợp đó.

| Yêu cầu | Kết quả |
| --- | --- |
| LDPLAYER CONNECTION | **PASS** — Android 9, Chrome 124.0.6367.82 |
| BASELINE BUG REPRODUCED | **NO** với lỗi “source mới đã chọn nhưng audio đứng tới foreground”; **YES** với biểu hiện keyevent Next không chuyển bài khi OFF |
| BUILD | **PASS** — `npm run build` |
| FOREGROUND NEXT | **PASS** |
| BACKGROUND NEXT | **PASS** |
| LOCKED NEXT | **FAIL** với chính `input keyevent KEYCODE_MEDIA_NEXT` được yêu cầu |
| PREVIOUS | **PASS** khi background |
| PAUSE/RESUME | **PASS** khi background |
| AUTO-NEXT WHILE LOCKED | **PASS** với Music và Podcast |
| PODCAST | **FAIL** nếu xét toàn bộ ma trận: riêng locked input keyevent fail; foreground/background/Previous/Pause/Resume/auto-next và locked media-service đều pass |

**Đối chứng riêng:** `shell media dispatch next` khi `mWakefulness=Asleep`, `Display Power: state=OFF` **PASS**: metadata đổi, Android session `state=3`, HTMLAudioElement của source mới tiến. Đây là đường Android media service, không phải gọi JavaScript handler bằng test. Kết quả này không thay thế FAIL của input keyevent.

## Môi trường và cách chạy đã dùng

- ADB: `F:\LDPlayer\LDPlayer9\adb.exe`; mọi lệnh đều kèm `-s emulator-5554`.
- Đã chạy `get-state`, `shell getprop ro.build.version.release`, `dumpsys media_session`, `dumpsys power`, đọc phiên bản Chrome, logcat giới hạn 150 dòng/lượt.
- Ban đầu Chrome chưa phát, Android không có active media session. Mở Soundverse và chủ động Play qua UI mới tạo session `com.android.chrome/Chrome`, `active=true`.
- Local Vite bind `0.0.0.0:3100`. **ADB reverse `tcp:3100 tcp:3100`** nối loopback Android đến Windows, nên URL `http://127.0.0.1:3100` có tuyến truyền cụ thể; không giả định hai loopback là một.
- Dùng ứng dụng Soundverse thật, React player thật, Chrome Android thật; catalog/auth và WAV 90 giây là fixture local. Không đăng nhập tài khoản production, không gọi Supabase thật. Media files được phục vụ HTTP với Range support.
- Chrome debugging qua ADB forward 9222 chỉ dùng mở/chọn tab, Play và chuẩn bị seek trước auto-next. **Ngắt debugger trước mọi HOME/POWER/media-key sequence.** Chỉ giữ một tab fixture của nhiệm vụ ở lượt cuối.
- Native HOME, POWER, KEYCODE_MEDIA_NEXT/PREVIOUS/PLAY_PAUSE được gửi bằng ADB; không giả `visibilityState` hoặc dispatch DOM lifecycle events.
- Audio test là sóng có tín hiệu, không phải silent loop. Không thêm WakeLock, timer keep-alive hoặc polling vào player.

## Đo position: không chỉ nhìn metadata

Chrome 124 trên device này giữ `PlaybackState.position` như một mốc cùng `speed` và `updated`; nhiều lần dumpsys liên tiếp có cùng position dù media thật vẫn phát. Vì vậy không suy diễn rằng `state=3` hoặc mốc position cố định chứng minh thành công/thất bại.

Harness ghi thụ động `timeupdate/playing/pause/ended` của **HTMLAudioElement thật** sang server local, tối đa một timeupdate/giây. Không có timer để kích hoạt playback; chỉ quan sát media events. Mỗi snapshot lưu source, currentTime, paused, visibility và timestamp cùng Android session/power. PASS yêu cầu source mới, state=3 và currentTime tiến; không dùng position nội suy làm bằng chứng. Đây không phải phép đo âm thanh tại loa.

## Baseline trước fix

Phục vụ `src/contexts/AudioContext.jsx` từ **HEAD `a61008b`** qua Vite test plugin. Không ghi đè file đang sửa trong workspace. Các lần đầu được dùng kiểm tra harness; baseline dùng để kết luận ở `audit/ldplayer-baseline-final/`.

- Foreground Track 1 → Track 2, time 0 → 3.059 giây.
- HOME, chờ 5 giây, Next: Track 2 → Track 3, time 0.015 → 3.095 giây, hidden.
- Background Previous và Pause/Resume hoạt động.
- OFF trước khi gửi keyevent: Track 2 vẫn là Track 2; time tăng 9.774 → 15.094 giây. Không có bằng chứng source mới bị treo; bài cũ vẫn chạy.
- Auto-next sau chuẩn bị seek vẫn chạy khi display OFF. Baseline không tái hiện được lỗi đổi source rồi mất playback.

## Root cause và giới hạn kết luận

### Điều xác nhận bằng source

`nexttrack` vốn gọi `handleNext → load → safePlay` trực tiếp; **không phải chỉ setState rồi chờ useEffect đổi source**. UI Next và ended đã dùng cùng queue pipeline; persistent Audio instance đã có sẵn. Không có Web Audio processing/crossfade implementation trong playback hiện tại.

Bản sửa đã có trong workspace xử lý những điểm yếu xác định được:

- MediaSession effect trước đây phụ thuộc activeItem, gỡ handlers/metadata rồi đăng ký lại mỗi bài; giờ handlers ổn định theo vòng đời provider.
- Metadata cập nhật đồng bộ với source, không chờ React effect; empty queue xóa metadata/state ngay.
- Bỏ pause chủ động trước source switch; bỏ qua pause/ended event cũ khi trạng thái element không còn phù hợp.
- Previous từ MediaSession có play intent khi restart; rejection cập nhật session state và gắn đúng item.
- Giữ generation guard, resume position, queue/shuffle/repeat, persistent element; thêm seekforward/backward và diagnostic categories.

### Điều xác nhận bằng LDPlayer

Trong khoảng OFF → input keyevent Next → chờ 4 giây, diagnostic không ghi nhận `MEDIA_SESSION nexttrack`, source không đổi, audio cũ vẫn tiến. Ngay sau `media dispatch next`, diagnostic ghi:

`MEDIA_SESSION → MANUAL_NEXT → NEXT_SELECTED → SOURCE_CHANGED → PLAY_REQUEST → LOADEDMETADATA → CANPLAY → PLAYING → PLAY_SUCCESS`, tất cả khi hidden.

Ví dụ Music: handler vào lúc **09:16:21.487 UTC**, PLAY_REQUEST lúc **09:16:21.500**, PLAYING lúc **09:16:21.617**. Source mới lên 3.078 giây sau đó, screen vẫn OFF.

**Kết luận có căn cứ:** FAIL còn lại nằm trước khi action tới JavaScript trong đường input injection của môi trường này. Chưa xác định chính xác nhánh Android/LDPlayer gây giữ hoặc bỏ key event; không gán chắc chắn cho một chính sách OS cụ thể. Web player không thể tự xử lý một action chưa được giao. Không thêm hack hoặc refactor tiếp để che FAIL. Root cause của hiện tượng production “đã đổi source nhưng phải mở khóa mới phát” chưa được chứng minh bởi fixture này.

## Retest Music — số đo cuối

| Test | Bằng chứng audio thật và Android state | Kết quả |
| --- | --- | --- |
| Foreground Next | Track 2: 0.020 → 4.133s; visible, state=3 | PASS |
| Background Next | Track 3: 0.009 → 3.058s; hidden, state=3 | PASS |
| Previous background | Track 3 → Track 2: 0.010 → 3.077s; state=3 | PASS |
| Pause | Track 2: 4.612 → 4.612s; paused=true, state=2 | PASS |
| Resume | Track 2: 4.612 → 7.609s; paused=false, state=3 | PASS |
| Locked Next, input keyevent | Track 2 vẫn Track 2: 9.811 → 14.049s; OFF | FAIL |
| Locked Next, media service | Track 3: 0.011 → 3.078s; OFF, hidden, state=3 | PASS đối chứng |
| Natural ended khi locked | Track 3 ở 72.895/90s khi OFF → Track 1 ở 7.291 → 11.544s; OFF, state=3 | PASS |

Previous dùng hai lần bấm: lần đầu restart vì đã qua 3 giây, lần thứ hai trở về bài trước theo behavior có sẵn. Auto-next dùng repeat-all để chứng minh vòng queue Track 3 → Track 1. Seek chuẩn bị thực hiện khi foreground, cách cuối bài 20 giây; sau đó HOME và POWER, xác nhận OFF trước khi để bài kết thúc tự nhiên.

## Retest Podcast

| Test | Bằng chứng | Kết quả |
| --- | --- | --- |
| Foreground Next | Episode 2: 0.030 → 3.049s; visible, state=3 | PASS |
| Background Next | Episode 3: 0.009 → 3.047s; hidden, state=3 | PASS |
| Previous background | Episode 3 → Episode 2, phát tiếp; state=3 | PASS |
| Pause/Resume background | state=2, time đứng; sau resume state=3, time tăng | PASS |
| Locked input keyevent | Episode 2 không đổi, 9.750 → 15.062s; OFF | FAIL |
| Locked media service | Episode 3: 0.006 → 3.063s; OFF, state=3 | PASS đối chứng |
| Auto-next locked | Episode 3 ở 73.008/90s khi OFF → Episode 1 ở 7.316 → 11.564s; OFF, hidden, state=3 | PASS |

Không thấy hồi quy riêng cho engine Podcast. Kết quả tổng thể FAIL giữ đúng tiêu chí bắt buộc về input keyevent, không đổi thành PASS vì các test khác thành công.

## Build / regression

- `npm run build`: **PASS**, cảnh báo chunk chính >500 kB; không phải build failure.
- ESLint các file playback và harness: **PASS**.
- Playwright focused regression: **19/19 PASS**, 49.3 giây. Gồm Music/Podcast synchronous commands, stable handlers, rapid-next/rejection/stale-ended, queue removal, repeat/shuffle, autoplay off, play-next priority và podcast resume.
- Lượt trước trong cùng nhiệm vụ đã có 35/35 V2 + lockscreen regressions pass; lần này chạy lại 19 test liên quan.
- Không thay test cũ để ép pass.

## Files inspected / changed

Đã inspect lại `src/contexts/AudioContext.jsx`; đối chiếu các file đã kiểm tra trong báo cáo trước: GlobalPlayer, main, App/AudioBridge, LibraryContext, PodcastDetail, storage, diagnostics, service worker, fixtures và Vite config.

Files source thay đổi so với HEAD, giữ từ bản sửa trước:

- `src/contexts/AudioContext.jsx`
- `src/lib/playbackDiagnostics.js`
- `tests/lockscreen-playback.spec.js`

Files bổ sung cho E2E lần này:

- `audit/ldplayer-server.mjs`: server fixture local; `--baseline` lấy controller từ HEAD.
- `audit/ldplayer-e2e.mjs`: ADB procedure, CDP chỉ chuẩn bị foreground, snapshots và diagnostic capture.
- `audit/ldplayer-results.mjs`: chấm kết quả từ evidence, giữ FAIL của keyevent riêng với service dispatch.
- Báo cáo này, cập nhật liên kết trong báo cáo trước và các evidence `audit/ldplayer-*`.

Không thêm một candidate source fix mới sau khi E2E chỉ ra giới hạn delivery bên ngoài playback controller. Một candidate hiện có được build/test và kiểm tra lặp; không vượt 3 lượt retest candidate, không tiếp tục refactor vô căn cứ.

## Evidence và giới hạn

- Baseline: [summary](audit/ldplayer-baseline-final/summary.json).
- Music: [summary](audit/ldplayer-final-music/summary.json), [verdict](audit/ldplayer-final-music/verdict.json), [diagnostics](audit/ldplayer-final-music/diagnostics.json).
- Podcast: [summary](audit/ldplayer-final-podcast/summary.json), [verdict](audit/ldplayer-final-podcast/verdict.json), [diagnostics](audit/ldplayer-final-podcast/diagnostics.json).
- Mỗi thư mục chứa dumpsys trước/sau từng thao tác và bounded logcat. Các lần kiểm tra harness ban đầu cũng được giữ, nhưng không dùng để đánh PASS foreground nếu tab không thực sự visible.
- Chỉ LDPlayer Android 9 / Chrome 124, fixture local và Chrome tab được test. Installed PWA, iOS, URL production/CDN/codec/mạng thật: **NOT TESTED**. Không claim vượt giới hạn browser/OS hoặc đã sửa mọi biến thể production.
- Không push, deploy, sửa Railway/Discord bot/Supabase schema, reset emulator hoặc cài software.
- Sau khi thu evidence: đã pause playback kiểm thử, dừng server fixture và gỡ các ADB reverse/forward tạo riêng cho nhiệm vụ. Không reset hoặc tắt emulator.
