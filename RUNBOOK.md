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

Các lệnh trên gọi [scripts/app.ps1](scripts/app.ps1).

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
cd server && PORT=4100 DATABASE_URL=postgres://postgres@127.0.0.1:5433/wayground_e2e_tmp JWT_SECRET=e2e node src/index.js > ../.temp/e2e-server.log 2>&1
# ở thư mục gốc, ví dụ script có sẵn:
node .temp/attempts-e2e.mjs
# dọn dẹp: tắt server test, rồi
"$PG/dropdb.exe" -h 127.0.0.1 -p 5433 -U postgres wayground_e2e_tmp
```

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
