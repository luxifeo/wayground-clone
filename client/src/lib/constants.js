import {
  SquareCheck, ListChecks, CircleCheck, PenLine, AlignLeft, ChartBar, ArrowDownUp, Link2, Brush, Table, FileText, Hand,
  SquareChevronDown, Columns3, Highlighter, Grid3x3, Tag, Crosshair, ChartLine, Sigma, Video, Mic, Cloud, MessagesSquare,
} from 'lucide-react';

export const SUBJECTS = [
  'Mathematics', 'English', 'Science', 'Social Studies', 'History', 'Geography', 'Computers',
  'World Languages', 'Physics', 'Chemistry', 'Biology', 'Arts', 'Physical Ed', 'Other',
];

export const GRADES = [
  'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade',
  '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade', 'University', 'Professional Development',
];

export const LANGUAGES = [
  'English', 'Vietnamese', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Japanese', 'Korean',
  'Chinese', 'Hindi', 'Indonesian', 'Thai', 'Russian', 'Arabic',
];

export const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900];

export const fmtTime = (s) => (s < 60 ? `${s} seconds` : s % 60 === 0 ? `${s / 60} minute${s > 60 ? 's' : ''}` : `${Math.floor(s / 60)}m ${s % 60}s`);
export const fmtShortTime = (s) => (s < 60 ? `${s} sec` : `${Math.round(s / 6) / 10} min`);

const B = 'Basic';
const I = 'Interactive & higher order';
const V = 'Visual learning';
const M = 'Math';
const O = 'Open ended';
const pink = { color: 'text-brand-500', bg: 'bg-brand-50' };
const green = { color: 'text-emerald-600', bg: 'bg-emerald-50' };
const red = { color: 'text-red-600', bg: 'bg-red-50' };
const orange = { color: 'text-orange-500', bg: 'bg-orange-50' };
const blue = { color: 'text-blue-600', bg: 'bg-blue-50' };

export const QTYPES = {
  mcq: { label: 'Multiple choice', icon: SquareCheck, group: B, ...pink, desc: 'Students pick the one correct answer.', graded: 'Auto graded' },
  msq: { label: 'Multi-select', icon: ListChecks, group: B, ...pink, desc: 'Students select every correct answer.', graded: 'Partial grading' },
  tf: { label: 'True or false', icon: CircleCheck, group: B, ...pink, desc: 'Students decide whether a statement is true or false.', graded: 'Auto graded' },
  fill: { label: 'Fill in the blank', icon: PenLine, group: B, ...pink, desc: 'Students type the missing answer. Alternatives are accepted.', graded: 'Auto graded' },
  open: { label: 'Open ended', icon: AlignLeft, group: B, ...pink, desc: 'Students write a free response, graded by you or by AI.', graded: 'Flexible grading' },
  tablefill: { label: 'Table Fill In', icon: Table, group: B, ...pink, desc: 'Students fill in blanks within a table to answer questions.', graded: 'Auto graded', isNew: true },
  passage: { label: 'Passage', icon: FileText, group: B, ...pink, desc: 'Questions are shown next to a reading passage.', graded: 'Auto graded', virtual: true },
  dragdrop: { label: 'Drag and drop', icon: Hand, group: I, ...green, desc: 'Students drag or place items into their correct positions within the text.', graded: 'Partial grading' },
  dropdown: { label: 'Dropdown', icon: SquareChevronDown, group: I, ...green, desc: 'Students select answers from dropdown menus within the text.', graded: 'Partial grading' },
  categorize: { label: 'Categorize', icon: Columns3, group: I, ...green, desc: 'Students sort items into their appropriate groups.', graded: 'Partial grading' },
  reorder: { label: 'Reorder', icon: ArrowDownUp, group: I, ...green, desc: 'Students place items in their correct sequence.', graded: 'Partial grading' },
  match: { label: 'Match', icon: Link2, group: I, ...green, desc: 'Students match the correct items from two sets.', graded: 'Partial grading' },
  hottext: { label: 'Hot text', icon: Highlighter, group: I, ...green, desc: 'Students highlight the correct words or sentences in a text.', graded: 'Partial grading' },
  matchgrid: { label: 'Match Table Grid', icon: Grid3x3, group: I, ...green, desc: 'Students match each row to one or more columns in a grid.', graded: 'Partial grading', isNew: true },
  labeling: { label: 'Labeling', icon: Tag, group: V, ...red, desc: 'Students drag labels to their correct positions on an image.', graded: 'Partial grading' },
  hotspot: { label: 'Hotspot', icon: Crosshair, group: V, ...red, desc: 'Students answer by clicking specific areas on an image.', graded: 'Partial grading' },
  graphing: { label: 'Graphing', icon: ChartLine, group: M, ...orange, desc: 'Students plot points or a line on a coordinate plane.', graded: 'Auto graded' },
  math: { label: 'Math response', icon: Sigma, group: M, ...orange, desc: 'Students enter expressions with a math keypad; equivalent answers count.', graded: 'Auto graded' },
  draw: { label: 'Draw', icon: Brush, group: O, ...blue, desc: 'Students use drawing tools to illustrate or mark up images.', graded: 'Flexible grading' },
  video: { label: 'Video response', icon: Video, group: O, ...blue, desc: 'Students record a video answer with their camera.', graded: 'Flexible grading' },
  audio: { label: 'Audio response', icon: Mic, group: O, ...blue, desc: 'Students record a spoken answer with their microphone.', graded: 'Flexible grading' },
  poll: { label: 'Poll', icon: ChartBar, group: O, ...blue, desc: "Collect everyone's opinion on a list of options.", graded: 'Ungraded' },
  wordcloud: { label: 'Word cloud', icon: Cloud, group: O, ...blue, desc: 'Collect short text responses live in a word cloud.', graded: 'Ungraded' },
  discussion: { label: 'Discussion Board', icon: MessagesSquare, group: O, ...blue, desc: 'Students share ideas on a collaborative board in real time.', graded: 'Ungraded', isNew: true },
};
export const QTYPE_GROUPS = [B, I, V, M, O];

