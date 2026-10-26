# Vận hành bản đang chạy (runbook)

Hướng dẫn chạy, tắt, restart và kiểm tra bản app đang deploy trên máy này. Cài đặt lần đầu và chế độ dev xem [README.md](README.md).

## Lệnh nhanh

Chạy ở thư mục gốc repo (PowerShell, cmd hoặc Git Bash đều được):

| Việc | Lệnh |
|---|---|
| Xem trạng thái (DB, app, Tailscale, URL public) | `npm run app:status` |
| Chạy app | `npm run app:start` |
| Tắt app | `npm run app:stop` |
| Tắt app và cả PostgreSQL | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\app.ps1 stop -Db` |
| Restart (build lại client, áp dụng code mới) | `npm run app:restart` |
| Xem log khi app chạy nền (do tự khởi động) | `npm run app:logs` |
| Tìm trong log của server (request, ảnh, đăng nhập, lỗi…) | `npm run logs -- --days 7 --event "image.*"` (xem mục [Log](#log)) |

Các lệnh `app:*` gọi [scripts/app.ps1](scripts/app.ps1).

- `start` không làm gì nếu app đang chạy. Nếu chưa chạy, nó mở một **cửa sổ cmd riêng** chạy `npm run start`, rồi chờ `/api/health` trả lời (tối đa 5 phút).
- Cửa sổ đó vẫn chạy sau khi script kết thúc. **Log của server hiện trong cửa sổ đó.** Đóng cửa sổ là tắt app.
- Khi app được tự khởi động lúc bật máy, nó chạy nền, không có cửa sổ, và log ghi vào `logs/app.log`. `stop` / `restart` tắt được cả hai kiểu. Sau `restart`, app chạy lại ở kiểu cửa sổ.

## Tự khởi động khi bật máy

[scripts/autostart.ps1](scripts/autostart.ps1) tạo 2 tác vụ Task Scheduler, cả hai chạy dưới tài khoản Windows của bạn:

| Tác vụ | Khi nào | Làm gì |
|---|---|---|
| `WaygroundClone - startup` | 30 giây sau khi bật máy, **kể cả khi chưa ai đăng nhập**. Không lưu mật khẩu (kiểu đăng nhập S4U). | `app.ps1 serve`: bật DB, build, chạy server ở chế độ nền, log ra `logs/app.log` |
| `WaygroundClone - logon` | 2 phút sau khi bạn đăng nhập | Dự phòng khi tác vụ trên không chạy được: `app.ps1 start`; không làm gì nếu app đã chạy |

Cài / gỡ cần **PowerShell mở bằng quyền Administrator**, chạy ở thư mục gốc repo:

```powershell
npm run autostart:install     # cài (hoặc cài lại sau khi sửa script)
npm run autostart:uninstall   # gỡ
npm run autostart:status      # xem trạng thái, lần chạy gần nhất (không cần admin)
```

- `LastResult` = `0x0` là chạy thành công.
- Khi app đang chạy, `startup` hiện `Running`, vì tác vụ này chạy suốt cùng với app.
- Nếu máy dùng tài khoản domain công ty và lúc bật máy chưa liên lạc được domain, tác vụ `startup` có thể báo lỗi; khi đó tác vụ `logon` sẽ bật app sau khi bạn đăng nhập.

## Thành phần

| Thành phần | Chi tiết |
|---|---|
| PostgreSQL portable | Cổng `5433`, chương trình ở `database/App/PgSQL`, dữ liệu ở `database/Data/data`, log ở `database/Data/log.txt`. `npm run start` tự bật nếu đang tắt. |
| App (API + giao diện) | Một server Express ở cổng `4000`, phục vụ cả `client/dist` (build sẵn). `npm run start` = bật DB → build client → chạy `node server/src/index.js`. |
| Đường public | Tailscale Funnel của máy này → `http://127.0.0.1:4000`. URL không ghi trong repo (repo public): xem bằng `npm run app:status` hoặc `tailscale funnel status`, hoặc đặt `PUBLIC_URL=...` trong `.env` ở gốc (đã gitignore). Cấu hình Funnel được giữ qua các lần khởi động lại máy. |
| AI (Gemma) | Endpoint kiểu OpenAI cấu hình trong `server/.env` hoặc `.env` ở gốc (`LLM_BASE_URL`, `LLM_MODEL`…). Kiểm tra: `GET /api/ai/status` (cần đăng nhập). |

## Sau khi khởi động lại máy

