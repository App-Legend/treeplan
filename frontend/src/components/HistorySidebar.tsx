import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { Category, HistoryItem } from '../api/types';
import { useToast } from '../state/toast';

interface Props {
  onClose: () => void;
}

function when(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 2) return '어제';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 화면 7: 히스토리 사이드바 — 결과물과 보관한 아이디어를 시간순으로 */
export default function HistorySidebar({ onClose }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HistoryItem | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => undefined);
  }, []);

  // 검색어 입력은 잠시 멈췄을 때 반영
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(
    async (reset: boolean, from: string | null) => {
      const seq = ++reqSeq.current;
      setLoading(true);
      setError(null);
      try {
        const page = await api.history(query, categoryId, reset ? null : from);
        if (seq !== reqSeq.current) return;
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setCursor(page.nextCursor);
      } catch (e) {
        if (seq === reqSeq.current) setError(e instanceof ApiError ? e.message : '목록을 불러오지 못했어요.');
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [query, categoryId],
  );

  useEffect(() => {
    setSelected(null);
    void fetchPage(true, null);
  }, [fetchPage]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!loading && cursor && el.scrollTop + el.clientHeight > el.scrollHeight - 120) {
      void fetchPage(false, cursor);
    }
  };

  const key = (it: HistoryItem) => `${it.type}-${it.id}`;

  const open = (it: HistoryItem) => {
    if (it.type === 'RESULT') {
      navigate(`/r/${it.id}`);
      onClose();
    } else {
      setSelected(selected && key(selected) === key(it) ? null : it);
    }
  };

  const makeResult = async (it: HistoryItem) => {
    setBusyId(key(it));
    try {
      const r = await api.createResult(it.id);
      navigate(`/r/${r.resultId}`);
      onClose();
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '실행안을 만들지 못했어요.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const unbookmark = async (it: HistoryItem) => {
    setBusyId(key(it));
    try {
      await api.bookmarkIdea(it.id, false);
      setItems((list) => list.filter((x) => key(x) !== key(it)));
      setSelected(null);
      toast.show('보관을 해제했어요.');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '보관을 해제하지 못했어요.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (it: HistoryItem) => {
    setConfirmDelete(null);
    setBusyId(key(it));
    try {
      await api.deleteResult(it.id);
      setItems((list) => list.filter((x) => key(x) !== key(it)));
      toast.show('결과물을 삭제했어요.');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '삭제하지 못했어요.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="sidebar-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sidebar" aria-label="아이디어 히스토리">
        <div className="sidebar-head">
          <h2>히스토리</h2>
          <button className="icon-btn" onClick={onClose} aria-label="사이드바 닫기">
            ‹
          </button>
        </div>
        <input
          className="search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="⌕ 제목·단어 검색"
          aria-label="히스토리 검색"
        />
        <div className="chips filter">
          <button className={`chip chip-mini ${categoryId == null ? 'on' : ''}`} onClick={() => setCategoryId(null)}>
            전체
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip chip-mini ${categoryId === c.id ? 'on' : ''}`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </button>
          ))}
          <button className="link-btn tiny" onClick={() => void fetchPage(true, null)}>
            새로고침
          </button>
        </div>

        <div className="sidebar-list" onScroll={onScroll}>
          {error && (
            <div className="error-box">
              <p>{error}</p>
              <button className="btn btn-outline" onClick={() => void fetchPage(true, null)}>
                다시 불러오기
              </button>
            </div>
          )}
          {!error && !loading && items.length === 0 && (
            <p className="empty-note">
              {query || categoryId != null
                ? '조건에 맞는 기록이 없어요.'
                : '아직 기록이 없어요. 아이디어로 실행안을 만들거나 아이디어를 보관하면 여기에 표시돼요.'}
            </p>
          )}
          {items.map((it) => {
            const isSel = selected != null && key(selected) === key(it);
            return (
              <div key={key(it)} className={`history-item ${isSel ? 'selected' : ''}`}>
                <button className="history-main" onClick={() => open(it)}>
                  <span className="history-title">
                    {it.type === 'IDEA' && <span className="badge">보관</span>}
                    {it.status === 'FAILED' && <span className="badge badge-warn">생성 실패</span>}
                    {it.title ?? '(제목 없음)'}
                  </span>
                  <span className="tiny muted">
                    {it.categoryName} · {when(it.at)}
                    {it.teamSession && ' · 팀'}
                  </span>
                  <span className="tiny muted">{it.words.join(' · ')}</span>
                </button>
                {isSel && it.type === 'IDEA' && (
                  <div className="history-detail">
                    <p className="small">{it.summary}</p>
                    <div className="chips">
                      {it.resultId ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            navigate(`/r/${it.resultId}`);
                            onClose();
                          }}
                        >
                          결과 다시 보기
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busyId === key(it)}
                          onClick={() => makeResult(it)}
                        >
                          {busyId === key(it) ? '만드는 중…' : '이 아이디어로 실행안 만들기'}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" disabled={busyId === key(it)} onClick={() => unbookmark(it)}>
                        보관 해제
                      </button>
                    </div>
                  </div>
                )}
                {it.type === 'RESULT' && it.canDelete && (
                  <button
                    className="history-delete"
                    aria-label="결과물 삭제"
                    title="삭제"
                    disabled={busyId === key(it)}
                    onClick={() => setConfirmDelete(it)}
                  >
                    🗑
                  </button>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="history-loading">
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          )}
          {!loading && cursor && (
            <button className="btn btn-ghost btn-block" onClick={() => void fetchPage(false, cursor)}>
              더 보기
            </button>
          )}
        </div>

        {confirmDelete && (
          <div className="inline-confirm" role="alertdialog">
            <p className="small">
              '{confirmDelete.title}'을(를) 삭제할까요? 세션 참여자 모두의 기록에서 사라지고 되돌릴 수 없어요.
            </p>
            <div className="popup-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                취소
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(confirmDelete)}>
                삭제
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
