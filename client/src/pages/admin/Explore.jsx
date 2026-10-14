import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Play, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../components/AdminLayout.jsx';
import { get } from '../../lib/api.js';
import { SUBJECTS, GRADES } from '../../lib/constants.js';
import { subjectLabel, gradeLabel } from '../../i18n/index.js';
import { Empty, QuizThumb, Select } from '../../components/ui.jsx';

export default function Explore() {
  const { t } = useTranslation('explore');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [subject, setSubject] = useState(params.get('subject'));
  const [grade, setGrade] = useState(params.get('grade'));
  const [list, setList] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (params.get('q')) p.set('q', params.get('q'));
    if (subject) p.set('subject', subject);
    if (grade) p.set('grade', grade);
    get(`/explore?${p}`).then((d) => setList(d.quizzes));
  }, [params, subject, grade]);

  return (
    <AdminLayout compact>
      <div className="bg-gradient-to-b from-brand-50 to-white px-6 pb-6 pt-10">
        <h1 className="text-center text-2xl font-bold">{t('heading')}</h1>
        <form onSubmit={(e) => { e.preventDefault(); setParams(q ? { q } : {}); }} className="mx-auto mt-5 flex max-w-2xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-card">
          <Search className="h-5 w-5 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="flex-1 py-2 outline-none" />
          <button className="btn-primary">{t('common:actions.search')}</button>
        </form>
        <div className="mx-auto mt-3 flex max-w-2xl gap-2">
          <Select value={subject} onChange={setSubject} options={SUBJECTS.map((v) => ({ value: v, label: subjectLabel(v) }))} placeholder={t('allSubjects')} className="flex-1" />
          <Select value={grade} onChange={setGrade} options={GRADES.map((v) => ({ value: v, label: gradeLabel(v) }))} placeholder={t('allGrades')} className="flex-1" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-6 pb-10">
        {list && list.length === 0 && <Empty icon={BookOpen} title={t('empty.title')}>{t('empty.text')}</Empty>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(list || []).map((qz) => (
            <Link key={qz.id} to={`/admin/quiz/${qz.id}`} className="card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="grid h-32 place-items-center bg-gradient-to-br from-violet-100 to-brand-50">
                {qz.cover_image || qz.first_image ? <img src={qz.cover_image || qz.first_image} alt="" className="h-full w-full object-cover" /> : <QuizThumb quiz={qz} size={56} />}
              </div>
              <div className="p-3">
                <div className="text-[11px] font-bold uppercase text-slate-400">{t('assessment')}</div>
                <div className="line-clamp-2 font-semibold">{qz.title}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('common:count.qs', { count: qz.question_count })} · {qz.grade ? gradeLabel(qz.grade) : subjectLabel(qz.subject)}</span>
                  <span className="flex items-center gap-1"><Play className="h-3 w-3" />{t('plays', { count: qz.plays })}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