Nếu đã cài tự khởi động (mục trên), app tự chạy khoảng 30 giây sau khi bật máy. Nếu chưa cài:

1. `npm run app:start`. Lệnh này tự bật PostgreSQL; app thường sẵn sàng sau khoảng 15 giây.
2. Chờ Tailscale kết nối. Lần gần nhất mất khoảng 50 giây; trong lúc đó `tailscale status` báo `NoState` hoặc "starting".
3. `npm run app:status`: cả bốn dòng phải là `running` / `Funnel on` / `ok`.

## Sau khi sửa code

- `npm run app:restart` để build lại client và chạy lại server. Thay đổi trong `server/src/schema.sql` được áp dụng tự động lúc server khởi động.
- Người dùng có thể phải tải lại trang bằng **Ctrl+F5**.
- Kiểm tra build mà **không** ghi đè `client/dist` đang chạy:
  ```bash
  cd client && node --input-type=module -e "import { build } from 'vite'; await build({ logLevel: 'error', build: { write: false } }); console.log('BUILD_OK');"
  ```
- Không chạy `npm run dev` trong khi app đang chạy, vì cả hai cùng dùng cổng 4000. Muốn dev thì `npm run app:stop` trước.

## Test end-to-end không đụng dữ liệu thật

File tạm chỉ được đặt trong `.temp/` (đã nằm trong `.gitignore`, theo yêu cầu trong CLAUDE.md).

```bash
PG=database/App/PgSQL/bin
"$PG/createdb.exe" -h 127.0.0.1 -p 5433 -U postgres wayground_e2e_tmp
# chạy server test ở cổng 4100 (để chạy nền, tắt khi xong)
cd server && PORT=4100 DATABASE_URL=postgres://postgres@127.0.0.1:5433/wayground_e2e_tmp JWT_SECRET=e2e LOG_DIR=../.temp/e2e-logs node src/index.js > ../.temp/e2e-server.log 2>&1
# ở thư mục gốc, ví dụ script có sẵn:
node .temp/attempts-e2e.mjs
# dọn dẹp: tắt server test, rồi
"$PG/dropdb.exe" -h 127.0.0.1 -p 5433 -U postgres wayground_e2e_tmp
```

`LOG_DIR` giữ log của server test ngoài `logs/` của bản đang chạy. Lưu ý: ảnh tải lên hoặc import trong lúc test vẫn ghi vào `server/uploads` thật; xoá các file test tạo ra khi xong.

## Log

Server ghi log có cấu trúc, mỗi dòng là một object JSON, ngày tính theo giờ máy:

