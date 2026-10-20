import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import * as api from "./api";
import type { WordDto, WordTree } from "./api";
import type { Session } from "./data";
import { Icon, Numbered } from "./ui";

// 서버의 단어 트리(뿌리 3개 + 세션에서 AI가 뻗은 단어)를 받아 위치를 계산해 그린다.
// 단어 길이와 가지 수에 맞춰 각 가지가 차지하는 폭을 계산하므로 노드가 서로 겹치지 않는다.

const GAP = 18; // 옆 가지 사이 간격
const PAD = 40; // 트리 바깥 여백
const ROW = { root: 0, branch: 92, firstWord: 262, step: 116 };
const BOTTOM = { root: 46, branch: 116, word: 64 }; // 노드 위쪽에서 선이 나가는 아래쪽까지 (가지는 '+ 뻗기' 버튼 포함)
const MAX_EXPANDS = 20; // 하위 카테고리마다 가지 뻗기 최대 횟수
const WORDS_PER_EXPAND = 3; // 한 번 뻗을 때 AI가 만드는 단어 수

type LNode = {
  id: number;
  text: string;
  kind: "root" | "branch" | "word";
  w: number;
  span: number;
  x: number;
  y: number;
  children: LNode[];
  group?: { no: number; expandCount: number; remaining: number };
};

/** 화면 글꼴 기준 대략적인 글자 폭 (한글 14px, 영문·숫자·공백 더 좁게) */
function textWidth(s: string, size = 14) {
  let w = 0;
  for (const ch of s) w += /[ᄀ-ᇿ㄰-㆏가-힯]/.test(ch) ? size : /[A-Z]/.test(ch) ? size * 0.68 : size * 0.55;
  return w;
}

function wordNode(d: WordDto): LNode {
  return { id: d.id, text: d.text, kind: "word", w: Math.max(textWidth(d.text) + 34, 56), span: 0, x: 0, y: 0, children: d.children.map(wordNode) };
}

function measure(n: LNode): number {
  const kids = n.children.reduce((s, c) => s + measure(c), 0) + GAP * Math.max(0, n.children.length - 1);
  n.span = Math.max(n.w, kids);
  return n.span;
}

/** left부터 n의 가지 폭 안에 자식들을 배치하고, n은 자식들 가운데에 둔다 */
function place(n: LNode, left: number, y: number, depth: number) {
  n.y = y;
  if (!n.children.length) {
    n.x = left + n.span / 2;
    return;
  }
  const kids = n.children.reduce((s, c) => s + c.span, 0) + GAP * (n.children.length - 1);
  let cursor = left + (n.span - kids) / 2;
  const nextY = n.kind === "root" ? ROW.branch : n.kind === "branch" ? ROW.firstWord : y + ROW.step;
  for (const c of n.children) {
    place(c, cursor, nextY, depth + 1);
    cursor += c.span + GAP;
  }
  n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
}

function flatten(n: LNode, out: LNode[] = []) {
  out.push(n);
  n.children.forEach((c) => flatten(c, out));
  return out;
}

