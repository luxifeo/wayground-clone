// Translate API error messages for clients that ask for Vietnamese (Accept-Language: vi).
// Messages stay in English in the code; this table maps them at the edge.

const VI = {
  'Add a question first': 'Hãy thêm một câu hỏi trước',
  'Add at least one question': 'Thêm ít nhất một câu hỏi',
  'Answer the question first': 'Hãy trả lời câu hỏi trước',
  'Already answered': 'Bạn đã trả lời câu này rồi',
  'An account with this email already exists': 'Email này đã có tài khoản',
  'Choose a language': 'Hãy chọn một ngôn ngữ',
  'Could not allocate a game code': 'Không tạo được mã game',
  'Could not download this image. Try another one.': 'Không tải được ảnh này. Hãy thử ảnh khác.',
  'Enter a topic, paste text or upload a file': 'Nhập chủ đề, dán văn bản hoặc tải tệp lên',
  Forbidden: 'Không có quyền truy cập',
  'Game not found. Check the code and try again.': 'Không tìm thấy game. Hãy kiểm tra mã và thử lại.',
  'Give your quiz a name': 'Hãy đặt tên cho bài quiz',
  'Image is too large': 'Ảnh quá lớn',
  'Invalid email or password': 'Email hoặc mật khẩu không đúng',
  'Invalid image URL': 'URL ảnh không hợp lệ',
  'Name, email and password are required': 'Cần nhập tên, email và mật khẩu',
  'No board for this question': 'Câu hỏi này không có bảng thảo luận',
  'Not a running teacher-led session': 'Đây không phải phiên do giáo viên dẫn đang diễn ra',
  'Not a supported image type': 'Định dạng ảnh không được hỗ trợ',
  'Not your question': 'Câu hỏi này không thuộc về bạn',
  'Not your quiz': 'Bài quiz này không thuộc về bạn',
  'Not your session': 'Phiên này không thuộc về bạn',
  'Only image, audio or video files are allowed': 'Chỉ cho phép tệp ảnh, âm thanh hoặc video',
  'Participant not found': 'Không tìm thấy người tham gia',
  'Password must be at least 6 characters': 'Mật khẩu phải có ít nhất 6 ký tự',
  'Player not found': 'Không tìm thấy người chơi',
  'Please enter your name': 'Hãy nhập tên của bạn',
  'Question not found': 'Không tìm thấy câu hỏi',
  'Quiz not found': 'Không tìm thấy bài quiz',
  'Response not found': 'Không tìm thấy câu trả lời',
  'Select a grade': 'Hãy chọn khối lớp',
  'Select a subject': 'Hãy chọn môn học',
  'Session not found': 'Không tìm thấy phiên',
  'Server error': 'Lỗi máy chủ',
  'The AI did not return any usable questions. Try again.': 'AI không trả về câu hỏi nào dùng được. Hãy thử lại.',
  'The AI response did not contain JSON': 'Phản hồi của AI không chứa JSON',
  'The AI response was not valid JSON': 'Phản hồi của AI không phải JSON hợp lệ',
  'The AI returned an unusable question. Try again.': 'AI trả về câu hỏi không dùng được. Hãy thử lại.',
  'The deadline for this assignment has passed': 'Đã quá hạn nộp bài này',
  'The host disconnected you from this game': 'Giáo viên đã ngắt kết nối bạn khỏi game này',
  'This game can no longer be played': 'Game này không thể chơi tiếp được nữa',
  'This game has ended': 'Game này đã kết thúc',
  'The game has not started yet': 'Game chưa bắt đầu',
  'This quiz has no questions': 'Bài quiz này chưa có câu hỏi',
  'This quiz is private': 'Bài quiz này ở chế độ riêng tư',
  'Time is up for this question': 'Đã hết giờ cho câu hỏi này',
  Unauthorized: 'Bạn cần đăng nhập',
  'You were removed from this game': 'Bạn đã bị xoá khỏi game này',
  'Could not reach the server': 'Không kết nối được máy chủ',
};

const PROBLEMS = {
  'has no question text': 'chưa có nội dung câu hỏi',
  'needs a correct answer': 'cần có đáp án đúng',
  'needs a correct selection': 'cần chọn phần đúng',
  'needs an accepted answer': 'cần có đáp án được chấp nhận',
  'needs an image': 'cần có ảnh',
  'needs at least 2 items': 'cần ít nhất 2 mục',
  'needs at least 2 options': 'cần ít nhất 2 lựa chọn',
  'needs at least one blank cell': 'cần ít nhất một ô trống',
  'needs at least one blank': 'cần ít nhất một chỗ trống',
  'needs the correct points': 'cần có các điểm đúng',
};

/** Messages with variable parts: [pattern, replacement]. */
const PATTERNS = [
  [/^Question (\d+) (.+)$/, (_m, n, rest) => `Câu ${n} ${PROBLEMS[rest] || rest}`],
  [/^Only (\d+) attempt\(s\) allowed$/, (_m, n) => `Chỉ được làm tối đa ${n} lần`],
  [/^You have used all (\d+) attempt\(s\) for this game$/, (_m, n) => `Bạn đã dùng hết ${n} lượt làm bài này`],
  [/^"(.+)" looks like a scanned PDF with no text\. Upload page images instead\.$/, (_m, f) => `"${f}" có vẻ là PDF scan không có chữ. Hãy tải ảnh từng trang lên.`],
  [/^Unsupported file type: (.+)\. Use PDF, DOCX, TXT or images\.$/, (_m, f) => `Không hỗ trợ loại tệp: ${f}. Hãy dùng PDF, DOCX, TXT hoặc ảnh.`],
  [/^Cannot reach the AI model at (\S+) \((.*)\)\. Check LLM_BASE_URL in server\/\.env\.$/s, (_m, u, e) => `Không kết nối được model AI tại ${u} (${e}). Kiểm tra LLM_BASE_URL trong server/.env.`],
  [/^AI model error (.*)$/s, (_m, rest) => `Lỗi model AI ${rest}`],
  [/^Could not fetch (\S+): (.*)$/s, (_m, u, e) => `Không tải được ${u}: ${e}`],
  [/^Image search failed: (.*)$/s, (_m, e) => `Tìm ảnh thất bại: ${e}`],
];

export function translate(msg, lang) {
  if (lang !== 'vi' || typeof msg !== 'string') return msg;
  if (VI[msg]) return VI[msg];
  for (const [re, fn] of PATTERNS) if (re.test(msg)) return msg.replace(re, fn);
  return msg;
}

const pickLang = (req) => (/^vi\b/i.test(String(req.headers['accept-language'] || '')) ? 'vi' : 'en');

/** Express middleware: translate `error` / `problems` in JSON responses. */
export function i18nErrors(req, res, next) {
  const lang = pickLang(req);
  if (lang === 'en') return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && !Array.isArray(body) && (body.error || body.problems)) {
      body = { ...body };
      if (body.error) body.error = translate(body.error, lang);
      if (Array.isArray(body.problems)) body.problems = body.problems.map((p) => translate(p, lang));
    }
    return json(body);
  };
  next();
}
