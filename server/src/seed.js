import bcrypt from 'bcryptjs';
import { migrate, one, tx, pool } from './db.js';
import { insertQuestions } from './routes/quizzes.js';

const o = (id, text) => ({ id, text });

const QUIZZES = [
  {
    title: 'Solar System Explorer', subject: 'Science', grade: '4th Grade',
    questions: [
      { type: 'mcq', text: 'Which of these is the largest planet in the Solar System?', options: [o('a', 'Earth'), o('b', 'Mars'), o('c', 'Mercury'), o('d', 'Jupiter')], answer: ['d'], time_limit: 20, explanation: 'Jupiter is more than 11 times wider than Earth.' },
      { type: 'msq', text: 'Which of these celestial bodies are planets?', options: [o('a', 'Venus'), o('b', 'Neptune'), o('c', 'Uranus'), o('d', 'Pluto')], answer: ['a', 'b', 'c'], time_limit: 45, explanation: 'Pluto was reclassified as a dwarf planet in 2006.' },
      { type: 'fill', text: 'Name any one of the two moons of Mars: ____', answer: { accepted: ['Phobos', 'Deimos'] }, time_limit: 60 },
      { type: 'tf', text: 'The Sun is a star.', answer: ['true'], time_limit: 15 },
      { type: 'reorder', text: 'Order these planets from closest to farthest from the Sun.', options: [o('a', 'Mercury'), o('b', 'Venus'), o('c', 'Earth'), o('d', 'Mars')], time_limit: 45 },
      { type: 'match', text: 'Match each planet with its nickname.', options: [{ id: 'a', left: 'Mars', right: 'Red Planet' }, { id: 'b', left: 'Earth', right: 'Blue Planet' }, { id: 'c', left: 'Saturn', right: 'Ringed Planet' }], time_limit: 45 },
      { type: 'open', text: 'What would you do in outer space?', answer: { sample: 'Float in zero gravity and look at Earth from orbit.' }, time_limit: 120 },
      { type: 'poll', text: 'Which of these is your favorite?', options: [o('a', 'Stars'), o('b', 'Planets'), o('c', 'Comets')], time_limit: 20 },
    ],
  },
  {
    title: 'Fractions Fundamentals', subject: 'Mathematics', grade: '5th Grade',
    questions: [
      { type: 'mcq', text: 'What is 1/2 + 1/4?', options: [o('a', '3/4'), o('b', '2/6'), o('c', '1/8'), o('d', '2/4')], answer: ['a'], time_limit: 30, explanation: '1/2 = 2/4, and 2/4 + 1/4 = 3/4.' },
      { type: 'mcq', text: 'Which fraction is equivalent to 2/3?', options: [o('a', '4/9'), o('b', '6/9'), o('c', '3/2'), o('d', '2/6')], answer: ['b'], time_limit: 30 },
      { type: 'tf', text: '5/10 is the same as 1/2.', answer: ['true'], time_limit: 15 },
      { type: 'fill', text: '3/4 of 20 is ____', answer: { accepted: ['15'] }, time_limit: 45 },
      { type: 'msq', text: 'Select all fractions greater than 1/2.', options: [o('a', '3/5'), o('b', '2/5'), o('c', '7/8'), o('d', '1/3')], answer: ['a', 'c'], time_limit: 45 },
      { type: 'reorder', text: 'Order from smallest to largest.', options: [o('a', '1/8'), o('b', '1/4'), o('c', '1/2'), o('d', '3/4')], time_limit: 45 },
    ],
  },
  {
    title: 'English Grammar: Parts of Speech', subject: 'English', grade: '6th Grade',
    questions: [
      { type: 'mcq', text: 'Which word is a noun? "The quick fox jumps."', options: [o('a', 'quick'), o('b', 'fox'), o('c', 'jumps'), o('d', 'the')], answer: ['b'], time_limit: 20 },
      { type: 'mcq', text: 'Choose the adverb: "She sang beautifully."', options: [o('a', 'She'), o('b', 'sang'), o('c', 'beautifully')], answer: ['c'], time_limit: 20 },
      { type: 'match', text: 'Match the word with its part of speech.', options: [{ id: 'a', left: 'run', right: 'verb' }, { id: 'b', left: 'happy', right: 'adjective' }, { id: 'c', left: 'quickly', right: 'adverb' }, { id: 'd', left: 'table', right: 'noun' }], time_limit: 60 },
      { type: 'fill', text: 'The plural of "child" is ____', answer: { accepted: ['children'] }, time_limit: 30 },
      { type: 'tf', text: '"And" is a preposition.', answer: ['false'], time_limit: 15, explanation: '"And" is a conjunction.' },
    ],
  },
  {
    title: 'World Capitals', subject: 'Geography', grade: '7th Grade',
    questions: [
      { type: 'mcq', text: 'What is the capital of Vietnam?', options: [o('a', 'Ho Chi Minh City'), o('b', 'Hanoi'), o('c', 'Da Nang'), o('d', 'Hue')], answer: ['b'], time_limit: 20 },
      { type: 'mcq', text: 'What is the capital of Australia?', options: [o('a', 'Sydney'), o('b', 'Melbourne'), o('c', 'Canberra'), o('d', 'Perth')], answer: ['c'], time_limit: 20, explanation: 'Canberra was purpose-built as a compromise between Sydney and Melbourne.' },
      { type: 'match', text: 'Match the country with its capital.', options: [{ id: 'a', left: 'Japan', right: 'Tokyo' }, { id: 'b', left: 'France', right: 'Paris' }, { id: 'c', left: 'Canada', right: 'Ottawa' }], time_limit: 45 },
      { type: 'fill', text: 'The capital of Italy is ____', answer: { accepted: ['Rome', 'Roma'] }, time_limit: 30 },
      { type: 'tf', text: 'Rio de Janeiro is the capital of Brazil.', answer: ['false'], time_limit: 15, explanation: 'The capital is Brasília.' },
    ],
  },
];

const DIAGRAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
<rect width="600" height="400" fill="#e0f2fe"/>
<rect x="0" y="300" width="600" height="100" fill="#86efac"/>
<circle cx="500" cy="80" r="45" fill="#facc15"/>
<rect x="285" y="170" width="30" height="135" fill="#92400e"/>
<circle cx="300" cy="140" r="80" fill="#16a34a"/>
<path d="M300 305 L270 360 M300 305 L330 365 M300 305 L300 375" stroke="#78350f" stroke-width="8" fill="none"/>
<path d="M60 120 q20 -30 40 0 q20 -30 40 0" stroke="#64748b" stroke-width="4" fill="none"/>
</svg>`;

function showcase() {
  const fs = globalThis.__fs;
  const dir = globalThis.__uploadDir;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/demo-tree.svg`, DIAGRAM_SVG);
  const img = '/uploads/demo-tree.svg';
  return {
    title: 'Interactive Question Types Showcase', subject: 'Science', grade: '6th Grade',
    questions: [
      { type: 'mcq', text: 'According to the passage, why do leaves look green?', extra: { passage: 'Plants make their own food through photosynthesis. Inside the leaves, a pigment called chlorophyll absorbs red and blue light from the Sun and reflects green light, which is why most leaves look green. The plant uses the absorbed energy to turn water and carbon dioxide into sugar, releasing oxygen as a by-product.' }, options: [o('a', 'They absorb green light'), o('b', 'Chlorophyll reflects green light'), o('c', 'Water is green'), o('d', 'Oxygen is green')], answer: ['b'], time_limit: 45 },
      { type: 'dropdown', text: 'Plants take in [[b1]] and release [[b2]] during photosynthesis.', options: [{ id: 'b1', choices: [o('c1', 'carbon dioxide'), o('c2', 'nitrogen'), o('c3', 'oxygen')], correct: 'c1' }, { id: 'b2', choices: [o('d1', 'helium'), o('d2', 'oxygen'), o('d3', 'carbon dioxide')], correct: 'd2' }], time_limit: 60 },
      { type: 'dragdrop', text: 'The [[b1]] absorbs sunlight and the [[b2]] carry water up from the soil.', options: [{ id: 'b1', answer: 'leaf' }, { id: 'b2', answer: 'roots' }], extra: { distractors: ['flower', 'seed'] }, time_limit: 60 },
      { type: 'categorize', text: 'Sort these into living and non-living things.', extra: { categories: [{ id: 'l', name: 'Living' }, { id: 'n', name: 'Non-living' }] }, options: [{ id: 'i1', text: 'Tree', cat: 'l' }, { id: 'i2', text: 'Rock', cat: 'n' }, { id: 'i3', text: 'Mushroom', cat: 'l' }, { id: 'i4', text: 'Water', cat: 'n' }], time_limit: 60 },
      { type: 'hottext', text: 'Highlight the two gases mentioned in the text.', extra: { unit: 'word', source: 'Leaves take in carbon-dioxide and give out oxygen while sugar is stored.' }, options: 'Leaves take in carbon-dioxide and give out oxygen while sugar is stored.'.split(' ').map((t, i) => ({ id: `u${i}`, text: t })), answer: ['u3', 'u7'], time_limit: 45 },
      { type: 'matchgrid', text: 'Classify each number.', options: [{ id: 'r1', text: '0.5' }, { id: 'r2', text: '-3' }, { id: 'r3', text: '√2' }], extra: { columns: [{ id: 'k1', text: 'Rational' }, { id: 'k2', text: 'Irrational' }, { id: 'k3', text: 'Integer' }], multi: true }, answer: { r1: ['k1'], r2: ['k1', 'k3'], r3: ['k2'] }, time_limit: 60 },
      { type: 'tablefill', text: 'Complete the table.', extra: { table: { cols: ['Material', 'Lets light through?'], rows: [[{ t: 'text', v: 'Clear glass' }, { t: 'text', v: 'Yes' }], [{ t: 'text', v: 'Wood' }, { t: 'blank', id: 't1', accepted: ['No'] }], [{ t: 'text', v: 'Wax paper' }, { t: 'blank', id: 't2', accepted: ['Partly', 'Some', 'Translucent'] }]] } }, time_limit: 90 },
      { type: 'labeling', text: 'Label the parts of the tree.', image: img, options: [{ id: 'g1', text: 'Leaves', x: 50, y: 30 }, { id: 'g2', text: 'Trunk', x: 50, y: 60 }, { id: 'g3', text: 'Roots', x: 50, y: 88 }], extra: { distractors: ['Petal'] }, time_limit: 60 },
      { type: 'hotspot', text: 'Click on the Sun.', image: img, options: [{ id: 'h1', x: 75, y: 8, w: 18, h: 25 }, { id: 'h2', x: 35, y: 15, w: 30, h: 40 }, { id: 'h3', x: 5, y: 20, w: 20, h: 15 }], answer: ['h1'], time_limit: 30 },
      { type: 'graphing', text: 'Plot the line y = x + 1', extra: { xmin: -5, xmax: 5, ymin: -5, ymax: 5, mode: 'line' }, answer: { points: [[0, 1], [1, 2]] }, time_limit: 90 },
      { type: 'math', text: 'Simplify: 2(x + 3)', answer: { accepted: ['2x+6'] }, time_limit: 60 },
      { type: 'wordcloud', text: 'One word that describes plants?', time_limit: 30 },
      { type: 'discussion', text: 'How can we help plants grow in our school?', time_limit: 120 },
      { type: 'draw', text: 'Draw a flower.', time_limit: 120 },
    ],
  };
}

