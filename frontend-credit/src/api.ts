// 백엔드(Spring Boot, /api) 호출. 개발 중에는 vite가 /api를 localhost:8080으로 넘긴다.
// 로그인하지 않았으면 게스트 토큰을 자동으로 받아 쓴다(로그인 없이 작업 가능).
// 로그인·가입할 때 게스트 토큰을 함께 보내면 게스트로 만든 결과가 계정 히스토리로 옮겨진다.

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";
const AUTH_KEY = "treeplan.auth";

export type UserInfo = { id: number; email: string | null; name: string; guest: boolean };
type Auth = { accessToken: string; refreshToken: string; user: UserInfo };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let auth: Auth | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
})();
const listeners = new Set<(u: UserInfo | null) => void>();
function readStoredAuth(): Auth | null {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}
// 다른 탭에서 로그인·갱신·로그아웃하면 이 탭도 따라간다
addEventListener("storage", (e) => {
  if (e.key !== AUTH_KEY) return;
  auth = readStoredAuth();
  listeners.forEach((l) => l(auth?.user ?? null));
});

function setAuth(next: Auth | null) {
  auth = next;
  try {
    if (next) localStorage.setItem(AUTH_KEY, JSON.stringify(next));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* 저장 공간이 없어도 이번 탭에서는 계속 동작 */
  }
  listeners.forEach((l) => l(next?.user ?? null));
}

