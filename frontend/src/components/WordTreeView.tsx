import { useState } from 'react';
import type { WordTree } from '../api/types';
import { useToast } from '../state/toast';

/** 한 트리에서 가지를 뻗을 수 있는 횟수 */
export const MAX_EXPANSIONS = 20;
/** 분류를 눌렀을 때 / 단어를 눌렀을 때 새로 뻗는 단어 수 */
const GROUP_BRANCH = 3;
const WORD_BRANCH = 2;

interface TreeNode {
  key: string;
  text: string;
  kind: 'root' | 'group' | 'word';
  /** 이 노드가 속한 분류. 새 가지는 같은 분류의 단어에서 뽑는다. */
  groupId: number | null;
}

interface Props {
  tree: WordTree;
  fixed: string[];
  onToggleFix: (word: string) => void;
  disabled?: boolean;
}

const ROOT_KEY = 'root';

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 단어 트리: 카테고리 → 분류 → 단어 → 단어 …
 * 노드를 누르면 그 아래로 새 단어가 뻗어 나가고, 단어의 '고정'을 누르면 조합에 담긴다.
 */
export default function WordTreeView({ tree, fixed, onToggleFix, disabled = false }: Props) {
  const toast = useToast();
  const [children, setChildren] = useState<Record<string, TreeNode[]>>(() => ({
    [ROOT_KEY]: tree.groups.map((g) => ({ key: `g${g.id}`, text: g.text, kind: 'group', groupId: g.id })),
  }));
  const [expansions, setExpansions] = useState(0);
  const left = MAX_EXPANSIONS - expansions;

  const expand = (node: TreeNode) => {
    if (children[node.key]) return;
    if (left <= 0) {
      toast.show(`가지는 ${MAX_EXPANSIONS}번까지 뻗을 수 있어요. 지금 나온 단어 중에서 고정해 주세요.`);
      return;
    }
    const group = tree.groups.find((g) => g.id === node.groupId);
    if (!group) return;
    const shown = new Set(
      Object.values(children)
        .flat()
        .filter((n) => n.kind === 'word')
        .map((n) => n.text),
    );
    const pool = group.children.filter((c) => !shown.has(c.text));
    if (pool.length === 0) {
      toast.show(`'${group.text}' 가지에는 더 뻗을 단어가 없어요. 다른 가지를 눌러 보세요.`);
      return;
    }
    const picked = shuffled(pool).slice(0, node.kind === 'group' ? GROUP_BRANCH : WORD_BRANCH);
    setChildren((prev) => ({
      ...prev,
      [node.key]: picked.map((c) => ({ key: `w${c.id}`, text: c.text, kind: 'word', groupId: group.id })),
    }));
    setExpansions((n) => n + 1);
  };

  const renderNode = (node: TreeNode) => {
    const kids = children[node.key];
    const isFixed = node.kind === 'word' && fixed.includes(node.text);
    return (
      <li key={node.key}>
        <div className={`wt-node wt-${node.kind} ${kids ? 'is-open' : ''} ${isFixed ? 'is-fixed' : ''}`}>
          {node.kind === 'root' ? (
            <span className="wt-label">{node.text}</span>
          ) : (
            <button
              className="wt-label"
              onClick={() => expand(node)}
              disabled={disabled}
              aria-expanded={!!kids}
              title={kids ? undefined : '눌러서 아래로 뻗기'}
            >
              {node.text}
            </button>
          )}
          {node.kind === 'word' && (
            <button className="mini" onClick={() => onToggleFix(node.text)} disabled={disabled} aria-pressed={isFixed}>
              {isFixed ? '고정됨' : '고정'}
            </button>
          )}
        </div>
        {kids && <ul>{kids.map(renderNode)}</ul>}
      </li>
    );
  };

  const root: TreeNode = {
    key: ROOT_KEY,
    text: tree.name.replace(' 개발', '').replace(' 기획', ''),
    kind: 'root',
    groupId: null,
  };

  return (
    <div className="tree">
      <div className="tree-head">
        <span className="small strong">단어 트리</span>
        <span className="tiny muted">카테고리 단어 풀 {tree.wordCount}개</span>
        <span className={`tree-count tiny ${left <= 0 ? 'is-out' : ''}`} aria-live="polite">
          뻗기 {expansions}/{MAX_EXPANSIONS}
        </span>
      </div>
      <div className="wt-scroll">
        <ul className="wt">{renderNode(root)}</ul>
      </div>
    </div>
  );
}
