import { ROLE_TERMS, STATUS_TERMS, bilingual } from '../../core/i18n/terms';
import type { NodeLayout } from '../../visualization/topology';

interface NodeCardProps {
  node: NodeLayout;
  selected: boolean;
  showPersian: boolean;
  onSelect: (id: string) => void;
}

export function NodeCard({ node, selected, showPersian, onSelect }: NodeCardProps) {
  const { id, role, status, x, y, width, height, caption } = node;

  return (
    <g
      className={`node node-${role} node-status-${status}${selected ? ' node-selected' : ''}`}
      transform={`translate(${x - width / 2} ${y - height / 2})`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${id} ${role} ${status}`}
    >
      <rect className="node-hit" width={width} height={height} rx={12} />
      <rect className="node-card" width={width} height={height} rx={12} />
      <text className="node-role" x={12} y={20}>
        {bilingual(ROLE_TERMS[role], showPersian).toUpperCase()}
      </text>
      <text className="node-id" x={12} y={44}>
        {id}
      </text>
      <text className="node-caption" x={12} y={64}>
        {caption}
      </text>
      <circle className={`node-dot status-${status}`} cx={width - 14} cy={16} r={4} />
      <title>
        {id} · {bilingual(ROLE_TERMS[role], showPersian)} · {STATUS_TERMS[status].en}
      </title>
    </g>
  );
}
