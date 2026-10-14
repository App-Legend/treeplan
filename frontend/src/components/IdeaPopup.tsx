import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { IdeaResponse } from '../api/types';
import { useToast } from '../state/toast';
import Modal from './Modal';

interface Props {
  drawId: number;
  categoryName: string;
  words: string[];
  onClose: () => void;
  onNewCombination: () => void;
}

type Phase = 'idea' | 'result' | null;

const IDEA_STEPS = ['세 단어 사이의 연결점을 찾고 있어요', '분야에 맞게 아이디어를 다듬고 있어요', '제목과 요약을 정리하고 있어요'];
const RESULT_STEPS = ['양식의 단계를 하나씩 채우고 있어요', '실행할 수 있게 구체화하고 있어요', '조합 이유를 정리하고 있어요'];

/**
 * 아이디어 생성 팝업 (5주차 화면 3 / 6주차 화면 4).
 * 단어 3개는 먼저 보여 주고 아이디어 영역만 로딩한다. 가짜 진행률은 쓰지 않는다.
 */
export default function IdeaPopup({ drawId, categoryName, words, onClose, onNewCombination }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [idea, setIdea] = useState<IdeaResponse | null>(null);
  const [busy, setBusy] = useState<Phase>('idea');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const started = useRef(false);

  const generate = async () => {
    setBusy('idea');
    setError(null);
    try {
      const res = await api.generateIdea(drawId);
      setIdea(res);
      if (res.status === 'FAILED') setError(res.failureReason ?? '아이디어를 만들지 못했어요.');
      if (res.resultId) navigate(`/r/${res.resultId}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ALREADY_ADOPTED') {
        setError('이미 결과물로 만든 조합이에요. 단어를 다시 뽑아 새 아이디어를 만들어 보세요.');
      } else {
        setError(e instanceof ApiError ? e.message : '아이디어를 만들지 못했어요.');
      }
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (started.current) return; // StrictMode 이중 실행 방지 (서버도 중복 호출을 막음)
    started.current = true;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, 2)), 3500);
    return () => window.clearInterval(t);
  }, [busy]);

  const toggleBookmark = async () => {
    if (!idea) return;
    try {
      const res = await api.bookmarkIdea(idea.ideaId, !idea.bookmarked);
      setIdea({ ...idea, bookmarked: res.bookmarked });
      toast.show(res.bookmarked ? '아이디어를 보관했어요. 히스토리에서 다시 볼 수 있어요.' : '보관을 해제했어요.', 'success');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '보관하지 못했어요.', 'error');
    }
  };

  const makeResult = async () => {
    if (!idea) return;
    setBusy('result');
    setError(null);
    try {
      const res = await api.createResult(idea.ideaId);
      navigate(`/r/${res.resultId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '결과물을 만들지 못했어요.');
      setBusy(null);
    }
  };

  const steps = busy === 'result' ? RESULT_STEPS : IDEA_STEPS;
  const ready = idea?.status === 'SUCCESS';

  return (
    <Modal onClose={onClose} labelledBy="idea-title" dismissible={!busy}>
      <div className="idea-popup">
        <p className="eyebrow">카테고리 / {categoryName}</p>
        <h2 id="idea-title" className="small strong">
          이번 단어 조합
        </h2>
        <div className="chips">
          {words.map((w) => (
            <span key={w} className="chip chip-word">
              {w}
            </span>
          ))}
        </div>
        <hr />

        {busy && (
          <div className="generating" aria-live="polite">
            <div className="spinner" aria-hidden />
            <p className="strong">{busy === 'idea' ? '아이디어를 만들고 있어요' : '분야별 실행안을 만들고 있어요'}</p>
            <p className="small muted">{steps[step]}</p>
            <div className="indeterminate" aria-hidden>
              <span />
            </div>
            <p className="tiny muted">AI 응답 속도에 따라 시간이 달라질 수 있어요. 선택한 조합은 그대로 유지됩니다.</p>
          </div>
        )}

        {!busy && ready && idea && (
          <div className="idea-card">
            <p className="eyebrow">{idea.categoryName} · AI 아이디어 초안</p>
            <h3>{idea.title}</h3>
            <p>{idea.summary}</p>
            {idea.aiMode === 'mock' && <p className="tiny warn">예시 모드: 서버에 Gemini API 키가 없어 예시 결과를 보여 주고 있어요.</p>}
            <p className="tiny muted">AI가 만든 초안이에요. 검증된 정답이 아니니 검토하고 발전시켜 주세요.</p>
          </div>
        )}

        {!busy && error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
          </div>
        )}

        {!busy && (
          <div className="popup-actions">
            {ready ? (
              <>
                <button className="btn btn-ghost" onClick={toggleBookmark}>
                  {idea?.bookmarked ? '★ 보관됨' : '☆ 보관'}
                </button>
                <button className="btn btn-outline" onClick={generate}>
                  다시 생성
                </button>
                <button className="btn btn-primary" onClick={makeResult}>
                  이 아이디어로 실행안 만들기
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={onNewCombination}>
                  단어 화면으로 돌아가기
                </button>
                {error && !error.includes('이미 결과물') && (
                  <button className="btn btn-primary" onClick={idea?.status === 'SUCCESS' ? makeResult : generate}>
                    같은 조합으로 다시 시도
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
