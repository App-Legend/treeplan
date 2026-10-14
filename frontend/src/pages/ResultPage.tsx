import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { ResultResponse } from '../api/types';
import { useToast } from '../state/toast';

/** 화면 5: 결과물 (카테고리 양식에 맞춘 실행안) */
export default function ResultPage() {
  const { resultId: idParam } = useParams();
  const resultId = Number(idParam);
  const navigate = useNavigate();
  const toast = useToast();

  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pollTimer = useRef<number | undefined>();

  const load = useCallback(async () => {
    try {
      const r = await api.getResult(resultId);
      setResult(r);
      setLoadError(null);
      return r;
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : '결과물을 불러오지 못했어요.');
      return null;
    }
  }, [resultId]);

  useEffect(() => {
    setResult(null);
    setEditing(false);
    void load();
  }, [load]);

  // 다른 탭이나 팀원이 생성 중인 결과물이면 끝날 때까지 가볍게 다시 확인한다.
  useEffect(() => {
    window.clearTimeout(pollTimer.current);
    if (result?.status === 'GENERATING' && !regenerating) {
      pollTimer.current = window.setTimeout(() => void load(), 2500);
    }
    return () => window.clearTimeout(pollTimer.current);
  }, [result, regenerating, load]);

  const startEdit = () => {
    if (!result) return;
    setDraft(Object.fromEntries(result.items.map((i) => [i.key, i.content])));
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!result) return;
    const changed: Record<string, string> = {};
    for (const item of result.items) {
      if (draft[item.key] !== item.content) changed[item.key] = draft[item.key] ?? '';
    }
    if (Object.keys(changed).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      setResult(await api.updateResult(result.resultId, changed));
      setEditing(false);
      toast.show('수정한 내용을 저장했어요.', 'success');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '저장하지 못했어요. 입력한 내용은 그대로 있어요.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    if (!result) return;
    setRegenerating(true);
    try {
      const r = await api.regenerateResult(result.resultId, feedback.trim());
      setResult(r);
      if (r.notice) toast.show(r.notice, 'error');
      else if (r.status === 'FAILED') toast.show(r.failureReason ?? '다시 만들지 못했어요.', 'error');
      else {
        toast.show('실행안을 보완했어요.', 'success');
        setRegenOpen(false);
        setFeedback('');
      }
    } catch (e) {
      // 실패해도 기존 결과는 화면에 그대로 둔다.
      toast.show(e instanceof ApiError ? e.message : '보완하지 못했어요. 기존 내용은 그대로예요.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const exportAs = async (format: 'pdf' | 'txt' | 'md') => {
    if (!result) return;
    setExporting(format);
    try {
      const { blob, filename } = await api.exportResult(result.resultId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '내보내지 못했어요.', 'error');
    } finally {
      setExporting(null);
    }
  };

  const copyAll = async () => {
    if (!result) return;
    const text = [
      result.title,
      `사용한 단어: ${result.words.join(', ')}`,
      '',
      ...result.items.flatMap((i, n) => [`${String(n + 1).padStart(2, '0')}. ${i.label}`, i.content, '']),
      '※ AI가 만든 아이디어 초안입니다. 검토 후 사용하세요.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.show('결과물을 복사했어요.', 'success');
    } catch {
      toast.show('복사하지 못했어요. 내보내기를 이용해 주세요.', 'error');
    }
  };

  const remove = async () => {
    if (!result) return;
    try {
      await api.deleteResult(result.resultId);
      toast.show('결과물을 삭제했어요.');
      navigate(`/s/${result.sessionId}`);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '삭제하지 못했어요.', 'error');
    } finally {
      setConfirmDelete(false);
    }
  };

  if (loadError && !result) {
    return (
      <main className="page narrow">
        <div className="card empty">
          <h2>결과물을 열 수 없어요</h2>
          <p className="muted">{loadError}</p>
          <div className="popup-actions center">
            <button className="btn btn-outline" onClick={() => void load()}>
              다시 시도
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              처음 화면으로
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="page narrow">
        <div className="card">
          <div className="skeleton-line" />
          <div className="skeleton-block" />
        </div>
      </main>
    );
  }

  const failed = result.status === 'FAILED';
  const generating = result.status === 'GENERATING' || regenerating;

  return (
    <main className="page narrow">
      <article className="card result">
        <p className="eyebrow">{result.categoryName} · AI 아이디어 초안</p>
        <h1>{result.title}</h1>
        {result.ideaSummary && <p className="lead">{result.ideaSummary}</p>}

        <div className="result-words">
          <span className="tiny muted">사용한 단어</span>
          <div className="chips">
            {result.words.map((w) => (
              <span key={w} className="chip chip-word">
                {w}
              </span>
            ))}
          </div>
        </div>

        <div className="draft-note" role="note">
          AI가 만든 초안이에요. 검증된 정답이 아니니 사실관계·분량·일정은 직접 확인하고 발전시켜 주세요.
          {result.aiMode === 'mock' && <b> (예시 모드 결과)</b>}
          {result.edited && <span> · 직접 수정한 내용이 포함되어 있어요.</span>}
        </div>

        {generating && (
          <div className="generating inline" aria-live="polite">
            <div className="spinner" aria-hidden />
            <p className="small">
              {regenerating ? '요청한 부분을 보완하고 있어요. 기존 내용은 그대로 유지돼요.' : '실행안을 만들고 있어요…'}
            </p>
          </div>
        )}

        {failed && !generating && (
          <div className="error-box" role="alert">
            <p>{result.failureReason ?? '실행안을 만들지 못했어요.'}</p>
            <div className="popup-actions">
              <button className="btn btn-ghost" onClick={() => navigate(`/s/${result.sessionId}`)}>
                단어 화면으로
              </button>
              <button className="btn btn-primary" onClick={regenerate}>
                다시 시도
              </button>
            </div>
          </div>
        )}

        {!failed && result.items.some((i) => i.content) && (
          <ol className="steps">
            {result.items.map((item, n) => (
              <li key={item.key} className={item.key === 'reason' ? 'reason' : ''}>
                <div className="step-head">
                  <span className="step-no">{String(n + 1).padStart(2, '0')}</span>
                  <h2>{item.label}</h2>
                </div>
                {editing ? (
                  <textarea
                    value={draft[item.key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [item.key]: e.target.value })}
                    rows={Math.min(12, Math.max(3, (draft[item.key] ?? '').split('\n').length + 1))}
                    maxLength={5000}
                    aria-label={item.label}
                  />
                ) : item.content ? (
                  <p className="step-body">{item.content}</p>
                ) : (
                  <p className="step-body muted">비어 있어요. '세부안 보완'으로 채워 달라고 요청해 보세요.</p>
                )}
              </li>
            ))}
          </ol>
        )}

        {regenOpen && !editing && (
          <div className="regen">
            <label className="field">
              <span>어떤 부분을 보완할까요? (선택)</span>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="예: 재료 분량을 2인분 기준으로, 조리 시간을 더 자세히"
              />
            </label>
            <div className="popup-actions">
              <button className="btn btn-ghost" onClick={() => setRegenOpen(false)} disabled={regenerating}>
                취소
              </button>
              <button className="btn btn-primary" onClick={regenerate} disabled={regenerating}>
                {regenerating ? '보완 중…' : '보완 요청'}
              </button>
            </div>
          </div>
        )}

        <div className="result-actions">
          {editing ? (
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
                취소
              </button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? '저장 중…' : '수정 저장'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => navigate(`/s/${result.sessionId}`)}>
                새 단어로 다시 만들기
              </button>
              {result.status === 'SUCCESS' && !generating && (
                <>
                  <button className="btn btn-ghost" onClick={startEdit}>
                    직접 수정
                  </button>
                  <button className="btn btn-ghost" onClick={() => setRegenOpen((v) => !v)}>
                    세부안 보완
                  </button>
                  <button className="btn btn-ghost" onClick={copyAll}>
                    복사
                  </button>
                  <div className="export">
                    <span className="tiny muted">내보내기</span>
                    {(['pdf', 'md', 'txt'] as const).map((f) => (
                      <button key={f} className="chip chip-mini" onClick={() => exportAs(f)} disabled={!!exporting}>
                        {exporting === f ? '…' : f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {result.canDelete && (
                <button className="link-btn small danger" onClick={() => setConfirmDelete(true)}>
                  삭제
                </button>
              )}
            </>
          )}
        </div>
        <p className="tiny muted right">
          {result.authorName} · {new Date(result.createdAt).toLocaleString('ko-KR')} · 결과물은 같은 세션 참여자 모두가 볼 수 있어요
        </p>
      </article>

      {confirmDelete && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setConfirmDelete(false)}>
          <div className="modal modal-sm" role="alertdialog" aria-labelledby="del-title">
            <h2 id="del-title">이 결과물을 삭제할까요?</h2>
            <p className="muted small">세션 참여자 모두의 히스토리에서 사라지고 되돌릴 수 없어요.</p>
            <div className="popup-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                취소
              </button>
              <button className="btn btn-danger" onClick={remove}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