export default function TreeCanvas({
  session,
  update,
  notify,
}: {
  session: Session;
  update: (s: Session) => void;
  notify: (s: string) => void;
}) {
  const mobile = () => matchMedia("(max-width:767px)").matches;
  const [small, setSmall] = useState(mobile);
  const [zoom, setZoom] = useState(mobile() ? 0.62 : 1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"hand" | "pointer">("hand");
  const [tree, setTree] = useState<WordTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [space, setSpace] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ x: 0, y: 0, px: 0, py: 0, distance: 0, zoom: 1 });
  const { sessionId, categoryId } = session;

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

  // 분야가 바뀌면 트리를 불러오고, 아직 단어가 없으면 뿌리 3개에서 한 번씩 자동으로 뻗는다.
  useEffect(() => {
    setTree(null);
    setPan({ x: 0, y: 0 });
    setLoadError("");
    if (!sessionId || !session.category) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        // 카테고리 번호를 아직 모르면(처음 목록을 못 받았을 때 등) 서버에 물어 채운다
        if (!categoryId) {
          const found = (await api.categories()).find((c) => c.name === session.category);
          if (!alive) return;
          if (!found) throw new api.ApiError(404, "CATEGORY_NOT_FOUND", "분야를 찾지 못했어요. 다시 선택해 주세요.");
          update({ ...session, categoryId: found.id });
          return; // categoryId가 바뀌면 이 효과가 다시 실행되어 트리를 불러온다
        }
        let t = await api.wordTree(categoryId, sessionId);
        if (!alive) return;
        setTree(t);
        if (t.wordCount === 0) {
          setBusy(new Set(t.groups.map((g) => g.id)));
          const results = await Promise.allSettled(t.groups.map((g) => api.expand(g.id, sessionId, WORDS_PER_EXPAND)));
          const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
          if (failed) notify(messageOf(failed.reason));
          t = await api.wordTree(categoryId, sessionId);
          if (alive) setTree(t);
        }
      } catch (e) {
        if (alive) setLoadError(messageOf(e));
      } finally {
        if (alive) {
          setLoading(false);
          setBusy(new Set());
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, categoryId, session.category, reloadKey, session.reroll]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !/INPUT|TEXTAREA|BUTTON/.test((e.target as HTMLElement).tagName)) {
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
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) setZoom((z) => clamp(z - e.deltaY * 0.003));
      else setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const layout = useMemo(() => {
    if (!tree || !session.category) return null;
    const label = session.category.replace(" 개발", "").replace(" 기획", "");
    const root: LNode = {
      id: 0,
      text: label,
      kind: "root",
      w: textWidth(label, 18) + 52,
      span: 0,
      x: 0,
      y: 0,
      children: tree.groups.map((g, gi) => ({
        id: g.id,
        text: g.text,
        kind: "branch",
        w: Math.max(textWidth(g.text) + 24, 76),
        span: 0,
        x: 0,
        y: 0,
        children: g.children.map(wordNode),
        group: { no: gi + 1, expandCount: g.expandCount, remaining: g.remaining },
      })),
    };
    measure(root);
    place(root, PAD, ROW.root, 0);
    const nodes = flatten(root);
    const edges: { d: string; key: string }[] = [];
    for (const n of nodes) {
      for (const c of n.children) {
        const from = n.y + BOTTOM[n.kind];
        const mid = c.y - 18;
        edges.push({ key: `${n.id}-${c.id}`, d: `M${n.x} ${from} V${mid} H${c.x} V${c.y}` });
      }
    }
    const width = root.span + PAD * 2;
    const height = Math.max(...nodes.map((n) => n.y)) + 140;
    return { nodes, edges, width, height };
  }, [tree, session.category]);

  async function expand(nodeId: number, label: string) {
    if (!sessionId || !categoryId || busy.has(nodeId)) return;
    setBusy((b) => new Set(b).add(nodeId));
    try {
      await api.expand(nodeId, sessionId, WORDS_PER_EXPAND);
      setTree(await api.wordTree(categoryId, sessionId));
    } catch (e) {
      notify(messageOf(e, `'${label}'에서 가지를 뻗지 못했어요.`));
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(nodeId);
        return n;
      });
    }
  }

  const toggle = (word: string) => {
    if (session.words.includes(word)) update({ ...session, words: session.words.filter((w) => w !== word) });
    else if (session.words.length === 3) notify("단어는 3개까지 고정할 수 있어요. 기존 단어를 해제해 주세요.");
    else update({ ...session, words: [...session.words, word] });
  };

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
      distance: ps.length === 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0,
      zoom,
    };
  }
  function move(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    if (ps.length === 2) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      if (gesture.current.distance) setZoom(clamp((gesture.current.zoom * d) / gesture.current.distance));
    } else
      setPan({
        x: gesture.current.px + e.clientX - gesture.current.x,
        y: gesture.current.py + e.clientY - gesture.current.y,
      });
  }
  function up(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    const p = [...pointers.current.values()][0];
    if (p) gesture.current = { ...gesture.current, x: p.x, y: p.y, px: pan.x, py: pan.y };
  }
  // 휴대폰: 글씨를 읽을 수 있는 배율(최소 45%)을 지키면서 화면 폭에 최대한 맞추고, 트리를 가운데 둔다
  const reset = () => {
    if (!small || !layout || !area.current) {
      setZoom(small ? 0.62 : 1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const w = area.current.clientWidth;
    const z = clamp(Math.max(0.45, Math.min(0.62, (w - 40) / layout.width)));
    setZoom(z);
    // 모바일 트리는 왼쪽 20px에서 시작하므로, 가운데 오도록 그만큼 옮긴다
    setPan({ x: (w - layout.width * z) / 2 - 20, y: 0 });
  };
  // 분야를 고르거나 초기화한 뒤 처음 트리가 그려질 때 한 번 맞춘다 (뻗을 때마다 흔들리지 않게)
  const fittedFor = useRef("");
  useEffect(() => {
    if (!layout || loading) return;
    const key = `${categoryId}-${session.reroll}`;
    if (fittedFor.current === key) return;
    fittedFor.current = key;
    if (small) reset();
  }, [layout, loading, categoryId, session.reroll, small]);

  const treeStyle = layout
    ? {
        width: layout.width,
        height: layout.height,
        left: small ? 20 : `calc(50% - ${layout.width / 2}px)`,
        transformOrigin: small ? "0 0" : `${layout.width / 2}px 20px`,
        transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
      }
    : undefined;

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
              <span className="desktop-only muted">{session.category} · 하위 카테고리 3개</span>
              <span className="mobile-only muted mono">{Math.round(zoom * 100)}%</span>
            </>
          )}
        </div>
        {session.category && (
          <p className="legend desktop-only">
            <span className="mono">3 / {MAX_EXPANDS}</span> = 이 가지에서 뻗은 횟수 / 최대 {MAX_EXPANDS}회 (한 번에 단어 {WORDS_PER_EXPAND}개)
          </p>
        )}
      </div>
      <div className="canvas-toolbar" onPointerDown={(e) => e.stopPropagation()}>
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
        <button className="icon-button zoom-minus" aria-label="축소" onClick={() => setZoom((z) => clamp(z - 0.1))}>
          <Icon name="minus" />
        </button>
        <span className="desktop-only mono zoom-value">{Math.round(zoom * 100)}%</span>
        <button className="icon-button zoom-plus" aria-label="확대" onClick={() => setZoom((z) => clamp(z + 0.1))}>
          <Icon name="plus" />
        </button>
        <i className="desktop-only" />
        <button className="icon-button" aria-label="화면에 맞춤" onClick={reset}>
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
            분야마다 하위 카테고리 3개가 만들어지고,
            <br />가지마다 {MAX_EXPANDS}번까지, 한 번에 단어 {WORDS_PER_EXPAND}개씩 AI가 뻗어 줘요.
          </p>
        </div>
      ) : !layout ? (
        <div className="empty-tree">
          <h3>{loading ? "단어 트리를 불러오고 있어요" : "단어 트리를 불러오지 못했어요"}</h3>
          <p>{loading ? "잠시만 기다려 주세요." : loadError || "잠시 후 다시 시도해 주세요."}</p>
          {!loading && (
            <button className="fix-toggle" onClick={() => setReloadKey((k) => k + 1)}>
              다시 불러오기
            </button>
          )}
        </div>
      ) : (
        <div className="tree" style={treeStyle}>
          <svg className="dynamic-edge" width={layout.width} height={layout.height} aria-hidden="true">
            {layout.edges.map((e) => (
              <path key={e.key} d={e.d} fill="none" stroke="#000" strokeWidth="1" />
            ))}
          </svg>
          {layout.nodes.map((n) =>
            n.kind === "root" ? (
              <div key="root" className="tree-root" style={{ left: n.x, top: n.y, transform: "translateX(-50%)" }}>
                {n.text}
              </div>
            ) : n.kind === "branch" ? (
              <div key={n.id} className="branch-node" style={{ left: n.x, top: n.y, transform: "translateX(-50%)" }}>
                <span className="branch-number">{String(n.group!.no).padStart(2, "0")}</span>
                <strong>{n.text}</strong>
                <span className="mono">
                  {n.group!.expandCount} / {MAX_EXPANDS}회
                </span>
                <button
                  className="fix-toggle"
                  onClick={() => expand(n.id, n.text)}
                  disabled={busy.has(n.id) || n.group!.remaining === 0}
                  aria-label={`${n.text}에서 가지 뻗기`}
                >
                  {busy.has(n.id) ? "뻗는 중…" : n.group!.remaining === 0 ? `${MAX_EXPANDS}회 완료` : "+ 뻗기"}
                </button>
              </div>
            ) : (
              <div
                className={`word-node ${session.words.includes(n.text) ? "fixed" : ""}`}
                key={n.id}
                style={{ left: n.x, top: n.y, transform: "translateX(-50%)" }}
              >
                <button
                  className="word-pill"
                  onClick={() => expand(n.id, n.text)}
                  aria-label={`${n.text} 가지 뻗기`}
                  disabled={busy.has(n.id)}
                >
                  {busy.has(n.id) ? "뻗는 중…" : n.text}
                </button>
                <button
                  className="fix-toggle"
                  onClick={() => toggle(n.text)}
                  aria-label={`${n.text} ${session.words.includes(n.text) ? "고정 해제" : "고정"}`}
                  aria-pressed={session.words.includes(n.text)}
                >
                  {session.words.includes(n.text) ? "해제" : "고정"}
                </button>
              </div>
            ),
          )}
        </div>
      )}
      {loading && layout && busy.size > 0 && (
        <div className="branch-loading">
          <span>AI가 단어를 만드는 중</span>
        </div>
      )}
      <p className="canvas-hint desktop-only">Space + 드래그 또는 손바닥 도구로 이동 · Ctrl + 휠로 확대/축소</p>
    </div>
  );
}

function messageOf(e: unknown, fallback = "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.") {
  return e instanceof api.ApiError ? e.message : fallback;
}
