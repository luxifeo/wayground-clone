// CSV import/export for question lists (compatible with a simple spreadsheet template)
import { rid } from './constants.js';

export const CSV_HEADER = ['Question Text', 'Question Type', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5', 'Correct Answer', 'Time in seconds', 'Explanation'];

export const CSV_TEMPLATE = [
  CSV_HEADER,
  ['What is 2 + 2?', 'Multiple Choice', '3', '4', '5', '22', '', '2', '30', '2 plus 2 equals 4'],
  ['Select all prime numbers', 'Checkbox', '2', '4', '7', '9', '', '1,3', '45', ''],
  ['The Earth is flat.', 'True/False', '', '', '', '', '', 'False', '20', ''],
  ['The capital of France is ____', 'Fill-in-the-Blank', '', '', '', '', '', 'Paris', '30', ''],
  ['Describe your favourite book.', 'Open-Ended', '', '', '', '', '', '', '120', ''],
  ['Which season do you like most?', 'Poll', 'Spring', 'Summer', 'Autumn', 'Winter', '', '', '20', ''],
];

export function toCSV(rows) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}

export function parseCSV(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const TYPE_MAP = {
  'multiple choice': 'mcq', mcq: 'mcq', checkbox: 'msq', 'multiple select': 'msq', 'multi-select': 'msq', msq: 'msq',
  'true/false': 'tf', 'true or false': 'tf', tf: 'tf', 'fill-in-the-blank': 'fill', 'fill in the blank': 'fill', fill: 'fill',
  'open-ended': 'open', 'open ended': 'open', open: 'open', poll: 'poll', reorder: 'reorder', draw: 'draw',
};

export function csvToQuestions(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const start = /question/i.test(rows[0][0]) ? 1 : 0;
  return rows.slice(start).map((r) => {
    const [qText, rawType, o1, o2, o3, o4, o5, correct, time, expl] = r.map((c) => (c ?? '').trim());
    const type = TYPE_MAP[(rawType || 'multiple choice').toLowerCase()] || 'mcq';
    const opts = [o1, o2, o3, o4, o5].filter(Boolean).map((t) => ({ id: rid(), text: t }));
    const q = { type, text: qText, time_limit: parseInt(time, 10) || 30, explanation: expl || null, points: 1 };
    if (['mcq', 'msq', 'poll', 'reorder'].includes(type)) {
      q.options = opts;
      const idx = (correct || '').split(/[,;| ]+/).map((x) => parseInt(x, 10) - 1).filter((i) => i >= 0 && i < opts.length);
      q.answer = type === 'poll' || type === 'reorder' ? null : idx.map((i) => opts[i].id);
    }
    if (type === 'tf') q.answer = [/^(t|true|1|yes|đúng)$/i.test(correct) ? 'true' : 'false'];
    if (type === 'fill') q.answer = { accepted: (correct || '').split('|').map((s) => s.trim()).filter(Boolean) };
    if (type === 'open') q.answer = { sample: correct || null };
    return q;
  }).filter((q) => q.text);
}
