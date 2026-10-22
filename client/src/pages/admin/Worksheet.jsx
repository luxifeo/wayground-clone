import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { get } from '../../lib/api.js';
import { UNGRADED } from '../../lib/constants.js';
import { Spinner, Toggle } from '../../components/ui.jsx';
import { QuestionBody } from '../../components/QuestionCard.jsx';
import { subjectLabel, gradeLabel } from '../../i18n/index.js';

/**
 * Splits questions into runs that share one passage (same extra.passageId, or the same passage
 * content for older questions) so each passage is printed once before its questions.
 */
function passageGroups(questions) {
  const groups = [];
  let n = 0;
  questions.forEach((q, i) => {
    const ex = q.extra || {};
    const has = !!(ex.passage || ex.passageTitle || ex.passageImage);
    const key = ex.passageId || (has ? JSON.stringify([ex.passageTitle, ex.passageImage, ex.passage]) : '');
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push({ q, i });
      if (has && !last.passage) Object.assign(last, { passage: ex, n: (n += 1) });
    } else groups.push({ key, n: has ? (n += 1) : 0, passage: has ? ex : null, items: [{ q, i }] });
  });
  return groups;
}

export default function Worksheet() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useTranslation('worksheet');
  const [quiz, setQuiz] = useState(null);
  const [key, setKey] = useState(false);
  useEffect(() => { get(`/quizzes/${id}`).then((d) => setQuiz(d.quiz)); }, [id]);
  if (!quiz) return <div className="grid h-full place-items-center"><Spinner className="h-8 w-8 text-slate-400" /></div>;
  return (
    <div className="min-h-full bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center gap-3 px-4">
        <button onClick={() => nav(-1)} className="btn-outline"><ArrowLeft className="h-4 w-4" />{t('common:actions.back')}</button>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold">{t('answerKey')} <Toggle checked={key} onChange={setKey} /></label>
        <button onClick={() => window.print()} className="btn-primary"><Printer className="h-4 w-4" />{t('print')}</button>
      </div>
      <div className="mx-auto max-w-3xl bg-white p-10 shadow-card print:shadow-none">
        <div className="mb-6 border-b-2 border-slate-800 pb-4">
          <h1 className="text-2xl font-bold">{key ? t('titleKey', { title: quiz.title }) : quiz.title}</h1>
          <div className="mt-1 text-sm text-slate-500">{subjectLabel(quiz.subject)} · {gradeLabel(quiz.grade)} · {t('common:count.questions', { count: quiz.questions.length })} · {t('common:count.points', { count: quiz.questions.filter((q) => !UNGRADED.includes(q.type)).reduce((a, q) => a + q.points, 0) })}</div>
          <div className="mt-4 grid grid-cols-3 gap-6 text-sm"><span>{t('name')}: ____________________</span><span>{t('class')}: __________</span><span>{t('date')}: __________</span></div>
        </div>
        <div className="space-y-8">
          {passageGroups(quiz.questions).map((g, gi) => (
            <section key={gi}>
              {g.passage && (
                <div className="mb-6 rounded-lg border border-slate-300 p-5">
                  <div className="mb-1 text-xs font-bold text-slate-400">{t('reading', { n: g.n })}</div>
                  {g.passage.passageTitle && <h2 className="mb-3 text-lg font-bold">{g.passage.passageTitle}</h2>}
                  {g.passage.passageImage && <img src={g.passage.passageImage} alt="" className="mx-auto mb-4 max-h-96 max-w-full break-inside-avoid rounded object-contain" />}
                  {g.passage.passage && <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{g.passage.passage}</div>}
                </div>
              )}
              <ol className="space-y-6">
                {g.items.map(({ q, i }) => (
                  <li key={q.id} className="break-inside-avoid">
                    <div className="mb-1 text-xs font-bold text-slate-400">{t('question', { n: i + 1 })} · {t('pts', { count: q.points })}</div>
                    <QuestionBody q={q} showAnswers={key} showPassage={false} />
                    {!key && ['fill', 'math', 'open', 'wordcloud', 'discussion'].includes(q.type) && <div className="mt-3 space-y-5">{Array.from({ length: q.type === 'open' || q.type === 'discussion' ? 4 : 1 }).map((_, k) => <div key={k} className="border-b border-slate-300" />)}</div>}
                    {!key && q.type === 'draw' && <div className="mt-3 h-40 rounded border border-slate-300" />}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
