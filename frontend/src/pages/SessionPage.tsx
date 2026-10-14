import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useSessionEvents } from '../api/realtime';
import type { Category, DrawResponse, SessionEvent, SessionInfo, WordTree } from '../api/types';
import IdeaPopup from '../components/IdeaPopup';
import WordTreeView from '../components/WordTreeView';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';

const WORD_COUNT = 3;

/** 화면 2: 카테고리 선택 · 단어 조합 (팀 세션 정보 포함) */
export default function SessionPage() {
  const { sessionId: idParam } = useParams();
  const sessionId = Number(idParam);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [tree, setTree] = useState<WordTree | null>(null);
  const [draw, setDraw] = useState<DrawResponse | null>(null);
  const [fixed, setFixed] = useState<string[]>([]);
  const [treeRound, setTreeRound] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'close' | null>(null);

  const loadSession = useCallback(async () => {
    try {
      setSession(await api.getSession(sessionId));
      setLoadError(null);
    } catch (e) {
      if (e instanceof ApiError) setLoadError(e);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!Number.isFinite(sessionId)) return;
    void loadSession();
    api
      .categories()
      .then(setCategories)
      .catch((e) => setDrawError(e instanceof ApiError ? e.message : '카테고리를 불러오지 못했어요.'));
  }, [sessionId, loadSession]);

  const channel = useSessionEvents(session ? sessionId : null, (e: SessionEvent) => {
    const name = typeof e.data.name === 'string' ? e.data.name : '팀원';
    if (e.type === 'MEMBER_JOINED' || e.type === 'MEMBER_LEFT') {
      if (e.data.userId !== user?.id) toast.show(`${name}님이 ${e.type === 'MEMBER_JOINED' ? '입장' : '퇴장'}했어요.`);
      void loadSession();
    } else if (e.type === 'RESULT_CREATED') {
      if (e.data.authorId !== user?.id) {
        const author = typeof e.data.authorName === 'string' ? e.data.authorName : '팀원';
        toast.show(`${author}님이 '${String(e.data.title ?? '새 결과물')}'을 만들었어요.`, 'info', {
          label: '열기',
          onClick: () => navigate(`/r/${String(e.data.resultId)}`),
        });
      }
    } else if (e.type === 'SESSION_CLOSED') {
      toast.show('방장이 세션을 종료했어요. 지금까지 만든 결과물은 히스토리에서 볼 수 있어요.');
      void loadSession();
    }
  });

  const active = session?.status === 'ACTIVE';

  /** 창조: 고정한 단어 3개를 조합으로 저장하고 아이디어 팝업을 연다. */
  const create = async () => {
    if (!category || fixed.length !== WORD_COUNT) return;
    setDrawing(true);
    setDrawError(null);
    try {
      setDraw(await api.draw(sessionId, category.id, fixed, []));
      setPopupOpen(true);
    } catch (e) {
      // 실패해도 카테고리와 고정한 단어는 유지한다. 불완전한 조합으로는 생성하지 않는다.
      setDrawError(e instanceof ApiError ? e.message : '조합을 저장하지 못했어요. 다시 시도해 주세요.');
      if (e instanceof ApiError && (e.code === 'SESSION_CLOSED' || e.code === 'SESSION_EXPIRED')) void loadSession();
    } finally {
      setDrawing(false);
    }
  };

  const resetTree = () => {
    setFixed([]);
    setDraw(null);
    setDrawError(null);
    setTreeRound((n) => n + 1);
  };

  const selectCategory = async (cat: Category) => {
    if (drawing || cat.id === category?.id) return;
    setCategory(cat);
    setTree(null);
    resetTree();
    try {
      setTree(await api.wordTree(cat.id));
    } catch (e) {
      setDrawError(e instanceof ApiError ? e.message : '단어 트리를 불러오지 못했어요.');
    }
  };

  const toggleFix = (w: string) => {
    if (fixed.includes(w)) setFixed(fixed.filter((f) => f !== w));
    else if (fixed.length < WORD_COUNT) setFixed([...fixed, w]);
    else toast.show('단어는 3개까지 고정할 수 있어요. 바꾸려면 먼저 하나를 풀어 주세요.');
  };

  const copyCode = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.teamCode);
      toast.show('팀 코드를 복사했어요. 팀원에게 전달해 주세요.', 'success');
    } catch {
      toast.show(`팀 코드: ${session.teamCode}`);
    }
  };

  const leaveOrClose = async () => {
    try {
      if (confirm === 'leave') {
        await api.leaveSession(sessionId);
        toast.show('세션에서 나왔어요.');
        navigate('/');
      } else if (confirm === 'close') {
        await api.closeSession(sessionId);
        toast.show('세션을 종료했어요. 팀 코드는 더 이상 쓸 수 없어요.');
        await loadSession();
      }
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '처리하지 못했어요.', 'error');
    } finally {
      setConfirm(null);
    }
  };

  if (loadError) {
    return (
      <main className="page narrow">
        <div className="card empty">
          <h2>세션을 열 수 없어요</h2>
          <p className="muted">{loadError.message}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            처음 화면으로
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="session-bar card">
        {session ? (
          <>
            <div className="session-title">
              <h1>{session.name}</h1>
              <span className={`status-dot ${channel}`} title={channel === 'live' ? '실시간 연결됨' : '실시간 연결 대기 중'} />
            </div>
            <div className="session-meta">
              <button className="chip chip-code" onClick={copyCode} title="팀 코드 복사">
                팀 코드 <b>{session.teamCode}</b> ⧉
              </button>
              <div className="members" aria-label="참여자">
                {session.members.map((m) => (
                  <span key={m.userId} className="member" title={m.role === 'OWNER' ? '방장' : '팀원'}>
                    {m.name}
                    {m.role === 'OWNER' && <small> · 방장</small>}
                  </span>
                ))}
              </div>
              {active &&
                (session.myRole === 'OWNER' ? (
                  <button className="link-btn small danger" onClick={() => setConfirm('close')}>
                    세션 종료
                  </button>
                ) : (
                  <button className="link-btn small" onClick={() => setConfirm('leave')}>
                    나가기
                  </button>
                ))}
            </div>
          </>
        ) : (
          <div className="skeleton-line" />
        )}
      </section>

      {session && !active && (
        <div className="banner" role="status">
          {session.status === 'CLOSED'
            ? '방장이 종료한 세션이에요. 새 아이디어는 만들 수 없지만, 결과물은 히스토리에서 볼 수 있어요.'
            : '30일 동안 활동이 없어 만료된 세션이에요. 새로 시작해 주세요.'}{' '}
          <button className="link-btn" onClick={() => navigate('/')}>
            새로 시작하기
          </button>
        </div>
      )}

      <section className="card compose">
        <h2 className="section-title">어떤 아이디어를 만들까요?</h2>
        <div className="chips" role="radiogroup" aria-label="카테고리">
          {categories == null && <span className="small muted">카테고리를 불러오는 중…</span>}
          {categories?.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={category?.id === c.id}
              className={`chip chip-select ${category?.id === c.id ? 'on' : ''}`}
              onClick={() => selectCategory(c)}
              disabled={!active || drawing}
            >
              {c.name}
            </button>
          ))}
        </div>

        {!category && <p className="hint">카테고리를 고르면 그 분야의 단어 트리가 열려요.</p>}
        {category && (
          <p className="small muted">
            가지나 단어를 누르면 아래로 새 단어가 뻗어 나가요. 마음에 드는 단어는 '고정'을 눌러 3개를 골라 주세요.
          </p>
        )}

        {category && (
          <>
            <div className="tree-wrap">
              {tree ? (
                <WordTreeView
                  key={`${category.id}-${treeRound}`}
                  tree={tree}
                  fixed={fixed}
                  onToggleFix={toggleFix}
                  disabled={!active || drawing}
                />
              ) : (
                <div className="skeleton-block" />
              )}
            </div>

            <div className="combo">
              <h3 className="small strong">이번 조합</h3>
              <div className="combo-row">
                <div className="combo-words" aria-busy={drawing}>
                  {Array.from({ length: WORD_COUNT }, (_, i) => {
                    const w = fixed[i];
                    return w ? (
                      <div key={w} className="word-card fixed">
                        <span className="word">{w}</span>
                        <div className="word-actions">
                          <button className="mini" onClick={() => toggleFix(w)} disabled={!active || drawing}>
                            고정 풀기
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="word-card placeholder">
                        <span className="tiny muted">단어 {i + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="combo-actions">
                  <button className="btn btn-outline" onClick={resetTree} disabled={!active || drawing || !tree}>
                    다시 뽑기
                  </button>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={create}
                    disabled={!active || drawing || fixed.length !== WORD_COUNT}
                  >
                    {drawing ? '준비 중…' : '✳ 창조'}
                  </button>
                </div>
              </div>
              <p className="tiny muted">
                고정한 단어 {fixed.length}/{WORD_COUNT} · 3개를 모두 고정하면 창조할 수 있어요. '다시 뽑기'는 트리를
                처음부터 다시 시작해요.
              </p>
              {drawError && (
                <p className="form-error" role="alert">
                  {drawError}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {popupOpen && draw && category && (
        <IdeaPopup
          drawId={draw.drawId}
          categoryName={category.name}
          words={draw.words}
          onClose={() => setPopupOpen(false)}
          onNewCombination={() => setPopupOpen(false)}
        />
      )}

      {confirm && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="modal modal-sm" role="alertdialog" aria-labelledby="confirm-title">
            <h2 id="confirm-title">{confirm === 'close' ? '세션을 종료할까요?' : '세션에서 나갈까요?'}</h2>
            <p className="muted small">
              {confirm === 'close'
                ? '팀 코드로 더 이상 입장할 수 없고 새 아이디어도 만들 수 없어요. 만든 결과물은 히스토리에 남아요.'
                : '나가면 이 세션의 결과물을 히스토리에서 볼 수 없어요. 팀 코드로 다시 들어올 수 있어요.'}
            </p>
            <div className="popup-actions">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
                취소
              </button>
              <button className="btn btn-danger" onClick={leaveOrClose}>
                {confirm === 'close' ? '종료하기' : '나가기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
