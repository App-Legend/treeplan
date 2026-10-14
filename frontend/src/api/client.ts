import type {
  Category,
  CreateSessionResponse,
  DrawResponse,
  HistoryPage,
  IdeaResponse,
  JoinResponse,
  ResultResponse,
  SessionInfo,
  TokenResponse,
  UserInfo,
  WordTree,
} from './types';

/** 브라우저는 API 서버하고만 통신한다. (AI 키·DB 정보는 서버에만 있음) */
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

const STORAGE_KEY = 'seokkeobom.auth';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// ---------- 토큰 보관 ----------

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

let auth: StoredAuth | null = load();
const listeners = new Set<(user: UserInfo | null) => void>();

function load(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function save(next: StoredAuth | null) {
  auth = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 저장소를 못 써도 메모리 상태로 계속 동작 */
  }
  listeners.forEach((l) => l(next?.user ?? null));
}

export function currentUser(): UserInfo | null {
  return auth?.user ?? null;
}

export function accessToken(): string | null {
  return auth?.accessToken ?? null;
}

export function onAuthChange(listener: (user: UserInfo | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function logout() {
  save(null);
}

/** 토큰이 만료되어 다시 로그인이 필요할 때 화면(로그인 창)을 띄우기 위한 신호 */
const loginRequiredListeners = new Set<() => void>();
export function onLoginRequired(listener: () => void): () => void {
  loginRequiredListeners.add(listener);
  return () => loginRequiredListeners.delete(listener);
}

// ---------- 요청 ----------

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!auth?.refreshToken) return false;
  if (!refreshing) {
    const token = auth.refreshToken;
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as TokenResponse;
        save({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  raw?: boolean;
}

async function rawRequest(method: string, path: string, opts: RequestOptions, retried = false): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth?.accessToken) headers['Authorization'] = `Bearer ${auth.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  }

  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (!retried && (await refreshTokens())) {
      return rawRequest(method, path, opts, true);
    }
    save(null);
    loginRequiredListeners.forEach((l) => l());
    throw new ApiError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
  }
  if (!res.ok) {
    let code = 'ERROR';
    let message = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    try {
      const data = (await res.json()) as { code?: string; message?: string };
      if (data.code) code = data.code;
      if (data.message) message = data.message;
    } catch {
      /* 본문이 JSON이 아님 */
    }
    throw new ApiError(res.status, code, message);
  }
  return res;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(method, path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function storeTokens(t: TokenResponse): UserInfo {
  save({ accessToken: t.accessToken, refreshToken: t.refreshToken, user: t.user });
  return t.user;
}

// ---------- API 22개 (WS 구독은 realtime.ts) ----------

export const api = {
  // 화면 6: 로그인
  login: async (email: string, password: string) =>
    storeTokens(await request<TokenResponse>('POST', '/auth/login', { body: { email, password } })),
  signup: async (email: string, password: string, name: string) =>
    storeTokens(await request<TokenResponse>('POST', '/auth/signup', { body: { email, password, name } })),
  requestPasswordReset: (email: string) =>
    request<{ message: string }>('POST', '/auth/password-reset', { body: { email } }),

  // 화면 1~2: 세션
  createSession: (name: string, idempotencyKey: string) =>
    request<CreateSessionResponse>('POST', '/sessions', {
      body: { name },
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  joinSession: (teamCode: string) => request<JoinResponse>('POST', '/sessions/join', { body: { teamCode } }),
  getSession: (id: number) => request<SessionInfo>('GET', `/sessions/${id}`),
  leaveSession: (id: number) => request<{ success: boolean }>('DELETE', `/sessions/${id}/members/me`),
  closeSession: (id: number) => request<{ closedAt: string }>('POST', `/sessions/${id}/close`),

  // 화면 2: 카테고리·단어
  categories: () => request<Category[]>('GET', '/categories'),
  wordTree: (categoryId: number) => request<WordTree>('GET', `/categories/${categoryId}/words`),
  draw: (sessionId: number, categoryId: number, fixedWords: string[], excludedWords: string[]) =>
    request<DrawResponse>('POST', `/sessions/${sessionId}/draws`, {
      body: { categoryIds: [categoryId], fixedWords, excludedWords },
    }),

  // 화면 4: 아이디어
  generateIdea: (drawId: number) => request<IdeaResponse>('POST', `/draws/${drawId}/idea`),
  bookmarkIdea: (ideaId: number, bookmarked: boolean) =>
    request<{ ideaId: number; bookmarked: boolean; bookmarkedAt: string | null }>(
      'PUT',
      `/ideas/${ideaId}/bookmark`,
      { body: { bookmarked } },
    ),
  createResult: (ideaId: number) => request<ResultResponse>('POST', `/ideas/${ideaId}/result`),

  // 화면 5: 결과물
  getResult: (id: number) => request<ResultResponse>('GET', `/results/${id}`),
  updateResult: (id: number, items: Record<string, string>) =>
    request<ResultResponse>('PATCH', `/results/${id}`, { body: { items } }),
  regenerateResult: (id: number, feedback: string) =>
    request<ResultResponse>('POST', `/results/${id}/regenerate`, { body: { feedback } }),
  exportResult: async (id: number, format: 'pdf' | 'txt' | 'md') => {
    const res = await rawRequest('GET', `/results/${id}/export?format=${format}`, {});
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition) ?? /filename="?([^";]+)"?/i.exec(disposition);
    const filename = match ? decodeURIComponent(match[1]) : `seokkeobom.${format}`;
    return { blob, filename };
  },
  deleteResult: (id: number) => request<{ success: boolean }>('DELETE', `/results/${id}`),

  // 화면 7: 히스토리
  history: (q: string, categoryId: number | null, cursor: string | null) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (categoryId != null) params.set('categoryId', String(categoryId));
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return request<HistoryPage>('GET', `/history${qs ? `?${qs}` : ''}`);
  },
};
