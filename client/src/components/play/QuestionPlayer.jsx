import { useCallback, useState } from 'react';
import { FileText } from 'lucide-react';
import { ImageCredit } from '../ImageSearchModal.jsx';
import {
  ChoiceAnswer, TextAnswer, ReorderAnswer, MatchAnswer, DropdownAnswer, DragDropAnswer, CategorizeAnswer, HotTextAnswer,
  MatchGridAnswer, TableFillAnswer, LabelingAnswer, HotspotAnswer, GraphingAnswer, DrawAnswer, RecordAnswer, Board,
} from './answers.jsx';

const ANSWERS = {
  mcq: ChoiceAnswer, msq: ChoiceAnswer, tf: ChoiceAnswer, poll: ChoiceAnswer,
  fill: TextAnswer, math: TextAnswer, open: TextAnswer, wordcloud: TextAnswer, discussion: TextAnswer,
  reorder: ReorderAnswer, match: MatchAnswer, dropdown: DropdownAnswer, dragdrop: DragDropAnswer, categorize: CategorizeAnswer,
  hottext: HotTextAnswer, matchgrid: MatchGridAnswer, tablefill: TableFillAnswer, labeling: LabelingAnswer, hotspot: HotspotAnswer,
  graphing: GraphingAnswer, draw: DrawAnswer, audio: RecordAnswer, video: RecordAnswer,
};

const INLINE_TEXT = ['dropdown', 'dragdrop'];
const IMAGE_IN_ANSWER = ['labeling', 'hotspot', 'draw'];

/**
 * Renders one question for a student.
 * props: question (sanitized), onSubmit(answer), result, locked, token (player token), preview, header (node)
 */
export default function QuestionPlayer({ question: q, onSubmit, result, locked = false, token, preview = false, header, myResponseId }) {
  const [submitted, setSubmitted] = useState(false);
  const Answer = ANSWERS[q.type];
  const submit = (a) => { setSubmitted(true); onSubmit(a); };

  const uploadBlob = useCallback(async (blob, name) => {
    if (preview || !token) return URL.createObjectURL(blob);
    const form = new FormData();
    form.append('file', blob, name);
    const r = await fetch(`/api/play/${token}/upload`, { method: 'POST', body: form });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    return d.url;
  }, [preview, token]);

  const fetchBoard = useCallback(() => fetch(`/api/play/${token}/board/${q.id}`).then((r) => r.json()), [token, q.id]);

  const questionBox = !INLINE_TEXT.includes(q.type) && (
    <div className="game-panel mx-auto mb-4 flex w-full max-w-5xl flex-col items-center gap-3 p-5 md:flex-row md:p-6">
      {q.image && !IMAGE_IN_ANSWER.includes(q.type) && (
        <figure className="flex max-w-xs flex-col items-center">
          <img src={q.image} alt="" className="max-h-56 rounded-xl" />
          <ImageCredit credit={q.imageCredit} dark className="mt-1 max-w-full" />
        </figure>
      )}
      <div className="flex-1 whitespace-pre-wrap break-words text-center font-game text-xl font-bold text-white md:text-2xl">{q.text}</div>
    </div>
  );

  const body = (
    <div className="w-full">
      {questionBox}
      {Answer && (
        <Answer q={q} onSubmit={submit} result={result} locked={locked || submitted || !!result} uploadBlob={uploadBlob} />
      )}
      {preview && submitted && !result && <div className="mt-4 text-center font-game font-bold text-white/80">✓ Answer submitted (preview)</div>}
      {token && result && ['discussion', 'wordcloud'].includes(q.type) && <Board fetchBoard={fetchBoard} type={q.type} myId={myResponseId} />}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-6 pt-2 sm:px-6">
      {header}
      {q.passage ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="max-h-[70vh] overflow-auto rounded-2xl bg-white p-5 scrollbar-thin">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-violet-700"><FileText className="h-4 w-4" />Passage</div>
            <div className="whitespace-pre-wrap leading-relaxed text-slate-800">{q.passage}</div>
          </div>
          {body}
        </div>
      ) : body}
    </div>
  );
}
