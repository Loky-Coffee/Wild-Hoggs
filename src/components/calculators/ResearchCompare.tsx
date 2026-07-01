import { useState } from 'preact/hooks';
import './ResearchCompare.css';

interface CompareNode {
  name: string;
  bonus: string;
  unlock: string;
  maxLevel: number;
}
interface CompareTree {
  id: string;
  name: string;
  nodes: CompareNode[];
}

interface ResearchCompareProps {
  readonly treesData: CompareTree[];
  readonly labels: { left: string; right: string; empty: string };
}

export default function ResearchCompare({ treesData, labels }: ResearchCompareProps) {
  const [leftId, setLeftId] = useState(treesData[0]?.id ?? '');
  const [rightId, setRightId] = useState(treesData[1]?.id ?? treesData[0]?.id ?? '');

  const left = treesData.find((t) => t.id === leftId);
  const right = treesData.find((t) => t.id === rightId);
  const rows = Math.max(left?.nodes.length ?? 0, right?.nodes.length ?? 0);

  const cell = (node: CompareNode | undefined, key: string) => (
    <div class={`cmp-cell${node ? '' : ' cmp-cell-empty'}`} key={key}>
      {node ? (
        <>
          <div class="cmp-node-name">
            {node.name} <span class="cmp-lvl">Lv {node.maxLevel}</span>
          </div>
          {node.bonus && <div class="cmp-node-bonus">{node.bonus}</div>}
          {node.unlock && <div class="cmp-node-unlock">🔓 {node.unlock}</div>}
          {!node.bonus && !node.unlock && <div class="cmp-node-none">—</div>}
        </>
      ) : null}
    </div>
  );

  const treeSelect = (value: string, onChange: (id: string) => void, label: string) => (
    <label class="cmp-select-wrap">
      <span class="cmp-select-label">{label}</span>
      <select class="cmp-select" value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        {treesData.map((t) => (
          <option value={t.id} key={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );

  const cells = [];
  for (let i = 0; i < rows; i++) {
    cells.push(cell(left?.nodes[i], `l-${i}`));
    cells.push(cell(right?.nodes[i], `r-${i}`));
  }

  return (
    <div class="cmp-wrap">
      <div class="cmp-heads">
        {treeSelect(leftId, setLeftId, labels.left)}
        {treeSelect(rightId, setRightId, labels.right)}
      </div>
      <div class="cmp-grid">
        {rows === 0 ? <div class="cmp-cell cmp-cell-empty">{labels.empty}</div> : cells}
      </div>
    </div>
  );
}
