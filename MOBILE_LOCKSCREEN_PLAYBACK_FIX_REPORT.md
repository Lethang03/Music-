# Soundverse: mobile lock-screen playback fix

> Cập nhật sau kiểm thử LDPlayer: xem [LDPLAYER_BACKGROUND_PLAYBACK_E2E_REPORT.md](LDPLAYER_BACKGROUND_PLAYBACK_E2E_REPORT.md). Đã kiểm tra Android 9/Chrome 124 bằng ADB; background playback và media-service dispatch pass, nhưng input keyevent Next khi màn hình OFF vẫn fail. Các giả thuyết dưới đây không được xem là root cause đã chứng minh cho lỗi production. Phần “chưa test thiết bị” bên dưới mô tả thời điểm báo cáo ban đầu; báo cáo LDPlayer là kết quả mới hơn.

## Kết quả và phạm vi xác minh

Đã sửa vòng đời MediaSession và đồng bộ source/metadata trong playback controller hiện có. Không rewrite AudioProvider. Kiểm thử tự động dùng Chrome desktop với HTMLAudioElement thật và audio WAV fixture; visibility/pagehide được mô phỏng. Chưa kiểm thử khóa màn hình vật lý trên Android hoặc iOS, vì vậy chưa thể kết luận lỗi trên thiết bị người dùng đã được giải quyết hoàn toàn.

## Root cause: bằng chứng và phần chưa xác nhận

- Giả thuyết `nexttrack → chỉ setState → useEffect mới play` **không đúng với phiên bản hiện tại**. Handler vốn đã gọi `handleNext → load → safePlay` trực tiếp, trước khi await.
- Lỗi kiến trúc xác định được: effect MediaSession phụ thuộc `state.activeItem`. Mỗi lần đổi bài, cleanup xóa handlers và metadata, rồi effect đăng ký lại. Metadata vì thế chỉ theo kịp sau React commit; test mới kiểm tra ngay trong cùng lượt gọi sẽ phát hiện metadata cũ ở implementation trước.
- `load` chủ động gọi `pause()` trước khi đổi source. Pause event có thể đến sau khi đã yêu cầu bài mới và ghi `paused` vào session. Việc chủ động nhả playback rồi đăng ký lại controls là rủi ro cho background media session; chưa có trace điện thoại để chứng minh đây là nguyên nhân duy nhất của việc mất tiếng.
- Previous ở nhánh restart (>3 giây hoặc item đầu tiên) chỉ seek, không phát lại khi đang paused. Play rejection cập nhật UI nhưng chưa đồng bộ playbackState. Metadata/state khi xóa queue chưa được xóa đồng bộ trong controller.
- Promise rejection trước đây đã có catch và generation guard; không phải lỗi bị nuốt hoàn toàn. Giữ guard đó và sửa attribution để lỗi thuộc item đã yêu cầu, không thuộc bài mới.

## Files inspected

- `src/contexts/AudioContext.jsx`: toàn bộ queue, commands, media events, persistence, MediaSession.
- `src/components/player/GlobalPlayer.jsx`: Next/Previous/Play/Pause/seek đều gọi context; không sở hữu audio khác.
- `src/main.jsx`, `src/App.jsx`: StrictMode, AudioBridge và provider ổn định theo user, service worker setup.
- `src/lib/storage.js`, `src/lib/playbackDiagnostics.js`: URL, storage, diagnostics.
- `src/contexts/LibraryContext.jsx`: progress persistence và pagehide.
- `src/features/podcast/PodcastDetail.jsx`: queue episode được sắp xếp trước khi gọi playItem.
- `public/sw.js`: audio và Range requests đi qua network, không bị navigation cache can thiệp.
- `tests/fixtures.js`, `tests/v2.spec.js`, `playwright.config.js`, `package.json`, `.eslintrc.cjs`.
- Tìm toàn bộ `src`/`public` cho mediaSession, new Audio, lifecycle, Web Audio và crossfade. MediaSession chỉ đăng ký trong AudioProvider. Audio tạm trong TrackForm chỉ dùng nhập nội dung.

## Files changed

1. `src/contexts/AudioContext.jsx`.
2. `src/lib/playbackDiagnostics.js`.
3. `tests/lockscreen-playback.spec.js`.
4. Báo cáo này.

## Architecture trước / sau

