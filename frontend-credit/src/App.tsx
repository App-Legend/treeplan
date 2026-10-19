import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button, Close, Icon, Logo, Modal, Numbered } from "./ui";
import TreeCanvas from "./TreeCanvas";
import TreeCanvasPreview from "./TreeCanvasPreview";
import * as api from "./api";
import {
  categories,
  initialSession,
  makePlan,
  readLocal,
  sampleHistory,
  samplePlan,
  screenList,
  writeLocal,
} from "./data";
import type { Category, Plan, Session } from "./data";
type Overlay =
  | "login"
  | "signup"
  | "reset"
  | "idea"
  | "loading"
  | "history"
  | "members"
  | "delete"
  | "save"
  | "reset"
  | null;
const go = (path: string) => {
  location.hash = path;
};
const errorText = (e: unknown) =>
  e instanceof api.ApiError ? e.message : "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
/** 서버 결과물 → 화면의 Plan 형식 */
function toPlan(r: api.Result): Plan {
  return {
    id: String(r.resultId),
    resultId: r.resultId,
    title: r.title,
    category: r.categoryName as Category,
    words: r.words,
    summary: r.ideaSummary,
    sections: r.items.map((i) => ({ title: i.label, body: i.content })),
    keys: r.items.map((i) => i.key),
    created: r.createdAt,
    saved: r.saved,
    loginPrompt: r.loginPrompt,
    canDelete: r.canDelete,
    author: r.authorName,
    aiMode: r.aiMode,
  };
}
type IdeaView = {
  ideaId?: number;
  title: string;
  summary: string;
  status: "GENERATING" | "SUCCESS" | "FAILED";
  failure?: string | null;
  words: string[];
  aiMode?: string;
};
const dateLabel = (s: string, short = false) => {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}${short ? "" : ` ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`}`;
};
function startForPreview(id: string): Session {
  const s = initialSession();
  if (["07", "08", "09", "10", "11", "19"].includes(id))
    s.category = "음식 개발";
  if (["08", "09", "10", "11", "19"].includes(id)) s.expanded = true;
  if (["09", "10", "11", "19"].includes(id))
    s.words = ["흑임자", "쑥", "고구마"];
  s.team = ["21", "22", "22-1"].includes(id);
  return s;
}
export default function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const h = () => setRoute(location.hash.slice(1) || "/");
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  return (
    <Experience
      key={route.startsWith("/preview/") ? route : "app"}
      route={route}
    />
  );
}
function Experience({ route }: { route: string }) {
  const preview = route.startsWith("/preview/") ? route.split("/")[2] : "";
  const [user, setUser] = useState<string | null>(() =>
    preview
      ? !["01", "02", "03", "04", "20", "25", "26"].includes(preview)
        ? "김방장"
        : null
      : api.signedInName(),
  );
  const [session, setSession] = useState<Session>(() =>
    preview ? startForPreview(preview) : readLocal("session", initialSession()),
  );
  const [plans, setPlans] = useState<Plan[]>(() =>
    readLocal("plans", sampleHistory),
  );
  const [overlay, setOverlay] = useState<Overlay>(
    () =>
      (
        ({
          "02": "login",
          "03": "reset",
          "04": "signup",
          "10": "loading",
          "11": "idea",
          "18": "delete",
          "19": "history",
          "22-1": "members",
        }) as Record<string, Overlay>
      )[preview] || null,
  );
  const [code, setCode] = useState(preview === "20" ? "GTV6YV" : "");
  const [codeError, setCodeError] = useState("");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState(
    preview === "21"
      ? "김방장님의 세션에 입장했어요."
      : preview === "22"
        ? "이팀원님이 입장했어요."
        : preview === "16"
          ? "실행안을 보완했어요. 바뀐 부분은 초록색으로 표시돼요."
          : preview === "17"
            ? "내보내기 형식을 선택하면 파일을 저장할 수 있어요."
            : "",
  );
  const [draft, setDraft] = useState<Plan>(samplePlan);
  const [mode, setMode] = useState<"view" | "edit" | "refine">(
    preview === "14" ? "edit" : preview === "15" ? "refine" : "view",
  );
  const [edit, setEdit] = useState<Plan>(samplePlan);
  const [request, setRequest] = useState("");
  const [refining, setRefining] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [returnAfterLogin, setReturnAfterLogin] = useState(false);
  const [catIds, setCatIds] = useState<Record<string, number>>({});
  const [idea, setIdea] = useState<IdeaView | null>(null);
  const [serverResult, setServerResult] = useState<Plan | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<api.HistoryItem[] | null>(null);
  const [working, setWorking] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const page = preview
    ? ["01", "02", "03", "04", "05", "20"].includes(preview)
      ? "home"
      : ["13", "14", "15", "16", "17", "18"].includes(preview)
        ? "result"
        : preview === "25"
          ? "404"
          : preview === "26"
            ? "401"
            : "session"
    : route === "/"
      ? "home"
      : route === "/session"
        ? "session"
        : route.startsWith("/result/")
          ? "result"
          : route === "/401"
            ? "401"
            : route === "/screens"
              ? "screens"
              : route === "/responsive"
                ? "responsive"
                : "404";
  const resultId = route.split("/")[2];
  const result = preview
    ? preview === "16"
      ? {
          ...samplePlan,
          refined:
            "1주차 재료 비율 테스트 → 2주차 굽는 시간 조정 → 3주차 시식 피드백 반영",
        }
      : draft
    : serverResult && serverResult.id === resultId
      ? serverResult
      : undefined;
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  const updateSession = (s: Session) => {
    setSession(s);
    if (!preview && !writeLocal("session", s))
      notify(
        "브라우저 저장 공간이 부족해 새로고침 후에는 변경 내용이 유지되지 않을 수 있어요.",
      );
  };
  const updatePlans = (next: Plan[]) => {
    setPlans(next);
    if (!writeLocal("plans", next))
      notify("브라우저 저장 공간이 부족해 파일로 내보내기를 권장해요.");
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    setOverlay(null);
    setMenu(false);
    setMode("view");
    window.scrollTo(0, 0);
  }, [route]);
  // Preview states are restored after the route lifecycle above, without changing persisted data.
  useEffect(() => {
    if (preview) {
      setOverlay(
        (
          {
            "02": "login",
            "03": "reset",
            "04": "signup",
            "10": "loading",
            "11": "idea",
            "18": "delete",
            "19": "history",
            "22-1": "members",
          } as Record<string, Overlay>
        )[preview] || null,
      );
      setMode(preview === "14" ? "edit" : preview === "15" ? "refine" : "view");
    }
  }, [preview]);
  useEffect(() => {
    if (page === "result" && result) setDraft(result);
  }, [page, resultId]);
  useEffect(() => {
    if (preview) return;
    const off = api.onAuthChange((u) => setUser(u && !u.guest ? u.name : null));
    // 서버가 아직 안 떠 있으면 카테고리 목록을 3초마다 다시 받아 온다
    let retry: ReturnType<typeof setTimeout> | undefined;
    const loadCategories = () =>
      api
        .categories()
        .then((cs) => setCatIds(Object.fromEntries(cs.map((c) => [c.name, c.id]))))
        .catch(() => {
          retry = setTimeout(loadCategories, 3000);
        });
    loadCategories();
    return () => {
      off();
      if (retry) clearTimeout(retry);
    };
  }, []);
  // 세션 화면에 왔는데 서버 세션이 없으면(처음·이전 데모 데이터) 새로 만든다. 있으면 참여자·팀 코드를 갱신한다.
  useEffect(() => {
    if (preview || page !== "session") return;
    if (!session.sessionId) {
      newSession();
      return;
    }
    refreshSession(session.sessionId).catch(() => newSession());
  }, [page]);
  useEffect(() => {
    if (preview || page !== "result" || !resultId) return;
    setResultLoading(true);
    api
      .getResult(Number(resultId))
      .then((r) => setServerResult(toPlan(r)))
      .catch((e) => {
        setServerResult(null);
        notify(errorText(e));
      })
      .finally(() => setResultLoading(false));
  }, [page, resultId, user]);
  async function refreshSession(id: number, base: Session = session) {
    const info = await api.sessionInfo(id);
    const me = api.currentUser()?.id;
    updateSession({
      ...base,
      sessionId: id,
      code: info.teamCode ?? "",
      team: info.members.length > 1,
      members: info.members.map((m) => ({ name: m.name, role: m.role, joinedAt: m.joinedAt, me: m.userId === me })),
    });
  }
  async function newSession() {
    setOverlay(null);
    if (preview) {
      updateSession(initialSession());
      go("/session");
      return;
    }
    try {
      const s = await api.createSession("새 발상 세션");
      const base = { ...initialSession(), code: s.teamCode ?? "", sessionId: s.sessionId };
      updateSession(base);
      go("/session");
      await refreshSession(s.sessionId, base);
    } catch (e) {
      notify(errorText(e));
    }
  }
  async function join(e: FormEvent) {
    e.preventDefault();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setCodeError("영문과 숫자로 된 6자리 코드를 입력해 주세요.");
      return;
    }
    setCodeError("");
    if (!user) {
      setSaveMessage("팀 코드로 함께 작업하려면 먼저 로그인해 주세요.");
      setOverlay("save");
      return;
    }
    try {
      const j = await api.joinSession(code);
      const base = { ...initialSession(), sessionId: j.sessionId };
      updateSession(base);
      await refreshSession(j.sessionId, base);
      go("/session");
      notify(`'${j.name}' 세션에 입장했어요.`);
    } catch (err) {
      setCodeError(errorText(err));
    }
  }
  function changeCategory(category: Category) {
    updateSession({
      ...session,
      category,
      categoryId: catIds[category],
      words: [],
      drawId: undefined,
      drawWords: undefined,
      expanded: false,
      reroll: 0,
    });
  }
  const unfix = (i: number) =>
    updateSession({ ...session, words: session.words.filter((_, n) => n !== i) });
  /** 트리 초기화: 이 분야에서 뻗은 단어를 모두 지우고, 고정한 단어도 비운 뒤 처음처럼 다시 뻗는다 */
  async function resetTree() {
    setOverlay(null);
    if (!session.sessionId || !session.categoryId) return;
    try {
      await api.resetTree(session.sessionId, session.categoryId);
      // reroll 값을 바꾸면 트리 캔버스가 다시 불러오고, 비어 있으니 뿌리 3개에서 자동으로 뻗는다
      updateSession({ ...session, words: [], drawId: undefined, drawWords: undefined, reroll: session.reroll + 1 });
      notify("트리를 초기화했어요. 새 단어를 뻗고 있어요.");
    } catch (e) {
      notify(errorText(e));
    }
  }
  async function generate() {
    if (session.words.length !== 3 || !session.category) return;
    if (preview || !session.sessionId || !session.categoryId) {
      setDraft(makePlan(session.category, session.words));
      setOverlay("loading");
      timer.current = setTimeout(() => setOverlay("idea"), 1400);
      return;
    }
    const words = session.words;
    setIdea({ title: "", summary: "", status: "GENERATING", words });
    setOverlay("loading");
    try {
      // 고정한 3개로 새 추출을 만들고(같은 조합이면 기존 추출 재사용) 아이디어를 생성한다.
      const same = session.drawId && session.drawWords && session.drawWords.join() === words.join();
      const drawId = same ? session.drawId! : (await api.draw(session.sessionId, session.categoryId, words)).drawId;
      if (!same) updateSession({ ...session, drawId, drawWords: words });
      const r = await api.generateIdea(drawId);
      setIdea({
        ideaId: r.ideaId,
        title: r.title ?? "",
        summary: r.summary ?? "",
        status: r.status,
        failure: r.failureReason,
        words: r.words,
        aiMode: r.aiMode,
      });
      if (r.status === "SUCCESS") updateSession({ ...session, drawId: undefined, drawWords: undefined });
    } catch (e) {
      setIdea({ title: "", summary: "", status: "FAILED", failure: errorText(e), words });
    }
    setOverlay("idea");
  }
  async function createResult() {
    if (preview || !idea?.ideaId) {
      const p = { ...draft, id: crypto.randomUUID() };
      updatePlans([p, ...plans]);
      setOverlay(null);
      go("/result/" + p.id);
      return;
    }
    setWorking(true);
    try {
      const r = await api.createResult(idea.ideaId);
      if (r.status !== "SUCCESS") {
        // 실패하면 빈 결과 화면으로 넘어가지 않고 아이디어 창에서 다시 시도하게 한다
        notify(r.failureReason || "실행안을 만들지 못했어요. 다시 시도해 주세요.");
        return;
      }
      const p = toPlan(r);
      setServerResult(p);
      go("/result/" + p.id);
      if (!p.saved) {
        setSaveMessage(p.loginPrompt || "히스토리로 남기고 싶다면 로그인해 주세요. 나가면 저장되지 않습니다.");
        setTimeout(() => setOverlay("save"), 0);
      } else notify("실행안을 만들어 히스토리에 저장했어요.");
    } catch (e) {
      notify(errorText(e));
    } finally {
      setWorking(false);
    }
  }
  async function copy(text: string, message = "복사했어요.") {
    try {
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch {
      notify("복사 권한을 사용할 수 없어요. 내보내기로 파일을 저장해 주세요.");
    }
  }
  const planText = (p: Plan, md = false) =>
    `${md ? "# " : ""}${p.title}\n\n${p.summary}\n\n사용한 단어: ${p.words.join(" · ")}\n\n${p.sections.map((s) => `${md ? "## " : ""}${s.title}\n${s.body}`).join("\n\n")}${p.refined ? "\n\n보완 내용\n" + p.refined : ""}`;
  async function exportPlan(format: string) {
    if (!result) return;
    if (result.resultId && !preview) {
      try {
        await api.exportResult(result.resultId, format.toLowerCase() as "pdf" | "txt" | "md", result.title);
        notify(format + " 파일로 내보냈어요.");
      } catch (e) {
        notify(errorText(e));
      }
      return;
    }
    if (format === "PDF") {
      window.print();
      return;
    }
    const blob = new Blob(["\uFEFF" + planText(result, format === "MD")], {
      type:
        format === "MD"
          ? "text/markdown;charset=utf-8"
          : "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.title + "." + format.toLowerCase();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(format + " 파일로 내보냈어요.");
  }
  function saveEdit() {
    if (!edit.title.trim()) {
      notify("제목을 입력해 주세요.");
      return;
    }
    const next = { ...edit, title: edit.title.trim() };
    if (!preview && result?.resultId && result.keys) {
      const items = Object.fromEntries(result.keys.map((k, i) => [k, edit.sections[i].body]));
      api
        .updateResult(result.resultId, items)
        .then((r) => {
          setServerResult(toPlan(r));
          setMode("view");
          notify("변경 사항을 저장했어요.");
        })
        .catch((e) => notify(errorText(e)));
      return;
    }
    if (preview) setDraft(next);
    else updatePlans(plans.map((p) => (p.id === next.id ? next : p)));
    setMode("view");
    notify("변경 사항을 저장했어요.");
  }
  function refine() {
    if (!result) return;
    setRefining(true);
    if (!preview && result.resultId) {
      api
        .regenerate(result.resultId, request.trim())
        .then((r) => {
          setServerResult(toPlan(r));
          setMode("view");
          setRequest("");
          notify(r.notice || "AI가 실행안을 보완했어요.");
        })
        .catch((e) => notify(errorText(e)))
        .finally(() => setRefining(false));
      return;
    }
    timer.current = setTimeout(() => {
      const text = request.trim()
        ? `요청: ${request.trim()}\n1주차 목표와 준비 항목 정리 → 2주차 시제품 테스트 → 3주차 피드백 수집과 개선`
        : "1주차 재료 비율 테스트 → 2주차 굽는 시간 조정 → 3주차 시식 피드백 반영";
      const next = { ...result, refined: text };
      if (preview) setDraft(next);
      else updatePlans(plans.map((p) => (p.id === result.id ? next : p)));
      setMode("view");
      setRefining(false);
      notify("실행안을 보완했어요. 바뀐 부분은 초록색으로 표시돼요. (예시)");
    }, 1200);
  }
  const viewHistory = () => {
    if (!user) {
      setReturnAfterLogin(true);
      setOverlay("login");
    } else setOverlay("history");
  };
  useEffect(() => {
    if (preview || overlay !== "history") return;
    setHistoryItems(null);
    const t = setTimeout(() => {
      api
        .history(search.trim(), filter === "전체" ? null : catIds[filter] ?? null)
        .then((h) => setHistoryItems(h.items))
        .catch((e) => {
          setHistoryItems([]);
          notify(errorText(e));
        });
    }, 250);
    return () => clearTimeout(t);
  }, [overlay, search, filter]);
  const historyResults = plans.filter(
    (p) =>
      (filter === "전체" || p.category === filter) &&
      [p.title, ...p.words]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const closeOverlay = () => {
    if (timer.current && overlay === "loading") clearTimeout(timer.current);
    setOverlay(null);
  };
  const shownUser = preview === "21" ? "이팀원" : user;
  return (
    <div className={`app page-${page}`}>
      <header className="header">
        <a href="#/" className="brand" aria-label="TreePlan 처음 화면">
          <Logo />
          <span className="tagline">단어 세 개에서 시작하는 AI 발상 도구</span>
        </a>
        <nav className="header-actions" aria-label="주 메뉴">
          {user && (
            <>
              <span className="desktop-only user-name">{shownUser}</span>
              <Button
                variant="ghost"
                className="desktop-only"
                onClick={() => {
                  api.logout();
                  setUser(null);
                  updateSession(initialSession());
                  go("/");
                  notify("로그아웃했어요.");
                }}
              >
                로그아웃
              </Button>
            </>
          )}
          <Button
            variant={user ? "secondary" : "ghost"}
            className={`history-button ${page === "home" ? "home-history" : ""}`}
            onClick={viewHistory}
            aria-label="히스토리"
          >
            <Icon name="history" />
            <span>히스토리</span>
          </Button>
          {!user &&
            (page === "home" || !["session", "result"].includes(page)) && (
              <Button onClick={() => setOverlay("login")}>로그인</Button>
            )}
          {["session", "result"].includes(page) && (
            <button
              className="icon-button mobile-only more"
              aria-label="더 보기 메뉴"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              ⋯
            </button>
          )}
        </nav>
        {menu && (
          <div className="more-menu">
            <strong>{shownUser || "게스트"}</strong>
            <p>{user ? "로그인됨" : "로그인 없이 사용 중"}</p>
            <button
              onClick={() => {
                if (user) {
                  api.logout();
                  setUser(null);
                  updateSession(initialSession());
                  go("/");
                } else setOverlay("login");
                setMenu(false);
              }}
            >
              {user ? "로그아웃" : "로그인"}
            </button>
            <a href="#/screens">전체 화면 보기</a>
            <a href="#/">처음 화면</a>
          </div>
        )}
      </header>
      {page === "home" && (
        <main className="home">
          <section className="intro">
            <h1>
              막힌 생각에,
              <br />
              낯선 단어 세 개를
              <br />
              더해보세요.
            </h1>
            <p>
              음식 개발 · 프로그램 개발 · 공모전 기획 중 하나를 고르면,
              <br className="desktop-only" /> 무작위 단어 3개를 AI가 아이디어와
              실행안으로 연결해 드려요.
            </p>
          </section>
          <section className="start-panel" aria-label="시작하기">
            <div className="start-description">
              <h2>혼자 시작하기</h2>
              <p>
                {user
                  ? "새 세션을 만들고 팀원을 초대할 수 있어요."
                  : "로그인 없이 바로 시작할 수 있어요."}
              </p>
            </div>
            <Button
              variant="primary"
              className="large full"
              onClick={newSession}
            >
              새로 시작하기
            </Button>
            <hr className="desktop-only" />
            <div className="start-description">
              <h2>팀 코드로 함께 시작하기</h2>
              <p>팀원에게 받은 6자리 코드를 입력하세요.</p>
            </div>
            <form className="code-form" onSubmit={join}>
              <label className="sr-only" htmlFor="team-code">
                팀 코드 6자리
              </label>
              <input
                id="team-code"
                className="mono"
                value={code}
                placeholder={
                  matchMedia("(max-width:767px)").matches
                    ? "팀 코드 6자리"
                    : "예: K7M2QX"
                }
                maxLength={6}
                onChange={(e) => {
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  );
                  setCodeError("");
                }}
                aria-invalid={!!codeError}
                aria-describedby={codeError ? "code-error" : undefined}
              />
              <Button type="submit">입장하기</Button>
            </form>
            {codeError && (
              <p role="alert" id="code-error" className="field-error">
                {codeError}
              </p>
            )}
            <p className="start-footer">
              {user ? (
                `${user}님의 아이디어는 히스토리에 자동으로 저장돼요.`
              ) : (
                <>
                  히스토리를 남기려면{" "}
                  <button
                    className="text-link"
                    onClick={() => setOverlay("login")}
                  >
                    로그인
                  </button>
                </>
              )}
            </p>
          </section>
          <section className="journey" aria-label="이용 순서">
            {[
              ["분야 고르기", "음식 · 프로그램 · 공모전 중 하나"],
              ["단어 3개 고정", "가지를 뻗고 마음에 드는 단어를 고정"],
              ["생성", "아이디어 → 분야별 실행안"],
            ].map(([title, sub], i) => (
              <div key={title} className="journey-step">
                <span className="number">0{i + 1}</span>
                <div className="journey-tick">
                  <img src="/assets/af4a6.svg" alt="" />
                </div>
                <div>
                  <strong>{title}</strong>
                  <p>{sub}</p>
                </div>
              </div>
            ))}
            <img className="journey-end" src="/assets/50f38.svg" alt="" />
          </section>
        </main>
      )}
      {page === "session" && (
        <main className="session">
          <div className="session-bar">
            <h1>
              <span className="desktop-only">
                생성 일자 {dateLabel(session.created)}
              </span>
              <span className="mobile-only">
                생성 일자 {dateLabel(session.created, true)}
              </span>
            </h1>
            <div className="session-meta">
              <button
                className="team-code"
                onClick={() => {
                  if (session.code) copy(session.code, "팀 코드를 복사했어요.");
                  else {
                    setSaveMessage("팀 코드로 함께 작업하려면 로그인해 주세요. 로그인하면 지금 세션의 팀 코드가 생겨요.");
                    setOverlay("save");
                  }
                }}
              >
                <span className="desktop-only muted">팀 코드</span>
                <span className="mono">{session.code || "로그인 필요"}</span>
                <Icon name="copy" />
              </button>
              <button
                className="members-button"
                aria-expanded={overlay === "members"}
                onClick={() => setOverlay("members")}
              >
                <Icon name="users" />
                <span className="desktop-only">
                  {session.members
                    ? session.members.map((m) => `${m.name}${m.role === "OWNER" ? " (방장)" : ""}`).join(" · ")
                    : `김방장 (방장)${session.team ? " · 이팀원" : ""}`}
                </span>
                <span className="mobile-only">{session.members ? session.members.length : session.team ? 2 : 1}</span>
                <Icon name="down" />
              </button>
            </div>
          </div>
          <div className="category-band">
            <Numbered n="01">어떤 아이디어를 만들까요?</Numbered>
            <div className="category-options">
              {categories.map((c) => (
                <Button
                  key={c}
                  variant={session.category === c ? "dark" : "secondary"}
                  aria-pressed={session.category === c}
                  onClick={() => changeCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <p className="category-help">
              {session.category
                ? "단어를 누르면 가지가 뻗어요. 마음에 드는 단어 3개에 '고정'을 눌러 주세요."
                : "분야를 고르면 아래 캔버스에 단어 트리가 펼쳐져요."}
            </p>
          </div>
          {preview ? (
            <TreeCanvasPreview
              previewLoading={preview === "08"}
              session={session}
              update={updateSession}
              notify={notify}
            />
          ) : (
            <TreeCanvas session={session} update={updateSession} notify={notify} />
          )}
          <section className="combo-dock" aria-label="이번 조합">
            <div className="sheet-handle" />
            <div className="combo-head">
              <Numbered n="03">이번 조합</Numbered>
              <span className="mono muted">
                {session.words.length} / 3 고정
              </span>
            </div>
            <div className="combo-slots">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`combo-slot ${session.words[i] ? "filled" : ""}`}
                  // 고정된 칸을 한 번 더 누르면 고정 해제
                  role={session.words[i] ? "button" : undefined}
                  tabIndex={session.words[i] ? 0 : undefined}
                  aria-label={session.words[i] ? `${session.words[i]} 고정 해제` : undefined}
                  style={session.words[i] ? { cursor: "pointer" } : undefined}
                  onClick={() => session.words[i] && unfix(i)}
                  onKeyDown={(e) => {
                    if (session.words[i] && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      unfix(i);
                    }
                  }}
                >
                  <div>
                    <span className="slot-number">{i + 1}</span>
                    <span>{session.words[i] || "비어 있음"}</span>
                    {session.words[i] && (
                      <button
                        aria-label={`${session.words[i]} 고정 해제`}
                        onClick={(e) => {
                          e.stopPropagation();
                          unfix(i);
                        }}
                      >
                        <Icon name="close" />
                      </button>
                    )}
                  </div>
                  <p>
                    {session.words[i]
                      ? "고정됨 · 눌러서 해제"
                      : "트리에서 단어를 고정하세요"}
                  </p>
                </div>
              ))}
            </div>
            <div className="combo-actions">
              <div>
                <Button
                  className="large"
                  disabled={!session.category}
                  onClick={() => {
                    if (!preview) {
                      setOverlay("reset");
                      return;
                    }
                    updateSession({
                      ...session,
                      words: [],
                      expanded: false,
                      reroll: session.reroll + 1,
                    });
                    notify("새로운 단어를 뽑았어요.");
                  }}
                >
                  <Icon name="shuffle" />
                  {preview ? "다시 뽑기" : "트리 초기화"}
                </Button>
                <Button
                  variant="primary"
                  className="large generate"
                  disabled={session.words.length !== 3}
                  onClick={generate}
                >
                  생성
                </Button>
              </div>
              <p>
                {session.words.length === 3
                  ? "이 조합으로 아이디어를 만들어 보세요"
                  : "단어 3개를 고정하면 생성할 수 있어요"}
              </p>
            </div>
          </section>
        </main>
      )}
      {page === "result" && result && (
        <main className={`result-page ${mode === "edit" ? "editing" : ""}`}>
          <article className="result-document">
            <div className="result-intro">
              <p className="eyebrow">{result.category} · AI 아이디어 초안</p>
              {mode === "edit" ? (
                <input
                  className="edit-title"
                  aria-label="결과물 제목"
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              ) : (
                <h1>
                  {result.title.includes("에 어울리는 ") ? (
                    <>
                      {result.title.split("에 어울리는 ")[0]}에 어울리는
                      <span className="result-title-break" />{" "}
                      {result.title.split("에 어울리는 ")[1]}
                    </>
                  ) : (
                    result.title
                  )}
                </h1>
              )}
              {mode === "edit" ? (
                <textarea
                  aria-label="결과물 소개"
                  value={edit.summary}
                  onChange={(e) =>
                    setEdit({ ...edit, summary: e.target.value })
                  }
                />
              ) : (
                <p className="result-summary">
                  <span className="desktop-only">{result.summary}</span>
                  <span className="mobile-only">
                    {
                      result.summary
                        .replace("[예시 모드] ", "")
                        .split(" 세 단어가")[0]
                    }
                  </span>
                </p>
              )}
              <div className="word-chips">
                <span className="desktop-only muted">사용한 단어</span>
                {result.words.map((w) => (
                  <span className="chip" key={w}>
                    {w}
                  </span>
                ))}
              </div>
              <p className="ai-note">
                AI가 만든 초안이에요. 사실 여부와 실현 가능성은 직접 확인해
                주세요.
              </p>
            </div>
            <hr className="strong-line" />
            <div className="result-sections">
              {result.sections.map((s, i) => (
                <section
                  className={`result-section ${i === 4 ? "reason" : ""} ${i === 2 && result.refined ? "refined" : ""}`}
                  key={s.title}
                >
                  <Numbered n={`0${i + 1}`}>
                    {s.title}
                    {i === 2 && result.refined && (
                      <span className="refined-tag">보완됨</span>
                    )}
                  </Numbered>
                  {mode === "edit" ? (
                    <textarea
                      aria-label={s.title}
                      value={edit.sections[i].body}
                      rows={Math.max(
                        3,
                        edit.sections[i].body.split("\n").length + 1,
                      )}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          sections: edit.sections.map((s, n) =>
                            n === i ? { ...s, body: e.target.value } : s,
                          ),
                        })
                      }
                    />
                  ) : (
                    <div className="section-body">
                      {s.body.split("\n").map((line, n) => (
                        <p key={n}>{line}</p>
                      ))}
                      {i === 2 && result.refined && (
                        <p className="refinement">{result.refined}</p>
                      )}
                    </div>
                  )}
                </section>
              ))}
            </div>
            <div className="document-actions">
              {mode === "view" ? (
                <>
                  <div className="result-primary-actions">
                    <Button
                      onClick={() => {
                        updateSession({
                          ...session,
                          category: result.category,
                          categoryId: catIds[result.category],
                          words: [],
                          drawId: undefined,
                          drawWords: undefined,
                        });
                        go("/session");
                      }}
                    >
                      <Icon name="shuffle" />
                      <span className="desktop-only">
                        새 단어로 다시 만들기
                      </span>
                      <span className="mobile-only">다시 만들기</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEdit(structuredClone(result));
                        setMode("edit");
                      }}
                    >
                      <Icon name="edit" />
                      직접 수정
                    </Button>
                    <Button
                      variant="ghost"
                      className="refine-button"
                      onClick={() => setMode("refine")}
                    >
                      세부안 보완
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => copy(planText(result))}
                    >
                      <Icon name="copy" />
                      복사
                    </Button>
                  </div>
                  <div className="export-actions">
                    <span className="muted">내보내기</span>
                    {["PDF", "MD", "TXT"].map((f) => (
                      <button
                        key={f}
                        onClick={() => exportPlan(f)}
                        title={
                          f === "PDF"
                            ? "인쇄 창에서 PDF로 저장"
                            : `${f} 파일 다운로드`
                        }
                      >
                        {f}
                      </button>
                    ))}
                    {(preview || result.canDelete !== false) && (
                    <button
                      className="delete-button"
                      onClick={() => setOverlay("delete")}
                    >
                      <Icon name="delete" />
                      삭제
                    </button>
                    )}
                  </div>
                </>
              ) : mode === "edit" ? (
                <div className="edit-actions">
                  <p>직접 수정 중이에요. 저장해야 변경 사항이 반영돼요.</p>
                  <Button onClick={() => setMode("view")}>취소</Button>
                  <Button variant="primary" onClick={saveEdit}>
                    저장
                  </Button>
                </div>
              ) : (
                <div className="refine-form">
                  <label htmlFor="refine">어떤 부분을 보완할까요? (선택)</label>
                  <textarea
                    id="refine"
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder="실행 일정을 주 단위로 더 자세히 나눠 주세요"
                  />
                  <p>비워 두면 전체 실행안을 더 구체적으로 다듬어요.</p>
                  <div>
                    <Button onClick={() => setMode("view")} disabled={refining}>
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      onClick={refine}
                      disabled={refining}
                    >
                      {refining ? "보완 중…" : "보완 요청"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </article>
          <p className="result-meta">
            {result.author || shownUser || "게스트"} ·{" "}
            {new Date(result.created).toLocaleString("ko-KR")} ·{" "}
            {preview
              ? "이 브라우저에 저장된 예시"
              : result.saved
                ? "히스토리에 저장됨"
                : "저장되지 않음 · 로그인하면 히스토리에 남아요"}
          </p>
        </main>
      )}
      {page === "result" && !result && resultLoading && (
        <main className="error-page">
          <h1>결과물을 불러오고 있어요</h1>
        </main>
      )}
      {(page === "404" || page === "401" || (page === "result" && !result && !resultLoading)) && (
        <main className="error-page">
          <p className="error-code mono">{page === "401" ? "401" : "404"}</p>
          <h1>{page === "401" ? "로그인이 필요해요" : "없는 화면이에요"}</h1>
          <p>
            {page === "401" ? (
              <>
                세션과 결과물은 참여자만 볼 수 있어요.
                <br />
                로그인하면 이 화면으로 바로 돌아와요.
              </>
            ) : (
              "주소가 바뀌었거나 삭제된 화면이에요."
            )}
          </p>
          <div>
            {page === "401" && (
              <Button
                variant="primary"
                onClick={() => {
                  setReturnAfterLogin(true);
                  setOverlay("login");
                }}
              >
                로그인
              </Button>
            )}
            <Button onClick={() => go("/")}>처음 화면으로</Button>
          </div>
        </main>
      )}
      {page === "screens" && (
        <main className="screen-directory">
          <h1>TreePlan 화면 목록</h1>
          <p>
            같은 화면이 768px 미만에서 Figma의 M 화면 구성으로 전환됩니다. 아래
            미리보기 상태는 저장된 세션을 변경하지 않습니다.
          </p>
          <div className="demo-note">
            프론트엔드 데모 · 로그인, AI 생성, 팀 참여는 로컬 예시이며 서버에
            연결되지 않습니다.
          </div>
          <div className="screen-grid">
            {screenList.map(([id, title]) => (
              <a key={id} href={"#/preview/" + id}>
                <span className="mono">{id}</span>
                <strong>{title}</strong>
                <span>PC / M-{id} ↗</span>
              </a>
            ))}
          </div>
          <a className="text-link" href="#/responsive">
            반응형 규칙 · Breakpoints
          </a>
        </main>
      )}
      {page === "responsive" && <ResponsiveGuide />}
      {["login", "signup", "reset"].includes(overlay || "") && (
        <AuthModal
          type={overlay as "login" | "signup" | "reset"}
          onClose={closeOverlay}
          onType={setOverlay}
          onSuccess={(name) => {
            setUser(name);
            if (preview) writeLocal("user", name);
            if (returnAfterLogin) {
              if (page === "401") go("/session");
              setOverlay("history");
              setReturnAfterLogin(false);
            } else setOverlay(null);
            if (!preview && session.sessionId) refreshSession(session.sessionId).catch(() => {});
            notify(`${name}님, 로그인했어요. 지금까지 만든 결과도 히스토리에 저장됐어요.`);
          }}
          notify={notify}
        />
      )}
      {(overlay === "loading" || overlay === "idea") && (
        <Modal label="아이디어" onClose={closeOverlay} className="idea-modal">
          <Close onClick={closeOverlay} />
          <p className="eyebrow">
            {session.category || draft.category} · AI 아이디어 초안
          </p>
          <div className="word-chips">
            <span className="desktop-only muted">이번 조합</span>
            {(idea && !preview ? idea.words : draft.words).map((w) => (
              <span className="chip" key={w}>
                {w}
              </span>
            ))}
          </div>
          {overlay === "loading" ? (
            <div className="idea-loading">
              <img className="spinner" src="/assets/b5da8.svg" alt="" />
              <h2>아이디어를 만들고 있어요</h2>
              <p>세 단어의 연결점을 찾는 중이에요.</p>
              <p className="muted">
                {preview ? "예시 아이디어를 준비하고 있어요." : "AI 응답에 길게는 1분 가까이 걸릴 수 있어요."}
              </p>
            </div>
          ) : idea && !preview ? (
            idea.status === "SUCCESS" ? (
              <>
                <h1>{idea.title}</h1>
                <p className="idea-description">{idea.summary}</p>
                <p className="muted caption">
                  AI가 만든 초안이에요. 사실 여부와 실현 가능성은 직접 확인해 주세요.
                  {idea.aiMode === "mock" && " (예시 모드: AI 키가 없어 예시로 만든 결과)"}
                </p>
                <div className="idea-actions">
                  <Button onClick={generate} disabled={working}>
                    다시 생성
                  </Button>
                  <Button variant="primary" onClick={createResult} disabled={working}>
                    {working ? "실행안 만드는 중…" : "이 아이디어로 실행안 만들기"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h1>아이디어를 만들지 못했어요</h1>
                <p className="idea-description">{idea.failure || "잠시 후 다시 시도해 주세요."}</p>
                <div className="idea-actions">
                  <Button onClick={closeOverlay}>단어 다시 고르기</Button>
                  <Button variant="primary" onClick={generate}>
                    같은 조합으로 다시 시도
                  </Button>
                </div>
              </>
            )
          ) : (
            <>
              <h1>{draft.title}</h1>
              <p className="idea-description">
                {draft.category === "음식 개발"
                  ? `${draft.words[0]} 페이스트를 ${draft.words[1]} 반죽으로 감싸 구운 ${draft.words[2]} 위에 올린 한입 디저트. 단맛, 고소함, 쌉싸름함이 차례로 느껴지도록 층을 나눠요.`
                  : draft.summary}
              </p>
              <div className="idea-reason">
                <strong>조합 이유</strong>
                <p>{draft.sections[4].body}</p>
              </div>
              <p className="muted caption">
                AI 생성 연결 전의 예시 초안이에요. 사실 여부와 실현 가능성은
                직접 확인해 주세요.
              </p>
              <div className="idea-actions">
                <Button onClick={generate}>다시 생성</Button>
                <Button variant="primary" onClick={createResult}>
                  이 아이디어로 실행안 만들기
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
      {overlay === "history" && (
        <Modal
          label="히스토리"
          onClose={closeOverlay}
          className="history-modal"
        >
          <div className="drawer-title">
            <h1>
              히스토리 <span>{preview ? plans.length : historyItems?.length ?? ""}</span>
            </h1>
            <Close onClick={closeOverlay} />
          </div>
          <label className="history-search">
            <Icon name="search" />
            <input
              aria-label="히스토리 검색"
              placeholder="제목이나 단어로 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="history-filters">
            {["전체", ...categories].map((c) => (
              <button
                className={filter === c ? "selected" : ""}
                aria-pressed={filter === c}
                key={c}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {!preview ? (
            <div className="history-list">
              {historyItems === null ? (
                <div className="history-empty">불러오는 중…</div>
              ) : historyItems.length === 0 ? (
                <div className="history-empty">
                  {search || filter !== "전체" ? "검색 결과가 없어요." : "아직 저장된 아이디어가 없어요."}
                </div>
              ) : (
                historyItems.map((h) => (
                  <button
                    key={h.type + h.id}
                    className="history-item"
                    onClick={() => {
                      if (!h.resultId) {
                        notify("보관한 아이디어예요. 실행안을 만들면 결과물로 열 수 있어요.");
                        return;
                      }
                      setOverlay(null);
                      go("/result/" + h.resultId);
                    }}
                  >
                    <strong>{h.title}</strong>
                    <span>
                      {h.categoryName} · {h.teamSession ? "팀" : "개인"} · {h.type === "IDEA" ? "보관 아이디어 · " : ""}
                      {dateLabel(h.at)}
                    </span>
                    <span className="history-words">{h.words.join(" · ")}</span>
                  </button>
                ))
              )}
            </div>
          ) : (
          <div className="history-list">
            {historyResults.length === 0 ? (
              <div className="history-empty">검색 결과가 없어요.</div>
            ) : (
              historyResults.map((p, i) => {
                const group =
                  dateLabel(p.created, true) ===
                  dateLabel(new Date().toISOString(), true)
                    ? "오늘"
                    : new Date(p.created).getTime() > Date.now() - 2 * 86400000
                      ? "어제"
                      : "지난주";
                const previous = historyResults[i - 1];
                const prevGroup = previous
                  ? dateLabel(previous.created, true) ===
                    dateLabel(new Date().toISOString(), true)
                    ? "오늘"
                    : new Date(previous.created).getTime() >
                        Date.now() - 2 * 86400000
                      ? "어제"
                      : "지난주"
                  : "";
                return (
                  <div key={p.id}>
                    {group !== prevGroup && (
                      <h2 className="history-group">{group}</h2>
                    )}
                    <button
                      className="history-item"
                      onClick={() => {
                        setOverlay(null);
                        go("/result/" + p.id);
                      }}
                    >
                      <strong>{p.title}</strong>
                      <span>
                        {p.category} ·{" "}
                        {p.id.startsWith("sample") ? "예시" : "개인"} ·{" "}
                        {dateLabel(p.created)}
                      </span>
                      <span className="history-words">
                        {p.words.join(" · ")}
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
          )}
          <p className="drawer-footer">
            {preview ? "이 브라우저에 저장된 히스토리예요." : "로그인한 계정에 저장된 히스토리예요."}
          </p>
        </Modal>
      )}
      {overlay === "members" && (
        <Modal label="참여자" onClose={closeOverlay} className="members-modal">
          <Close onClick={closeOverlay} />
          <h2>
            참여자{" "}
            <span className="muted caption">
              {session.members ? session.members.length : session.team ? 2 : 1}명
            </span>
          </h2>
          {session.members && !preview && (
            <>
              {session.members.map((m) => (
                <div className="member-row" key={m.name + m.joinedAt}>
                  <span className="avatar">{m.name.slice(0, 1)}</span>
                  <div>
                    <strong>
                      {m.name} {m.me && "(나)"}
                    </strong>
                    <p>{dateLabel(m.joinedAt)} {m.role === "OWNER" ? "생성" : "입장"}</p>
                  </div>
                  <span className={`role-tag ${m.role === "OWNER" ? "" : "guest"}`}>
                    {m.role === "OWNER" ? "방장" : "팀원"}
                  </span>
                </div>
              ))}
              <div className="invite-row">
                <div>
                  <p>{session.code ? "팀 코드로 팀원을 초대해요" : "로그인하면 팀 코드로 팀원을 초대할 수 있어요"}</p>
                  <span className="mono">{session.code || "------"}</span>
                </div>
                {session.code ? (
                  <Button onClick={() => copy(session.code, "팀 코드를 복사했어요.")}>
                    <Icon name="copy" />
                    코드 복사
                  </Button>
                ) : (
                  <Button onClick={() => setOverlay("login")}>로그인</Button>
                )}
              </div>
            </>
          )}
          {(preview || !session.members) && (
          <>
          <div className="member-row">
            <span className="avatar">김</span>
            <div>
              <strong>김방장 {preview !== "21" && "(나)"}</strong>
              <p>{dateLabel(session.created).split(" ")[1]} 생성</p>
            </div>
            <span className="role-tag">방장</span>
          </div>
          {session.team && (
            <div className="member-row">
              <span className="avatar">이</span>
              <div>
                <strong>이팀원 {preview === "21" && "(나)"}</strong>
                <p>14:32 입장</p>
              </div>
              <span className="role-tag guest">팀원</span>
            </div>
          )}
          <div className="invite-row">
            <div>
              <p>팀 코드로 팀원을 초대해요</p>
              <span className="mono">{session.code}</span>
            </div>
            <Button onClick={() => copy(session.code, "팀 코드를 복사했어요.")}>
              <Icon name="copy" />
              코드 복사
            </Button>
          </div>
          <p className="demo-note small">
            팀 참여는 데모이며 실시간으로 연결되지 않아요.
          </p>
          {!session.team && (
            <button
              className="text-link"
              onClick={() => {
                updateSession({ ...session, team: true });
                setOverlay(null);
                notify("이팀원님이 입장했어요. (참여 알림 데모)");
              }}
            >
              팀원 입장 데모 보기
            </button>
          )}
          </>
          )}
        </Modal>
      )}
      {overlay === "delete" && result && (
        <Modal
          label="결과물 삭제 확인"
          onClose={closeOverlay}
          className="confirm-modal"
        >
          <h2>이 결과물을 삭제할까요?</h2>
          <p>
            이 브라우저의 히스토리에서 사라지며
            <br />
            되돌릴 수 없어요.
          </p>
          <div>
            <Button onClick={closeOverlay}>취소</Button>
            <Button
              variant="dark"
              onClick={async () => {
                if (!preview && result.resultId) {
                  try {
                    await api.deleteResult(result.resultId);
                  } catch (e) {
                    notify(errorText(e));
                    return;
                  }
                } else updatePlans(plans.filter((p) => p.id !== result.id));
                setOverlay(null);
                go("/session");
                notify("결과물을 삭제했어요.");
              }}
            >
              삭제
            </Button>
          </div>
        </Modal>
      )}
      {overlay === "reset" && (
        <Modal label="트리 초기화 확인" onClose={closeOverlay} className="confirm-modal">
          <h2>트리를 초기화할까요?</h2>
          <p>
            {session.category}에서 뻗은 단어와 고정한 단어가 모두 지워지고,
            <br />
            처음처럼 새 단어를 다시 뻗어요.{session.team ? " 팀원의 트리도 함께 초기화돼요." : ""}
          </p>
          <div>
            <Button onClick={closeOverlay}>취소</Button>
            <Button variant="dark" onClick={resetTree}>
              초기화
            </Button>
          </div>
        </Modal>
      )}
      {overlay === "save" && (
        <Modal label="로그인 안내" onClose={closeOverlay} className="confirm-modal">
          <h2>로그인하고 저장할까요?</h2>
          <p>{saveMessage}</p>
          <div>
            <Button onClick={closeOverlay}>나중에</Button>
            <Button variant="dark" onClick={() => setOverlay("login")}>
              로그인
            </Button>
            <Button variant="primary" onClick={() => setOverlay("signup")}>
              회원가입
            </Button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function AuthModal({
  type,
  onClose,
  onType,
  onSuccess,
  notify,
}: {
  type: "login" | "signup" | "reset";
  onClose: () => void;
  onType: (o: Overlay) => void;
  onSuccess: (name: string) => void;
  notify: (s: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("이메일 주소를 확인해 주세요.");
      return;
    }
    if (type === "reset") {
      try {
        await api.passwordReset(email);
        setSent(true);
        notify("비밀번호 재설정 요청을 접수했어요.");
      } catch (err) {
        setError(errorText(err));
      }
      return;
    }
    if (password.length < 8) {
      setError("비밀번호를 8자 이상 입력해 주세요.");
      return;
    }
    if (type === "signup" && !name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    setPending(true);
    try {
      if (type === "signup") await api.signup(email, password, name.trim());
      else await api.login(email, password);
      onSuccess(api.signedInName() || name.trim());
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }
  const title =
    type === "login"
      ? "다시 만나서 반가워요"
      : type === "signup"
        ? "treeplan 시작하기"
        : "비밀번호 찾기";
  return (
    <Modal label={title} onClose={onClose} className="auth-modal">
      <Close onClick={onClose} />
      <img className="auth-mark" src="/assets/bda8c.svg" alt="" />
      <h1>{title}</h1>
      <p className="auth-description">
        {type === "reset"
          ? "가입한 이메일로 비밀번호 재설정 안내를 보내 드려요."
          : "로그인하면 만든 아이디어를 히스토리에 저장하고 팀 코드로 함께 작업할 수 있어요."}
      </p>
      <form onSubmit={submit} noValidate>
        <label>
          이메일
          <input
            autoComplete="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {type === "signup" && (
          <label>
            이름
            <input
              autoComplete="nickname"
              placeholder="김방장"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              required
            />
          </label>
        )}
        {type !== "reset" && (
          <label>
            비밀번호
            <span className="password-field">
              <input
                autoComplete={
                  type === "signup" ? "new-password" : "current-password"
                }
                type={show ? "text" : "password"}
                placeholder="8자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShow(!show)}>
                {show ? "숨김" : "표시"}
              </button>
            </span>
          </label>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {sent && (
          <p className="success-note" role="status">
            재설정 안내 요청을 접수했어요.
            <br />
            지금은 메일 발송 기능이 없어 실제 메일은 가지 않아요.
          </p>
        )}
        <Button variant="primary" className="large full" type="submit" disabled={pending}>
          {type === "login"
            ? "이메일로 계속하기"
            : type === "signup"
              ? "가입하고 계속하기"
              : "재설정 안내 받기"}
        </Button>
      </form>
      <div className="auth-links">
        {type !== "login" && (
          <button
            onClick={() => {
              onType("login");
              setError("");
            }}
          >
            로그인으로
          </button>
        )}
        {type !== "signup" && (
          <button
            onClick={() => {
              onType("signup");
              setError("");
            }}
          >
            회원가입
          </button>
        )}
        {type !== "reset" && (
          <button
            onClick={() => {
              onType("reset");
              setError("");
            }}
          >
            비밀번호 찾기
          </button>
        )}
      </div>
      <p className="auth-demo">
        로그인하면 지금까지 로그인 없이 만든 결과도 내 히스토리로 옮겨져요.
      </p>
    </Modal>
  );
}
function ResponsiveGuide() {
  const rows = [
    ["구간", "≥ 768px (시안 1440)", "≤ 767px (시안 390)"],
    [
      "헤더",
      "로고 · 태그라인 · 이름 · 로그아웃 · 히스토리",
      "로고 + 히스토리 아이콘 + ⋯ 메뉴",
    ],
    [
      "세션 바",
      "제목 · 팀 코드 · 참여자",
      "짧은 제목 · 참여자 수 · 팀 코드(복사)",
    ],
    [
      "분야 선택",
      "상단 띠 한 줄: 제목 + 버튼 3개 + 안내",
      "제목 줄 + 버튼 줄 2단",
    ],
    ["단어 트리", "100%, 루트 중앙 정렬", "62%, 핀치 확대 · 드래그 이동"],
    ["캔버스 도구", "우상단 가로 막대", "우하단 세로 막대"],
    ["이번 조합", "하단 바 한 줄", "바텀 시트: 단어 칩 3 + 다시 뽑기 · 생성"],
    ["아이디어 팝업", "가운데 모달 600", "바텀 시트, 주요 버튼 전체 폭"],
    [
      "확인 창 · 알림",
      "가운데 확인 창, 알림은 조합 바 위",
      "가운데 확인 창(342), 알림은 시트 위",
    ],
    ["로그인 · 가입", "가운데 모달 440", "바텀 시트(전체 폭)"],
    ["히스토리", "오른쪽 드로어 400", "오른쪽에서 들어오는 전체 화면"],
    ["결과물", "문서 콘텐츠 폭 760 가운데", "한 열 + 하단 고정 동작 바"],
  ];
  return (
    <main className="responsive-guide">
      <h1>반응형 규칙</h1>
      <p>
        웹과 모바일 모두 같은 단계(시작 → 분야 → 트리 → 조합 → 생성 → 실행안)를
        밟고, 모바일은 보조 정보를 메뉴와 바텀 시트로 접어요.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th />
              <th>Web</th>
              <th>Mobile</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                {r.map((c, i) =>
                  i === 0 ? <th key={i}>{c}</th> : <td key={i}>{c}</td>,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a href="#/screens" className="text-link">
        전체 화면 목록
      </a>
    </main>
  );
}