export const currentUser = () => auth?.user ?? null;
/** 로그인한(게스트가 아닌) 사용자 이름 */
export const signedInName = () => (auth && !auth.user.guest ? auth.user.name : null);
export function onAuthChange(l: (u: UserInfo | null) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let guestPromise: Promise<void> | null = null;
async function ensureAuth() {
  if (auth) return;
  guestPromise ??= raw("POST", "/auth/guest")
    .then((r) => setAuth(r as Auth))
    .finally(() => (guestPromise = null));
  await guestPromise;
}

async function raw(method: string, path: string, body?: unknown, token?: string) {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "서버에 연결하지 못했어요. 백엔드가 실행 중인지 확인해 주세요.");
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    // 서버가 JSON 오류를 주지 않은 5xx = 개발 서버 프록시가 백엔드에 닿지 못한 경우가 대부분
    const unreachable = !data && res.status >= 500;
    throw new ApiError(
      res.status,
      data?.code ?? (unreachable ? "NETWORK" : "HTTP_" + res.status),
      data?.message ??
        (unreachable
          ? "서버에 연결하지 못했어요. 백엔드가 실행 중인지 확인해 주세요."
          : "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."),
    );
  }
  return data;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  if (!auth) return false;
  // 다른 탭이 먼저 갱신했다면(갱신 토큰은 한 번만 쓸 수 있음) 저장소의 새 토큰을 그대로 쓴다
  const stored = readStoredAuth();
  if (stored && stored.accessToken !== auth.accessToken) {
    auth = stored;
    return true;
  }
  refreshing ??= raw("POST", "/auth/refresh", { refreshToken: auth.refreshToken })
    .then((r) => {
      setAuth(r as Auth);
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  await ensureAuth();
  try {
    return (await raw(method, path, body, auth!.accessToken)) as T;
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    if (!(await refresh())) {
      // 로그인이 만료됨: 게스트로 다시 시작
      setAuth(null);
      await ensureAuth();
    }
    return (await raw(method, path, body, auth!.accessToken)) as T;
  }
}

// ---------- 인증 ----------
export async function login(email: string, password: string) {
  await ensureAuth();
  setAuth((await raw("POST", "/auth/login", { email, password }, guestToken())) as Auth);
}
export async function signup(email: string, password: string, name: string) {
  await ensureAuth();
  setAuth((await raw("POST", "/auth/signup", { email, password, name }, guestToken())) as Auth);
}
export const passwordReset = (email: string) => raw("POST", "/auth/password-reset", { email });
export function logout() {
  setAuth(null);
}
/** 게스트 작업을 계정으로 옮기려면 게스트 토큰을 함께 보낸다 */
const guestToken = () => (auth?.user.guest ? auth.accessToken : undefined);

// ---------- 타입 ----------
export type CategoryDto = { id: number; name: string; slug: string };
export type WordDto = { id: number; text: string; children: WordDto[] };
/** wordCount: 뻗은 단어 수, expandCount: 뻗은 횟수, remaining: 더 뻗을 수 있는 횟수 */
export type WordGroup = { id: number; text: string; wordCount: number; expandCount: number; remaining: number; children: WordDto[] };
export type WordTree = { categoryId: number; name: string; wordCount: number; maxExpandsPerRoot: number; groups: WordGroup[] };
export type Expand = { parentId: number; rootId: number; words: WordDto[]; rootWordCount: number; expandCount: number; remaining: number; aiMode: string };
export type Member = { userId: number; name: string; role: "OWNER" | "MEMBER"; joinedAt: string };
export type SessionInfo = {
  sessionId: number;
  name: string;
  teamCode: string | null;
  status: string;
  members: Member[];
  myRole: "OWNER" | "MEMBER";
  lastActivityAt: string;
};
export type Draw = { drawId: number; categoryId: number; words: string[]; attemptNo: number };
export type Idea = {
  ideaId: number;
  drawId: number;
  categoryName: string;
  words: string[];
  title: string | null;
  summary: string | null;
  status: "GENERATING" | "SUCCESS" | "FAILED";
  failureReason: string | null;
  resultId: number | null;
  aiMode: string;
};
export type ResultItem = { key: string; label: string; description: string; content: string };
export type Result = {
  resultId: number;
  ideaId: number;
  sessionId: number;
  title: string;
  ideaSummary: string;
  categoryId: number;
  categoryName: string;
  words: string[];
  items: ResultItem[];
  status: "GENERATING" | "SUCCESS" | "FAILED";
  failureReason: string | null;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  canDelete: boolean;
  notice: string | null;
  aiMode: string;
  saved: boolean;
  loginPrompt: string | null;
};
export type HistoryItem = {
  type: "RESULT" | "IDEA";
  id: number;
  sessionId: number;
  sessionName: string;
  teamSession: boolean;
  title: string;
  summary: string | null;
  words: string[];
  categoryId: number;
  categoryName: string;
  at: string;
  resultId: number | null;
  canDelete: boolean;
};

// ---------- 화면별 요청 ----------
export const categories = () => call<CategoryDto[]>("GET", "/categories");
export const wordTree = (categoryId: number, sessionId: number) =>
  call<WordTree>("GET", `/categories/${categoryId}/words?sessionId=${sessionId}`);
/** keep: 남길 단어(고정한 단어). 주면 그 단어는 하위 카테고리 바로 아래로 올라가고 나머지만 지워진다 */
export const resetTree = (sessionId: number, categoryId: number, keep: string[] = []) =>
  call<{ categoryId: number; deleted: number; kept: string[] }>(
    "DELETE",
    `/sessions/${sessionId}/categories/${categoryId}/words${keep.length ? "?" + keep.map((w) => "keep=" + encodeURIComponent(w)).join("&") : ""}`,
  );
export const expand = (nodeId: number, sessionId: number, count = 3) =>
  call<Expand>("POST", `/words/${nodeId}/expand`, { sessionId, count });

export const createSession = (name: string) => call<{ sessionId: number; name: string; teamCode: string | null }>("POST", "/sessions", { name });
export const joinSession = (teamCode: string) => call<{ sessionId: number; name: string }>("POST", "/sessions/join", { teamCode });
export const sessionInfo = (id: number) => call<SessionInfo>("GET", `/sessions/${id}`);

export const draw = (sessionId: number, categoryId: number, fixedWords: string[] = []) =>
  call<Draw>("POST", `/sessions/${sessionId}/draws`, { categoryIds: [categoryId], fixedWords });
export const generateIdea = (drawId: number) => call<Idea>("POST", `/draws/${drawId}/idea`);
export const createResult = (ideaId: number) => call<Result>("POST", `/ideas/${ideaId}/result`);
export const getResult = (id: number) => call<Result>("GET", `/results/${id}`);
export const updateResult = (id: number, items: Record<string, string>) => call<Result>("PATCH", `/results/${id}`, { items });
export const regenerate = (id: number, feedback: string) => call<Result>("POST", `/results/${id}/regenerate`, { feedback });
export const deleteResult = (id: number) => call<{ success: boolean }>("DELETE", `/results/${id}`);
export const history = (q: string, categoryId: number | null) =>
  call<{ items: HistoryItem[]; nextCursor: string | null }>(
    "GET",
    `/history?q=${encodeURIComponent(q)}${categoryId ? `&categoryId=${categoryId}` : ""}`,
  );

/** 서버에서 만든 PDF·TXT·MD 파일을 내려받는다 */
export async function exportResult(id: number, format: "pdf" | "txt" | "md", fallbackName: string) {
  await ensureAuth();
  const res = await fetch(`${BASE}/results/${id}/export?format=${format}`, {
    headers: { Authorization: "Bearer " + auth!.accessToken },
  });
  if (!res.ok) {
    const data = safeJson(await res.text());
    throw new ApiError(res.status, data?.code ?? "EXPORT", data?.message ?? "내보내기에 실패했어요.");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const m = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const name = m ? decodeURIComponent(m[1]) : `${fallbackName}.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
