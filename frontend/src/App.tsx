import { useState, type ReactNode } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import HistorySidebar from './components/HistorySidebar';
import ResultPage from './pages/ResultPage';
import SessionPage from './pages/SessionPage';
import StartPage from './pages/StartPage';
import { useAuth } from './state/auth';

function RequireLogin({ children }: { children: ReactNode }) {
  const { user, openLogin } = useAuth();
  if (user) return <>{children}</>;
  return (
    <main className="page narrow">
      <div className="card empty">
        <h2>로그인이 필요해요</h2>
        <p className="muted">세션과 결과물은 참여자만 볼 수 있어요. 로그인하면 이 화면으로 바로 돌아옵니다.</p>
        <button className="btn btn-primary" onClick={() => openLogin()}>
          로그인
        </button>
      </div>
    </main>
  );
}

export default function App() {
  const { user, requireLogin, logout } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="logo">
          <span className="brand-mark" aria-hidden>
            ✳
          </span>
          섞어봄
          <span className="logo-sub">단어 세 개에서 시작하는 AI 발상 도구</span>
        </Link>
        <nav className="topbar-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => requireLogin(() => setHistoryOpen(true), '히스토리는 로그인 후 볼 수 있어요.')}
          >
            히스토리
          </button>
          {user ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                logout();
                navigate('/');
              }}
              title={user.email}
            >
              {user.name} · 로그아웃
            </button>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={() => requireLogin(() => undefined)}>
              로그인
            </button>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route
          path="/s/:sessionId"
          element={
            <RequireLogin>
              <SessionPage />
            </RequireLogin>
          }
        />
        <Route
          path="/r/:resultId"
          element={
            <RequireLogin>
              <ResultPage />
            </RequireLogin>
          }
        />
        <Route
          path="*"
          element={
            <main className="page narrow">
              <div className="card empty">
                <h2>없는 화면이에요</h2>
                <Link className="btn btn-primary" to="/">
                  처음 화면으로
                </Link>
              </div>
            </main>
          }
        />
      </Routes>

      {historyOpen && user && <HistorySidebar onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
