import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useAuth } from '../state/auth';

/** 화면 1: 시작 · 팀 입장 */
export default function StartPage() {
  const navigate = useNavigate();
  const { user, requireLogin } = useAuth();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 같은 버튼을 여러 번 눌러도 세션이 하나만 생기도록 멱등 키를 한 번만 만든다.
  const idemKey = useRef<string>(crypto.randomUUID?.() ?? String(Date.now()));

  const start = () =>
    requireLogin(async () => {
      if (creating) return;
      setCreating(true);
      setError(null);
      try {
        const now = new Date();
        const name = `발상 세션 ${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const s = await api.createSession(name, idemKey.current);
        idemKey.current = crypto.randomUUID?.() ?? String(Date.now());
        navigate(`/s/${s.sessionId}`);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : '세션을 만들지 못했습니다.');
      } finally {
        setCreating(false);
      }
    }, '새 발상을 시작하려면 로그인해 주세요. 만든 아이디어가 기록에 남아요.');

  const join = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || joining) return;
    requireLogin(async () => {
      setJoining(true);
      setError(null);
      try {
        const res = await api.joinSession(trimmed);
        navigate(`/s/${res.sessionId}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : '입장하지 못했습니다.');
      } finally {
        setJoining(false);
      }
    }, '팀에 입장하려면 로그인해 주세요.');
  };

  return (
    <main className="start">
      <section className="hero card">
        <div className="brand-line">
          <span className="brand-mark" aria-hidden>
            ✳
          </span>
          <span className="brand-name">섞어봄</span>
        </div>
        <h1>
          막힌 생각에,
          <br />
          낯선 단어 세 개를 더해보세요.
        </h1>
        <p className="muted">
          음식 개발 · 프로그램 개발 · 공모전 기획 중 하나를 고르면, 무작위 단어 3개를 AI가 아이디어와 실행안으로
          연결해 드려요.
        </p>

        <button className="btn btn-primary btn-lg btn-block" onClick={start} disabled={creating}>
          {creating ? '세션을 만드는 중…' : '새로 시작하기 →'}
        </button>

        <form className="join" onSubmit={join}>
          <label htmlFor="team-code" className="small strong">
            팀 코드로 함께 시작하기
          </label>
          <div className="join-row">
            <input
              id="team-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="팀 코드 입력 (예: K7M2QX)"
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="off"
            />
            <button className="btn btn-outline" disabled={!code.trim() || joining}>
              {joining ? '확인 중…' : '입장하기'}
            </button>
          </div>
          {!code.trim() && <p className="tiny muted">팀원에게 받은 6자리 코드를 입력하세요.</p>}
        </form>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!user && (
          <p className="small muted center">
            계정이 있나요?{' '}
            <button className="link-btn" onClick={() => requireLogin(() => undefined)}>
              로그인
            </button>
          </p>
        )}
      </section>

      <ol className="how">
        <li>
          <b>분야 고르기</b>
          <span>음식·프로그램·공모전 중 하나</span>
        </li>
        <li>
          <b>단어 3개 확인</b>
          <span>단어를 눌러 가지를 뻗고, 마음에 드는 3개를 고정</span>
        </li>
        <li>
          <b>창조</b>
          <span>아이디어 → 분야별 실행안까지</span>
        </li>
      </ol>
    </main>
  );
}