| Phần | Trước | Sau |
| --- | --- | --- |
| MediaSession handlers | Effect theo activeItem, gỡ và đăng ký mỗi bài | Effect theo callbacks ổn định; cleanup khi provider teardown |
| Next | Shared handleNext/load/safePlay | Giữ cùng pipeline và queue logic |
| Source switching | pause → src → load → play | src → load → đồng bộ item/metadata → play ngay trong command |
| Metadata | Sau React render | Đồng bộ với source trong controller; artwork lỗi có fallback text |
| Buffering state | Có thể bị pause event cũ ghi đè | Giữ session playing trong chuyển bài có play intent; bỏ pause event nếu element đã tiếp tục phát |
| Previous từ OS | Restart không resume khi paused | Dùng handlePrev với play intent; giữ quy tắc restart sau 3 giây |
| Seek | seekto | Thêm seekforward/seekbackward, mặc định 10 giây |
| Ended | Luôn xử lý event | Chỉ xử lý khi element thực sự ended; tránh event cũ sau đổi source |
| Empty queue | Chờ effect cleanup | Xóa metadata, position và set none đồng bộ |

### Audio source switching

MediaSession Next / UI Next → `handleNext(false)` → chọn index theo queue/shuffle/repeat/play-next hiện có → `load` → báo progress bài cũ → tăng generation → lấy URL từ item đã có → gán source trên **cùng một Audio instance** → `load()` → cập nhật model và metadata → `safePlay()` ngay, không chờ render, timer hoặc canplay.

`play()` tự chờ media readiness. Không thêm vòng polling, listener canplay để gọi play lần hai, hoặc retry tự động. `loadedmetadata` tiếp tục áp dụng resume offset, cập nhật duration và position. `seek` tiếp tục clamp và cập nhật setPositionState. Position cũ được clear khi đổi item. Playing/pause/error và play rejection cập nhật trạng thái tương ứng. Generation guard ngăn rejection từ source cũ ghi đè bài mới.

### Auto-next

HTMLAudioElement `ended` → xác nhận `audio.ended` → report completion → **cùng `handleNext(true)`** → cùng `load/safePlay`. Giữ autoplay off, repeat one/all, shuffle và priority queue hiện có. Không có controller riêng cho Podcast hoặc lock screen.

## Lifecycle/background findings

- Một Audio instance persistent trong provider, kể cả StrictMode effect restart. Listeners có cleanup đối xứng; không tạo audio mới mỗi bài.
- `visibilitychange` chỉ ghi diagnostic. `pagehide` chỉ lưu progress; không pause hoặc reset source. Không thêm pageshow autoplay.
- Chỉ logout/provider teardown/clear queue mới dừng và xóa source.
- Không thấy Web Audio processing hoặc crossfade implementation trong playback hiện tại. Tên `AudioContext.jsx` là React context, không phải Web Audio AudioContext. Không cần fallback Web Audio hoặc thay đổi crossfade.
- Không thêm silent loop, Wake Lock, autoplay hack, keep-alive hoặc timer background.
- Diagnostics vẫn local-only, tối đa 200 entries, không log timeupdate. Thêm category `[MEDIA_SESSION]`, `[BACKGROUND_PLAYBACK]`, `[AUDIO_PLAY]`; source bỏ query/fragment, rejection detail chỉ lưu tên lỗi để tránh URL ký trong message.

## Tests run

| Kiểm tra | Kết quả |
| --- | --- |
| `node node_modules/@playwright/test/cli.js test tests/lockscreen-playback.spec.js tests/v2.spec.js` | **PASS: 35/35**, 1.7 phút |
| 4 regression mới | **PASS**: Music và Podcast command đồng bộ, stable handlers, natural ended, cùng Audio instance, rapid Next/rejection cũ/stale ended, rejection hiện tại, clear session |
| 31 test hiện có, không sửa test cũ | **PASS**: queue, shuffle/repeat, autoplay off, playlist, persistence, podcast resume, desktop/mobile UI và các regression V2 khác |
| `node node_modules/eslint/bin/eslint.js src/contexts/AudioContext.jsx src/lib/playbackDiagnostics.js tests/lockscreen-playback.spec.js` | **PASS** |
| `node node_modules/vite/bin/vite.js build` | **PASS**, có cảnh báo chunk chính >500 kB |
| `git diff --check` | **PASS** |
| Khóa màn hình Android Chrome/PWA, iOS Safari/PWA vật lý | **NOT RUN**, cần checklist dưới đây |