| File | Nội dung | Giữ |
|---|---|---|
| `logs/server-YYYY-MM-DD.log` | Request, sự kiện, lỗi | 90 ngày |
| `logs/llm-YYYY-MM-DD.log` | Toàn bộ mỗi lần gọi model: system, prompt, response, tokens (xem [Log gọi LLM](#log-gọi-llm)) | 30 ngày |
| `logs/llm-images/YYYY-MM-DD/` | Ảnh đã gửi cho model | 30 ngày |

`logs/app.log` là thứ khác: nó chỉ chứa output màn hình khi app chạy nền.

- Log ghi theo cả hai kiểu chạy (cửa sổ cmd hoặc chạy nền).
- File quá hạn tự bị xoá khi server khởi động và mỗi khi sang ngày mới.
- `logs/` không vào git (đã có trong `.gitignore`).
- Ra màn hình chỉ in dòng `warn` và `error`. Muốn in tất cả thì đặt `LOG_CONSOLE=info`.

### Tìm trong log

```bash
npm run logs                                          # 200 dòng cuối của hôm nay
npm run logs -- --days 7 --event "image.*"            # mọi sự kiện về ảnh trong 7 ngày
npm run logs -- --days 90 --grep 0a1b2c3d4e5f60718293 # mọi dòng nhắc tới file ảnh uploads/0a1b2c3d4e5f60718293.jpg
npm run logs -- --user 3 --since 2026-10-20 --until 2026-10-22
npm run logs -- --level warn                          # chỉ cảnh báo và lỗi
npm run logs -- --days 30 --json --last 0 > .temp/out.jsonl
```

Tuỳ chọn đầy đủ ở đầu [scripts/logs.mjs](scripts/logs.mjs). Trong Git Bash, tham số bắt đầu bằng `/` bị đổi thành đường dẫn Windows: dùng `--grep uploads/abc` thay vì `--grep /uploads/abc`.

### Sự kiện

Các trường chung: `time`, `level`, `event`, `req` (mã request, trùng header `X-Request-Id`), `user` (id giáo viên), `player` (id người chơi). `req`, `user`, `player` được gắn tự động cho mọi dòng ghi trong lúc xử lý request, kể cả việc chạy nền mà request đó khởi động (ví dụ job tạo bài thi đọc).

| Sự kiện | Khi nào | Trường chính |
|---|---|---|
| `http` | Mỗi request tới `/api/*` và `/uploads/*` | `method`, `url`, `status`, `ms`, `ip`, `ua`; với ảnh: `ref` = trang đã hiển thị ảnh |
| `auth.signup`, `auth.login`, `auth.login.failed` | Đăng ký, đăng nhập | `user`; `email` khi đăng ký hoặc đăng nhập sai |
| `image.search` | Giáo viên bấm Search images | `q`, `results` (nguồn, tiêu đề, url, trang gốc của mọi ảnh đã hiện ra) |
| `image.import`, `image.import.failed` | Giáo viên chọn một ảnh từ kết quả tìm | `src`, `file` |
| `image.auto` | AI tự gắn ảnh minh hoạ | `question`, `queries`, `candidates`, `pick`, `chosen`, `file` |
| `image.provider.failed` | Một nguồn ảnh (Wikimedia, Openverse…) lỗi hoặc quá thời gian | `provider`, `q`, `err` |
| `question.image` | Ảnh của câu hỏi được đặt hoặc đổi | `quiz`, `question`, `from`, `to`, `credit` |
| `question.delete`, `quiz.update`, `quiz.publish`, `quiz.delete` | Sửa, xoá, xuất bản quiz | `quiz`, `question`, `changes` |
| `upload` | Giáo viên hoặc học sinh tải file lên | `file`, `type`, `size`, `name`, `session` |
| `session.create`, `session.delete` | Tạo, xoá phiên | `session`, `code`, `quiz`, `kind` |
| `session.join` | Học sinh vào phiên | `session`, `player`, `name`, `attempt`, `tok` |
| `player.kick`, `player.disconnect`, `player.delete` | Giáo viên loại học sinh | `session`, `player` |
| `ai.generate`, `ai.reading.start`, `ai.reading.done`, `ai.reading.failed`, `ai.failed` | Tạo quiz bằng AI | `quiz`, `added`, `illustrated`, `files`, `ms` |
| `llm.chat`, `llm.chat.failed` | Mỗi lần gọi model | `llm` (mã lần gọi), `purpose`, `attempt`, `model`, `ms`, `images`, `promptChars`, `replyChars`, `tokensIn`, `tokensOut`, `finish` |
| `llm.json.failed` | Model trả lời không phải JSON (server thử lại 1 lần) | `llm`, `purpose`, `attempt`, `err` |
| `http.failed`, `realtime.broadcast.failed`, `process.crash` | Lỗi | `err` (lỗi 5xx kèm stack) |
| `server.start` | Server khởi động | `port`, `pid`, `logDir` |

### Log gọi LLM

Mỗi lần gọi model sinh ra hai bản ghi, nối với nhau bằng mã `llm`:

- Dòng `llm.chat` trong `server-*.log`: thời gian, tokens, mục đích gọi.
- Một dòng trong `llm-*.log`: toàn bộ `system`, `prompt` và `reply` (không cắt ngắn), cùng `temperature`, `maxTokens`, `usage`, `finish`, `error` nếu lỗi, và `reasoning` nếu model trả về.

Ảnh gửi cho model được lưu thành file `llm-images/<ngày>/<sha256>.<đuôi>`. Trong log, trường `images` chỉ ghi đường dẫn file, loại ảnh và kích thước. Ảnh trùng nhau trong cùng một ngày chỉ lưu một lần.

Giá trị của `purpose` cho biết lời gọi từ tính năng nào:

| `purpose` | Tính năng |
|---|---|
| `generate` | Tạo quiz bằng AI |
| `image.plan`, `image.pick` | Chọn từ khoá tìm ảnh minh hoạ; chọn ảnh hợp nhất |
| `similar`, `explanations`, `translate`, `enhance`, `grade` | Các AI action trong quiz; chấm câu tự luận |
| `reading.detect`, `reading.crop`, `reading.worksheet`, `reading.photo` | Bài thi đọc từ ảnh: nhận dạng trang, soát ảnh cắt, chuyển phiếu bài tập, viết bài từ ảnh |

```bash
npm run logs -- --event "llm.*" --days 7                   # thời gian, tokens, lỗi của mọi lần gọi
npm run logs -- --llm --event "reading.*"                  # các lần gọi của bài thi đọc hôm nay (văn bản cắt còn 300 ký tự)
npm run logs -- --llm --days 30 --grep 1a2b3c4d5e --json   # toàn bộ một lần gọi, theo mã llm
npm run logs -- --llm --user 3 --json --last 0 > .temp/llm-user3.jsonl
```

### Truy vết một ảnh bị báo cáo

1. Lấy tên file của ảnh (`/uploads/<file>`): hỏi người báo, hoặc tra bảng `questions` trong DB.
2. `npm run logs -- --days 90 --grep <file>`:
   - `image.auto`, `image.import`, `question.image` hoặc `upload` cho biết ảnh đến từ đâu, ai gắn vào câu hỏi nào.
   - Các dòng `http` của ảnh cho biết ai đã xem: `ref` có dạng `/play/~<tok>` (học sinh) hoặc `/admin/...` (giáo viên).
3. `npm run logs -- --days 90 --grep <tok>`: dòng `session.join` cho biết tên học sinh và phiên.

### Dữ liệu trong log

- **Không ghi**: mật khẩu, JWT, token người chơi, API key, body của request. Token người chơi trong URL được thay bằng `~<tok>`: 10 ký tự đầu của SHA-256, không suy ngược ra token.
- **Có ghi**: email (khi đăng ký hoặc đăng nhập sai), tên học sinh, IP, User-Agent. Đây là dữ liệu cá nhân, không gửi file log ra ngoài.
- **`llm-*.log` và `llm-images/` chứa mọi thứ đã gửi cho model**: nội dung file và ảnh giáo viên tải lên, câu trả lời tự luận của học sinh (khi chấm bằng AI), cùng câu trả lời của model. Đặt `LOG_LLM_CONTENT=off` để tắt hai thứ này; dòng `llm.chat` trong `server-*.log` vẫn được ghi.
- IP: app chạy sau Tailscale Funnel, nên server chỉ đọc `X-Forwarded-For` khi request đến từ 127.0.0.1. Nếu `ip` của request từ ngoài luôn là `127.0.0.1`, nghĩa là Funnel không gửi header này.

### Biến môi trường (`.env`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `LOG_DIR` | `logs/` ở gốc repo | Thư mục chứa log |
| `LOG_RETENTION_DAYS` | `90` | Số ngày giữ `server-*.log`; `0` = giữ mãi |
| `LOG_LLM_CONTENT` | bật | `off` = không ghi `llm-*.log` và `llm-images/` |
| `LOG_LLM_RETENTION_DAYS` | `30` | Số ngày giữ `llm-*.log` và `llm-images/`; `0` = giữ mãi |
| `LOG_CONSOLE` | `warn` | Mức thấp nhất in ra màn hình: `debug`, `info`, `warn`, `error`, `off` |

## Xử lý sự cố

| Triệu chứng | Kiểm tra / cách xử lý |
|---|---|
| `start` báo cổng 4000 đang bận | `npm run app:stop` rồi `npm run app:start`. `stop` chỉ tắt tiến trình `node`; nếu chương trình khác chiếm cổng thì script cảnh báo và để nguyên. |
| `start` chờ hết 5 phút | Đọc lỗi trong cửa sổ `npm run start`: lỗi build client, lỗi kết nối DB… |
| Bật máy xong app không lên | `npm run autostart:status` để xem `LastResult` của 2 tác vụ; `npm run app:logs` để xem log của lần chạy nền. Trong lúc chờ, `npm run app:start` để bật tay. |
| PostgreSQL không lên | `npm run db:status`, xem `database/Data/log.txt`. |
| URL public không vào được nhưng `localhost:4000` vẫn chạy | `"C:\Program Files\Tailscale\tailscale.exe" funnel status`. Nếu mất cấu hình, bật lại bằng `tailscale funnel --bg 4000` (cú pháp của các bản Tailscale mới; kiểm tra lại bằng `tailscale funnel --help` nếu lệnh lỗi). Cảnh báo "Failed to set the network category to private" hiện chưa làm Funnel ngừng hoạt động. |
| Tính năng AI báo không kết nối được model | Kiểm tra server LLM đang chạy và `LLM_BASE_URL` trong `.env`, rồi restart app. |
| Người dùng vẫn thấy giao diện cũ | Ctrl+F5 để tải lại không dùng cache. |