export const QTYPE_UPPER = Object.fromEntries(Object.entries(QTYPES).map(([k, v]) => [k, v.label.toUpperCase()]));

export const UNGRADED = ['open', 'poll', 'draw', 'wordcloud', 'audio', 'video', 'discussion'];
export const CHOICE_TYPES = ['mcq', 'msq', 'tf', 'poll'];

export const AVATARS = ['🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐨', '🐙', '🦄', '🐧', '🐶', '🐱', '🐰', '🦉', '🐢', '🐳', '🦖', '🐝', '🤖', '👽', '🐻', '🐮', '🐷', '🦋'];
export const AVATAR_BG = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#a5f3fc', '#fecaca'];
export const avatarBg = (a = '') => AVATAR_BG[[...a].reduce((s, c) => s + c.codePointAt(0), 0) % AVATAR_BG.length];

export const DEFAULT_SETTINGS = {
  attempts: 0, timer: false, shuffleQuestions: true, shuffleAnswers: true, showAnswers: 'on', showAnswersAfter: 'on',
  leaderboard: true, memes: true, music: false, skipQuestions: false, anonymize: false, serious: false,
};

export const rid = () => Math.random().toString(36).slice(2, 8);

/** Split "text [[b1]] more" into [{t:'text',v}, {t:'blank',id}] parts. */
export function splitBlanks(text) {
  const parts = [];
  const re = /\[\[([a-z0-9_-]+)\]\]/gi;
  let last = 0; let m;
  while ((m = re.exec(text || ''))) {
    if (m.index > last) parts.push({ t: 'text', v: text.slice(last, m.index) });
    parts.push({ t: 'blank', id: m[1] });
    last = m.index + m[0].length;
  }
  if (last < (text || '').length) parts.push({ t: 'text', v: text.slice(last) });
  return parts;
}

export function blankQuestion(type) {
  const base = { type, text: '', image: null, points: 1, time_limit: 30, explanation: '', extra: {}, options: [], answer: null };
  const four = () => [0, 1, 2, 3].map(() => ({ id: rid(), text: '' }));
  switch (type) {
    case 'passage': return { ...blankQuestion('mcq'), extra: { passage: '' } };
    case 'mcq': case 'msq': return { ...base, options: four(), answer: [], time_limit: type === 'msq' ? 45 : 30 };
    case 'poll': return { ...base, options: four(), time_limit: 20 };
    case 'tf': return { ...base, options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }], answer: ['true'], time_limit: 20 };
    case 'fill': return { ...base, answer: { accepted: [''] }, time_limit: 45 };
    case 'math': return { ...base, answer: { accepted: [''] }, time_limit: 60 };
    case 'open': return { ...base, answer: { sample: '' }, time_limit: 120 };
    case 'reorder': return { ...base, options: four(), time_limit: 60 };
    case 'match': return { ...base, options: [0, 1, 2].map(() => ({ id: rid(), left: '', right: '' })), time_limit: 60 };
    case 'dropdown': return { ...base, text: 'The sky is [[b1]].', options: [{ id: 'b1', choices: [{ id: rid(), text: 'blue' }, { id: rid(), text: 'green' }], correct: null }], time_limit: 60 };
    case 'dragdrop': return { ...base, text: 'The sky is [[b1]].', options: [{ id: 'b1', answer: 'blue' }], extra: { distractors: ['green'] }, time_limit: 60 };
    case 'categorize': {
      const c1 = rid(); const c2 = rid();
      return { ...base, extra: { categories: [{ id: c1, name: '' }, { id: c2, name: '' }] }, options: [{ id: rid(), text: '', cat: c1 }, { id: rid(), text: '', cat: c2 }], time_limit: 60 };
    }
    case 'hottext': return { ...base, extra: { source: '', unit: 'word' }, answer: [], time_limit: 60 };
    case 'matchgrid': return { ...base, options: [{ id: rid(), text: '' }, { id: rid(), text: '' }], extra: { columns: [{ id: rid(), text: '' }, { id: rid(), text: '' }], multi: false }, answer: {}, time_limit: 60 };
    case 'tablefill': return {
      ...base,
      extra: { table: { cols: ['', ''], rows: [[{ t: 'text', v: '' }, { t: 'blank', id: rid(), accepted: [''] }], [{ t: 'text', v: '' }, { t: 'blank', id: rid(), accepted: [''] }]] } },
      time_limit: 90,
    };
    case 'labeling': return { ...base, extra: { distractors: [] }, time_limit: 60 };
    case 'hotspot': return { ...base, answer: [], time_limit: 45 };
    case 'graphing': return { ...base, extra: { xmin: -10, xmax: 10, ymin: -10, ymax: 10, mode: 'points' }, answer: { points: [] }, time_limit: 90 };
    case 'draw': case 'video': case 'audio': return { ...base, time_limit: 120 };
    case 'wordcloud': return { ...base, time_limit: 45 };
    case 'discussion': return { ...base, time_limit: 180 };
    default: return base;
  }
}

export const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} minute${s < 120 ? '' : 's'} ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hour${s < 7200 ? '' : 's'} ago`;
  return `${Math.floor(s / 86400)} day${s < 172800 ? '' : 's'} ago`;
};