async function main() {
  await migrate();
  const fs = await import('node:fs');
  const path = await import('node:path');
  globalThis.__fs = fs.default;
  globalThis.__uploadDir = path.default.join(path.default.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'uploads');
  QUIZZES.push(showcase());
  let user = await one("SELECT * FROM users WHERE email='demo@wayground.local'");
  if (!user) {
    user = await one('INSERT INTO users(email,password_hash,name) VALUES($1,$2,$3) RETURNING *',
      ['demo@wayground.local', await bcrypt.hash('demo123', 10), 'Demo Teacher']);
  }
  for (const qz of QUIZZES) {
    const exists = await one('SELECT id FROM quizzes WHERE owner_id=$1 AND title=$2', [user.id, qz.title]);
    if (exists) continue;
    await tx(async (c) => {
      const r = await c.query(
        `INSERT INTO quizzes(owner_id,title,subject,grade,status,visibility,source,plays) VALUES($1,$2,$3,$4,'published','public','scratch',$5) RETURNING id`,
        [user.id, qz.title, qz.subject, qz.grade, Math.floor(Math.random() * 50)]);
      await insertQuestions(c, r.rows[0].id, qz.questions, 0);
    });
    console.log('seeded', qz.title);
  }
  console.log('Demo login: demo@wayground.local / demo123');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
