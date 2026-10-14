import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import Modal from './Modal';

type Mode = 'login' | 'signup' | 'reset';

interface Props {
  reason?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/** 화면 6: 로그인 창 (이메일 로그인·회원가입·비밀번호 찾기). 소셜 로그인은 팀 결정으로 제외. */
export default function LoginModal({ reason, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    setError(null);
    setNotice(null);
  }, [mode]);

  const filled =
    email.trim() !== '' && (mode === 'reset' || password !== '') && (mode !== 'signup' || name.trim() !== '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!filled || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await api.login(email.trim(), password);
        onSuccess();
      } else if (mode === 'signup') {
        await api.signup(email.trim(), password, name.trim());
        onSuccess();
      } else {
        const res = await api.requestPasswordReset(email.trim());
        setNotice(res.message);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : '네트워크 문제로 처리하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? '다시 만나서 반가워요' : mode === 'signup' ? '섞어봄 시작하기' : '비밀번호 찾기';

  return (
    <Modal onClose={onClose} labelledBy="login-title" size="sm">
      <div className="login">
        <div className="brand-mark" aria-hidden>
          ✳
        </div>
        <h2 id="login-title">{title}</h2>
        <p className="muted small center">
          {reason ?? '로그인하면 만든 아이디어를 저장하고 팀과 함께 볼 수 있어요.'}
        </p>

        <form onSubmit={submit} className="stack" noValidate>
          <label className="field">
            <span>이메일</span>
            <input
              ref={emailRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          {mode === 'signup' && (
            <label className="field">
              <span>이름</span>
              <input
                autoComplete="name"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder="팀원에게 보일 이름"
              />
            </label>
          )}
          {mode !== 'reset' && (
            <label className="field">
              <span>비밀번호</span>
              <div className="input-with-action">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? '영문+숫자 8자 이상' : ''}
                />
                <button type="button" className="link-btn" onClick={() => setShowPw((v) => !v)}>
                  {showPw ? '숨김' : '표시'}
                </button>
              </div>
            </label>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="form-notice">{notice}</p>}

          <button className="btn btn-primary btn-block" disabled={!filled || busy}>
            {busy ? '처리 중…' : mode === 'login' ? '이메일로 계속하기' : mode === 'signup' ? '가입하고 계속하기' : '재설정 안내 받기'}
          </button>
        </form>

        <div className="login-links">
          {mode !== 'login' && (
            <button className="link-btn" onClick={() => setMode('login')}>
              로그인으로
            </button>
          )}
          {mode !== 'signup' && (
            <button className="link-btn" onClick={() => setMode('signup')}>
              회원가입
            </button>
          )}
          {mode !== 'reset' && (
            <button className="link-btn" onClick={() => setMode('reset')}>
              비밀번호 찾기
            </button>
          )}
        </div>
        <p className="muted tiny center">
          이메일·이름·비밀번호만 받으며 아이디어 기록 저장에만 씁니다. 로그인하면 작업 화면으로 돌아갑니다.
        </p>
      </div>
    </Modal>
  );
}
