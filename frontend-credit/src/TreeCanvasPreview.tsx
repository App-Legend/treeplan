import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import layouts from "./tree-layouts.json";
import { branchNames, wordSets } from "./data";
import type { Session } from "./data";
import { Icon, Numbered } from "./ui";
type Extra = {
  word: string;
  x: number;
  y: number;
  px: number;
  py: number;
  branch: number;
};
export default function TreeCanvasPreview({
  session,
  update,
  notify,
  previewLoading = false,
}: {
  previewLoading?: boolean;
  session: Session;
  update: (s: Session) => void;
  notify: (s: string) => void;
}) {
  const mobile = () => matchMedia("(max-width:767px)").matches;
  const [small, setSmall] = useState(mobile);
  const [zoom, setZoom] = useState(mobile() ? 0.62 : 1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"hand" | "pointer">("hand");
  const [extras, setExtras] = useState<Extra[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [space, setSpace] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ x: 0, y: 0, px: 0, py: 0, distance: 0, zoom: 1 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const media = matchMedia("(max-width:767px)");
    const change = () => {
      setSmall(media.matches);
      setZoom(media.matches ? 0.62 : 1);
      setPan({ x: 0, y: 0 });
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(null);
    setExtras([]);
    setPan({ x: 0, y: 0 });
  }, [session.category, session.reroll]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !/INPUT|TEXTAREA|BUTTON/.test((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = () => setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  const clamp = (n: number) => Math.min(2, Math.max(0.3, n));
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clamp(z - e.deltaY * 0.003));
      } else {
        e.preventDefault();
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const fixedBranch =
    session.words.includes(currentWordsFor()[0]) &&
    session.words.includes(currentWordsFor()[9]) &&
    session.words.includes(currentWordsFor()[10]);
  function currentWordsFor() {
    return session.category
      ? wordSets[session.category][session.reroll % 2]
      : [];
  }
  const layout = session.expanded
    ? fixedBranch
      ? layouts.fixed
      : layouts.expanded
    : layouts.initial;
  const currentWords = session.category
    ? wordSets[session.category][session.reroll % 2]
    : [];
  const getWord = (word: string) => {
    const i = wordSets["음식 개발"][0].indexOf(word);
    return currentWords[i] || word;
  };
  const toggle = (word: string) => {
    if (session.words.includes(word))
      update({ ...session, words: session.words.filter((w) => w !== word) });
    else if (session.words.length === 3)
      notify("단어는 3개까지 고정할 수 있어요. 기존 단어를 해제해 주세요.");
    else update({ ...session, words: [...session.words, word] });
  };
  function expand(word: string, x: number, y: number, index: number) {
    if (busy) return;
    const branch =
      index >= 11
        ? extras[index - 11].branch
        : index < 3 || index > 8
          ? 0
          : index < 6
            ? 1
            : 2;
    if (extras.some((e) => e.px === x + 36 && e.py === y + 68)) {
      notify("이미 펼친 가지예요. 아래의 새 단어를 눌러 더 뻗어 보세요.");
      return;
    }
    const count =
      3 +
      (session.expanded && branch === 0 ? 2 : 0) +
      extras.filter((e) => e.branch === branch).length;
    if (count >= 20) {
      notify("이 가지는 최대 20개까지 뻗을 수 있어요.");
      return;
    }
    setBusy(word);
    timer.current = setTimeout(() => {
      setBusy(null);
      if (index === 0 && !session.expanded) {
        update({ ...session, expanded: true });
        return;
      }
      const pool =
        session.category === "음식 개발"
          ? [
              "밤",
              "연근",
              "크림",
              "단호박",
              "견과",
              "유자",
              "콩",
              "치즈",
              "꿀",
              "찹쌀",
              "감자",
              "배",
              "오트밀",
              "대추",
              "호두",
              "사과",
              "생강",
            ]
          : session.category === "프로그램 개발"
            ? [
                "기록",
                "통계",
                "일정",
                "피드백",
                "커뮤니티",
                "목표",
                "위치",
                "리마인더",
                "모임",
                "보드",
                "링크",
                "메모",
                "자동화",
                "검색",
                "동기화",
                "추천",
                "즐겨찾기",
              ]
            : [
                "캠페인",
                "워크숍",
                "지역사회",
                "순환",
                "공유",
                "체험",
                "학교",
                "연결",
                "창작",
                "소통",
                "축제",
                "기록",
                "문화",
                "활동",
                "참여",
                "공간",
                "기부",
              ];
      const used = [...currentWords, ...extras.map((e) => e.word)];
      const picks = pool
        .filter((w) => !used.includes(w))
        .slice(0, Math.min(2, 20 - count));
      if (!picks.length) {
        notify("이 가지에서 더 뻗을 단어가 없어요.");
        return;
      }
      setExtras((es) => [
        ...es,
        ...picks.map((w, i) => ({
          word: w,
          x: x + (i === 0 ? -36 : 62),
          y: Math.max(
            y + 126,
            ...es.filter((e) => e.branch === branch).map((e) => e.y + 96),
          ),
          px: x + 36,
          py: y + 68,
          branch,
        })),
      ]);
    }, 450);
  }
  function down(e: ReactPointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    if (tool !== "hand" && !space && !small) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      px: pan.x,
      py: pan.y,
      distance:
        ps.length === 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0,
      zoom,
    };
  }
  function move(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    if (ps.length === 2) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      if (gesture.current.distance)
        setZoom(clamp((gesture.current.zoom * d) / gesture.current.distance));
    } else
      setPan({
        x: gesture.current.px + e.clientX - gesture.current.x,
        y: gesture.current.py + e.clientY - gesture.current.y,
      });
  }
  function up(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    const p = [...pointers.current.values()][0];
    if (p)
      gesture.current = {
        ...gesture.current,
        x: p.x,
        y: p.y,
        px: pan.x,
        py: pan.y,
      };
  }
  const reset = () => {
    setZoom(small ? 0.62 : 1);
    setPan({ x: 0, y: 0 });
  };
  const layoutWords =
    layout === layouts.expanded
      ? [
          ...layout.words.slice(0, 4),
          { x: 425.5, y: 263, word: "발효", state: "Default" },
          ...layout.words.slice(4),
        ]
      : layout.words;
  const nodes = [
    ...layoutWords.map((w, i) => ({ ...w, word: getWord(w.word), index: i })),
    ...extras.map((w, i) => ({ ...w, index: 11 + i })),
  ];
  return (
    <div
      className={`canvas ${tool === "hand" || space ? "hand-mode" : ""}`}
      ref={area}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      aria-label="단어 트리 캔버스"
    >
      <div className="dot-grid" aria-hidden="true">
        <picture>
          <source media="(max-width:767px)" srcSet="/assets/021e2.svg" />
          <img src="/assets/6f452.svg" alt="" />
        </picture>
      </div>
      <div className="canvas-label">
        <div>
          <Numbered n="02">단어 트리</Numbered>
          {session.category && (
            <>
              <span className="desktop-only muted">
                {session.category} · 고정 가지 2 + 랜덤 가지 1
              </span>
              <span className="mobile-only muted mono">
                {Math.round(zoom * 100)}%
              </span>
            </>
          )}
        </div>
        {session.category && (
          <p className="legend desktop-only">
            <span className="mono">5 / 20</span> = 이 가지에서 뻗은 단어 수 /
            최대 20개
          </p>
        )}
      </div>
      <div
        className="canvas-toolbar"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className={`icon-button desktop-only ${tool === "pointer" ? "active" : ""}`}
          title="선택 도구"
          aria-label="선택 도구"
          onClick={() => setTool("pointer")}
        >
          <Icon name="pointer" />
        </button>
        <button
          className={`icon-button ${tool === "hand" ? "active" : ""}`}
          title="이동 도구"
          aria-label="이동 도구"
          aria-pressed={tool === "hand"}
          onClick={() => setTool("hand")}
        >
          <Icon name="hand" />
        </button>
        <i className="desktop-only" />
        <button
          className="icon-button zoom-minus"
          aria-label="축소"
          onClick={() => setZoom((z) => clamp(z - 0.1))}
        >
          <Icon name="minus" />
        </button>
        <span className="desktop-only mono zoom-value">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="icon-button zoom-plus"
          aria-label="확대"
          onClick={() => setZoom((z) => clamp(z + 0.1))}
        >
          <Icon name="plus" />
        </button>
        <i className="desktop-only" />
        <button
          className="icon-button"
          aria-label="화면에 맞춤"
          onClick={reset}
        >
          <Icon name="fit" />
        </button>
      </div>
      {!session.category ? (
        <div className="empty-tree">
          <span className="mark-box">
            <picture>
              <source media="(max-width:767px)" srcSet="/assets/25002.svg" />
              <img src="/assets/e9a2a.svg" alt="" />
            </picture>
          </span>
          <h3>위에서 분야를 먼저 골라 주세요</h3>
          <p>
            분야마다 가지 3개(고정 2 + 랜덤 1)가 만들어지고,
            <br />각 가지에서 단어를 최대 20개까지 뻗을 수 있어요.
          </p>
        </div>
      ) : (
        <div
          className={`tree ${session.expanded ? "expanded" : ""}`}
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          {layout.assets
            .filter(
              (a) =>
                a.node !== "15:1903" &&
                (a.src !== "3d397.svg" ||
                  previewLoading ||
                  busy === getWord("발효")),
            )
            .map((a, i) => (
              <img
                className="tree-art"
                key={i}
                src={"/assets/" + a.src}
                alt=""
                draggable="false"
                style={{ left: a.x, top: a.y }}
                data-figma-node={a.node}
              />
            ))}
          {(previewLoading || busy === getWord("발효")) && session.expanded && (
            <div className="branch-loading">
              <img src="/assets/02f59.svg" alt="" />
              <img src="/assets/004e7.svg" alt="" />
              <img src="/assets/299b7.svg" alt="" />
              <span>단어 만드는 중</span>
            </div>
          )}
          {extras.map((e, i) => (
            <svg
              className="dynamic-edge"
              key={i}
              width="1400"
              height="1600"
              aria-hidden="true"
            >
              <path
                d={`M${e.px} ${e.py} V${e.y - 18} H${e.x + 34} V${e.y}`}
                fill="none"
                stroke="#000"
                strokeWidth="1"
              />
            </svg>
          ))}
          <div
            className="tree-root"
            style={{ left: layout.root.x, top: layout.root.y }}
          >
            {session.category.replace(" 개발", "").replace(" 기획", "")}
          </div>
          {layout.branches.map((b, i) => (
            <div
              key={b.no}
              className="branch-node"
              style={{ left: b.x, top: b.y }}
            >
              <span className="branch-number">{b.no}</span>
              <strong>{branchNames[session.category!][i]}</strong>
              <span className="mono">
                {3 +
                  (session.expanded && i === 0 ? 2 : 0) +
                  extras.filter((e) => e.branch === i).length}{" "}
                / 20
              </span>
              {b.random && <span className="random-tag">랜덤</span>}
            </div>
          ))}
          {nodes.map((n) => (
            <div
              className={`word-node ${session.words.includes(n.word) ? "fixed" : ""}`}
              key={n.word}
              style={{ left: n.x, top: n.y }}
            >
              <button
                className="word-pill"
                onClick={() => expand(n.word, n.x, n.y, n.index)}
                aria-label={`${n.word} 가지 뻗기`}
                disabled={busy === n.word}
              >
                {busy === n.word ? "뻗는 중…" : n.word}
              </button>
              <button
                className="fix-toggle"
                onClick={() => toggle(n.word)}
                aria-label={`${n.word} ${session.words.includes(n.word) ? "고정 해제" : "고정"}`}
                aria-pressed={session.words.includes(n.word)}
              >
                {session.words.includes(n.word) ? "해제" : "고정"}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="canvas-hint desktop-only">
        Space + 드래그 또는 손바닥 도구로 이동 · Ctrl + 휠로 확대/축소
      </p>
    </div>
  );
}