Lần chạy sandbox đầu bị EPERM khi khởi tạo esbuild/process và thư mục test output; chạy lại với quyền thực thi đã được duyệt thì build và suite đều hoàn tất. Test gọi callback đã capture từ setActionHandler và kiểm tra source/play/metadata ngay trước React commit. Audio thật phát và kết thúc tự nhiên; trạng thái hidden và pagehide là event mô phỏng, không giả lập OS suspension hoặc hành động từ notification thật. Không có FAIL còn lại trong các kiểm tra đã chạy.

## Platform reality

- **Android Chrome:** MediaSession hỗ trợ controls từ notification và lock screen. Handler có thể phát source mới trên cùng element; session state có ích lúc loading/seeking. Đây là thiết kế theo [Chrome Media Session documentation](https://developer.chrome.com/blog/media-session), không phải bằng chứng test trên điện thoại này.
- **Installed Android PWA:** chạy cùng pipeline web; cài PWA không tạo native background service. Cần test riêng chế độ standalone, mạng và battery settings thực tế. Service worker hiện không cache audio để bảo đảm offline-next.
- **iOS Safari/PWA:** cần kiểm tra trên phiên bản OS/browser cụ thể; controls hiện ra và khả năng tiếp tục background phụ thuộc nền tảng. Các lỗi Web Audio background đã được ghi nhận ở [WebKit bug 261554](https://bugs.webkit.org/show_bug.cgi?id=261554); project này không dùng Web Audio nên không áp dụng workaround đó.
- App web không thể bảo đảm tiếp tục nếu OS đình chỉ/kill process, browser không giao action, mạng mất, URL hết hạn hoặc codec không hỗ trợ. Không claim vượt giới hạn nền tảng.

## Manual test checklist — chưa chạy trên thiết bị thật

Ghi device, OS, Chrome/Safari version, browser hay installed PWA, battery saver và kết nối. Dùng 3 bài/episode URL hợp lệ; shuffle off, repeat none, autoplay on.

### Android Chrome

1. Mở Soundverse, play Track 1; xác nhận có âm thanh.
2. Khóa màn hình, chờ 10 giây.
3. Bấm Next từ lock screen. Expected: Track 2 phát ngay, metadata Track 2, không mở khóa.
4. Bấm Previous trong 3 giây đầu Track 2. Expected: Track 1 phát ngay. Nếu đã hơn 3 giây, lần bấm đầu restart bài hiện tại theo quy tắc sẵn có; bấm lại ngay để về bài trước.
5. Pause rồi Play khi vẫn khóa. Expected: dừng/resume ngay.
6. Để bài kết thúc tự nhiên. Expected: bài sau tự phát khi vẫn khóa, nếu browser cho phép; tiếp tục qua Track 3.
7. Lặp Next/Previous/Pause/Play từ notification media controls, gồm Next nhanh 2 lần; expected mỗi action tiến đúng một item, không nhảy thêm vì ended cũ.
8. Mở khóa: UI, metadata, progress khớp âm thanh. Không phát chồng. Seek và volume vẫn hoạt động.

### Android installed PWA

Lặp toàn bộ 1–8 từ icon PWA, gồm chờ 10 giây sau khóa và natural auto-next qua ba bài. Ghi riêng kết quả so với Chrome tab.

### Podcast

Lặp toàn bộ các bước trên với Episode 1/2/3 trong Chrome và PWA. Kiểm tra thứ tự episode/season, pause/resume offset sau refresh, rồi chuyển Music → Podcast → Music; chỉ một audio phát.

### iOS Safari và installed PWA

Lặp checklist trên riêng từng chế độ. Ghi controls thực sự hiển thị, latency và lỗi nếu có. Không đánh PASS khi chỉ metadata đổi mà không nghe được âm thanh.

### Khi fail

Ghi thời điểm và action; sau khi mở khóa lấy localStorage key `soundverse_playback_diagnostics`. Đối chiếu MEDIA_SESSION → MANUAL_NEXT/NEXT_SELECTED → SOURCE_CHANGED → PLAY_REQUEST → PLAYING hoặc PLAY_REJECTED, kèm visibility/readyState/networkState. Không chia sẻ auth tokens hoặc URL có chữ ký.

## Scope

Không sửa Discord bot, Railway, Supabase schema; không git push hoặc deploy.
