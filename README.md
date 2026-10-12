# Wayground Clone

Bản clone của [Wayground](https://wayground.com) (trước đây là Quizizz), tập trung vào **Assessment**: soạn quiz, chơi live / giao bài về nhà, báo cáo và các tính năng AI dùng Gemma 4.

- **Backend**: Node.js 20, Express, Socket.IO, PostgreSQL (bản portable trong `database/`)
- **Frontend**: React 18, Vite, Tailwind CSS
- **AI**: endpoint chuẩn OpenAI `/v1/chat/completions` (Gemma 4 multimodal qua FPT AI Marketplace, Ollama, LM Studio…)

## Chạy nhanh

```bash
npm run setup     # cài dependency, khởi tạo + chạy PostgreSQL portable (cổng 5433), tạo DB, seed dữ liệu mẫu
npm run dev       # API http://localhost:4000 + web http://localhost:5173
```

Mở http://localhost:5173 và đăng nhập tài khoản mẫu **demo@wayground.local / demo123** (hoặc tự đăng ký).
Học sinh vào http://localhost:5173/join (hoặc quét QR trên màn hình host). Trong mạng LAN, dùng IP máy thay cho `localhost`.

Các lệnh khác:

| Lệnh | Việc làm |
| --- | --- |
| `npm start` | Build client và chạy một server duy nhất ở http://localhost:4000 |
| `npm run db:start` / `db:stop` / `db:status` | Quản lý PostgreSQL portable (dữ liệu ở `database/Data/data`) |
| `npm run seed` | Thêm lại tài khoản demo và các quiz mẫu (không trùng lặp) |

## Cấu hình AI

Server đọc `server/.env` rồi tới `.env` ở thư mục gốc. Hỗ trợ cả hai bộ tên biến:

```env
# .env (thư mục gốc)
FPT_BASE_URL=https://mkp-api.fptcloud.com/v1
FPT_MODEL=gemma-4-31B-it
FPT_API_KEY=...
LLM_TEMPERATURE=0
```

hoặc `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` (ưu tiên hơn). Kiểm tra kết nối: `GET /api/ai/status`.

### Ảnh minh hoạ

Khi AI tạo câu hỏi, model đề xuất từ khoá ảnh cho từng câu; server tìm ảnh miễn phí, cho Gemma chọn ảnh khớp nhất theo tiêu đề, tải về `server/uploads` và lưu ghi công (license) hiển thị dưới ảnh. Trong editor có nút **Search images**, trong quiz có AI action **Add images**.

Nguồn mặc định không cần key: **Wikimedia Commons** và **Openverse**. Thêm key miễn phí vào `.env` để dùng thêm (ưu tiên trước):

```env
PIXABAY_API_KEY=...
PEXELS_API_KEY=...
UNSPLASH_ACCESS_KEY=...
```

## Chức năng

**Giáo viên**
- Đăng ký / đăng nhập đơn giản (email + mật khẩu, JWT).
- Home với Create / Search / Upload, thư viện (Created / Draft / Archived, Previously used), Explore thư viện công khai.
- Tạo Assessment: từ đầu, từ chủ đề hoặc văn bản (AI), từ file PDF / DOCX / TXT / ảnh (AI multimodal), từ link web, import CSV theo template.
- Trình soạn quiz: danh sách câu hỏi kéo thả để sắp xếp, đổi điểm / thời gian từng câu hoặc hàng loạt, nhân bản, xoá, tìm câu hỏi từ quiz công khai, Settings (tên, môn, khối, ngôn ngữ, quyền xem, ảnh bìa, mục tiêu), Preview, Publish.
- **24 dạng câu hỏi** (23 loại + Passage gắn được vào mọi câu): Multiple choice, Multi-select, True/False, Fill in the blank, Open ended, Table Fill In, Passage, Drag and drop, Dropdown, Categorize, Reorder, Match, Hot text, Match Table Grid, Labeling, Hotspot, Graphing, Math response (so sánh biểu thức tương đương), Draw, Video response, Audio response, Poll, Word cloud, Discussion board. Có chấm điểm từng phần.
- AI: tạo quiz, thêm câu tương tự (cả quiz hoặc từng câu), viết giải thích đáp án, dịch quiz, “Enhance” từng câu (dễ hơn / khó hơn / viết lại / sửa lỗi / cải thiện phương án nhiễu), chấm câu tự luận.
- Host: Student paced hoặc Teacher led, chế độ Classic / Test; cài đặt số lần làm, timer, xáo câu / đáp án, hiện đáp án, leaderboard, memes, ẩn tên, bỏ qua câu. Lobby có mã 6 số + QR, theo dõi trực tiếp, reveal + phân bố đáp án, leaderboard, podium.
- **Share with students**: tạo ngay bài giao hạn 24 giờ, trang báo cáo có khung *Invite participants* (mã tham gia, link `/join?gc=…`, QR phóng to, chia sẻ qua Google Classroom / Teams / Email / WhatsApp / Facebook / X, sửa deadline) và drawer *Edit Settings* cho phiên đang chạy. Học sinh vào bài giao thấy màn hình chờ với nút *Start game* và deadline.
- Assign (homework) có hạn chót. Báo cáo: độ chính xác lớp, bảng học sinh × câu hỏi, phân tích từng câu, chấm tay / chấm AI, xuất CSV, mở lại / kết thúc phiên. Worksheet in được (có đáp án).

**Học sinh**
- Vào bằng mã, chọn tên + avatar, phòng chờ có reaction.
- Giao diện chơi theo phong cách Wayground: điểm theo tốc độ, streak, kết quả từng câu, giải thích, tổng kết (rank, accuracy, xem lại câu hỏi), chơi lại nếu được phép.

## Cấu trúc

```
database/          PostgreSQL portable (dữ liệu tạo ở database/Data)
scripts/db.mjs     khởi tạo / chạy / dừng PostgreSQL, tạo database
server/src/        API Express + Socket.IO
  grading.js       định dạng, chấm điểm, ẩn đáp án cho mọi loại câu hỏi
  mathEval.js      so sánh biểu thức toán tương đương
  realtime.js      trạng thái host / người chơi qua Socket.IO
  routes/          auth, quizzes, sessions (host + player), ai
client/src/        React app
  pages/admin      Home, Library, Explore, Reports, quiz editor/detail/start, worksheet
  pages/host       màn hình host
  pages/play       join, game, summary
  components/editor  soạn từng loại câu hỏi
  components/play    giao diện trả lời từng loại câu hỏi
```
