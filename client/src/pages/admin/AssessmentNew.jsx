import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload, Link2, FileSpreadsheet, Download, Sparkles, ChevronRight, PenLine, Search } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import AIGenerateModal from '../../components/AIGenerateModal.jsx';
import { post } from '../../lib/api.js';
import { csvToQuestions, csvTemplate, toCSV } from '../../lib/csv.js';
import { Modal, useToast } from '../../components/ui.jsx';

export default function AssessmentNew() {
  const { t } = useTranslation('assessment');
  const nav = useNavigate();
  const toast = useToast();
  const [ai, setAi] = useState(null);
  const [topic, setTopic] = useState('');
  const [link, setLink] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef(null);
  const csvRef = useRef(null);

  const scratch = async () => {
    // stored English sentinel: the editor shows it as an empty title and publish asks for a real name
    const { quiz } = await post('/quizzes', { title: 'Untitled Quiz', source: 'scratch' });
    nav(`/admin/quiz/${quiz.id}/edit?new=1`);
  };

  const downloadTemplate = () => {
    const blob = new Blob([`\uFEFF${toCSV(csvTemplate())}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'wayground-question-template.csv'; a.click();
  };

  const importCsv = async (file) => {
    try {
      const questions = csvToQuestions(await file.text());
      if (!questions.length) throw new Error(t('noQuestions'));
      const { quiz } = await post('/quizzes', { title: file.name.replace(/\.[^.]+$/, ''), source: 'import', questions });
      toast(t('imported', { count: questions.length }), 'success');
      nav(`/admin/quiz/${quiz.id}/edit`);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="min-h-full bg-slate-50/70 px-4 pb-16">
      <div className="relative mx-auto max-w-3xl pt-8">
        <h1 className="text-center text-2xl font-bold">{t('heading')}</h1>
        <button onClick={() => nav('/admin')} className="absolute right-0 top-7 rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50" aria-label={t('common:actions.close')}><X className="h-5 w-5" /></button>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); setAi({ mode: 'upload', files: e.dataTransfer.files }); }}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-6 py-8"
          >
            <div className="text-sm text-slate-600"><Trans ns="assessment" i18nKey="upload.text" components={{ u: <u className="font-semibold" /> }} /></div>
            <div className="text-xs text-slate-400">{t('upload.hint')}</div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button className="btn-outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{t('upload.device')}</button>
              <form onSubmit={(e) => { e.preventDefault(); if (link) setAi({ mode: 'link', url: link }); }} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5">
                <Link2 className="h-4 w-4 text-slate-400" />
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t('upload.linkPlaceholder')} className="w-48 text-sm outline-none" />
              </form>
              <input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md,image/*" onChange={(e) => setAi({ mode: 'upload', files: e.target.files })} />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-700">{t('import.title')}</div>
            <div className="-mt-2 text-xs text-slate-500">{t('import.sub')}</div>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-outline btn-sm w-44" onClick={() => setImportOpen(true)}><FileSpreadsheet className="h-4 w-4" />{t('import.useTemplate')}</button>
              <button className="btn-outline btn-sm w-44" onClick={() => nav('/admin/explore')}><Search className="h-4 w-4" />{t('import.searchLibrary')}</button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="card flex flex-col p-4">
            <button onClick={() => setAi({ mode: 'prompt' })} className="flex items-center gap-1 text-left text-sm font-semibold text-slate-700">{t('prompt.title')} <ChevronRight className="h-4 w-4" /></button>
            <form onSubmit={(e) => { e.preventDefault(); setAi({ mode: 'prompt', topic }); }} className="mt-6 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('prompt.placeholder')} className="w-full text-sm outline-none" />
            </form>
          </div>
          <button onClick={() => setAi({ mode: 'prompt', topic: t('standards.topic') })} className="card flex flex-col p-4 text-left hover:shadow-md">
            <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">{t('standards.title')} <ChevronRight className="h-4 w-4" /></span>
            <span className="mt-3 text-xs text-slate-500">{t('standards.text')}</span>
          </button>
          <button onClick={scratch} className="card relative flex flex-col overflow-hidden p-4 text-left hover:shadow-md">
            <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">{t('scratch')} <ChevronRight className="h-4 w-4" /></span>
            <span className="absolute -bottom-2 right-3 flex flex-col gap-1.5 opacity-80">
              <span className="h-5 w-24 rounded bg-slate-100" /><span className="h-5 w-28 rounded bg-slate-100" />
            </span>
            <PenLine className="absolute bottom-3 right-4 h-6 w-6 text-slate-500" />
          </button>
        </div>
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('modal.title')} icon={<FileSpreadsheet className="h-5 w-5 text-emerald-600" />}>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>{t('modal.step1')}</li>
          <li>{t('modal.step2')}</li>
          <li><Trans ns="assessment" i18nKey="modal.step3" components={{ code: <code /> }} /></li>
          <li><Trans ns="assessment" i18nKey="modal.step4" components={{ b: <b /> }} /></li>
        </ol>
        <div className="mt-5 flex gap-2">
          <button className="btn-outline flex-1" onClick={downloadTemplate}><Download className="h-4 w-4" />{t('modal.download')}</button>
          <button className="btn-primary flex-1" onClick={() => csvRef.current?.click()}><Upload className="h-4 w-4" />{t('modal.upload')}</button>
          <input ref={csvRef} type="file" hidden accept=".csv,text/csv" onChange={(e) => e.target.files[0] && importCsv(e.target.files[0])} />
        </div>
      </Modal>

      <AIGenerateModal
        open={!!ai} onClose={() => setAi(null)} initialMode={ai?.mode} initialTopic={ai?.topic || ''} initialFiles={ai?.files}
        key={ai ? `${ai.mode}-${ai.url || ''}` : 'none'}
        initialUrl={ai?.url}
      />
    </div>
  );
}
