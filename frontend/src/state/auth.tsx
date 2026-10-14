import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { currentUser, logout as clearAuth, onAuthChange, onLoginRequired } from '../api/client';
import type { UserInfo } from '../api/types';
import LoginModal from '../components/LoginModal';

interface LoginRequest {
  reason?: string;
  /** 로그인 성공 후 이어서 할 작업 (명세: 로그인 후 원래 작업으로 복귀) */
  then?: () => void;
}

interface AuthContextValue {
  user: UserInfo | null;
  openLogin: (req?: LoginRequest) => void;
  /** 로그인되어 있으면 바로 실행, 아니면 로그인 창을 띄우고 성공하면 실행 */
  requireLogin: (action: () => void, reason?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(currentUser());
  const [loginOpen, setLoginOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const pending = useRef<(() => void) | undefined>();

  useEffect(() => onAuthChange(setUser), []);
  useEffect(
    () =>
      onLoginRequired(() => {
        setReason('로그인이 만료되었어요. 다시 로그인하면 하던 화면으로 돌아갑니다.');
        pending.current = undefined;
        setLoginOpen(true);
      }),
    [],
  );

  const openLogin = useCallback((req?: LoginRequest) => {
    setReason(req?.reason);
    pending.current = req?.then;
    setLoginOpen(true);
  }, []);

  const requireLogin = useCallback(
    (action: () => void, why?: string) => {
      if (currentUser()) action();
      else openLogin({ reason: why, then: action });
    },
    [openLogin],
  );

  const handleSuccess = () => {
    setLoginOpen(false);
    const next = pending.current;
    pending.current = undefined;
    next?.();
  };

  return (
    <AuthContext.Provider value={{ user, openLogin, requireLogin, logout: clearAuth }}>
      {children}
      {loginOpen && (
        <LoginModal
          reason={reason}
          onClose={() => {
            pending.current = undefined;
            setLoginOpen(false);
          }}
          onSuccess={handleSuccess}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider가 필요합니다.');
  return ctx;
}
