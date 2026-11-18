import { ROLE_TERMS, STATUS_TERMS } from '../../core/i18n/terms';
import { useI18n, type I18n } from '../../i18n/useI18n';
import type { CaptionInfo, NodeLayout } from '../../visualization/topology';

interface NodeCardProps {
  node: NodeLayout;
  selected: boolean;
  onSelect: (id: string) => void;
}

function captionText(i18n: I18n, caption: CaptionInfo): string {
  switch (caption.key) {
    case 'chosen':
      return i18n.t('captionChosen', { value: caption.value });
    case 'ballot':
      return i18n.t('captionBallot', { ballot: caption.ballot });
    case 'accepted':
      return i18n.t('captionAccepted', { ballot: caption.ballot });
    case 'promised':
      return i18n.t('captionPromised', { ballot: caption.ballot });
    case 'learned':
      return i18n.t('captionLearned', { value: caption.value });
    case 'noPromise':
      return i18n.t('captionNoPromise');
    case 'listening':
      return i18n.t('captionListening');
    case 'idle':
      return i18n.t('captionIdle');
    case 'none':
    default:
      return '';
  }
}

export function NodeCard({ node, selected, onSelect }: NodeCardProps) {
  const { id, role, status, x, y, width, height, caption } = node;
  const i18n = useI18n();
  const roleLabel = i18n.term(ROLE_TERMS[role]);
  const statusLabel = i18n.term(STATUS_TERMS[status]);
  const tooltip = i18n.t('nodeTooltip', { id, role: roleLabel, status: statusLabel });
  // In RTL the inline "start" edge is the right side, so anchoring at `width - 12`
  // keeps Persian text inside the card; the status dot moves to the other corner.
  const textX = i18n.rtl ? width - 12 : 12;
  const dotX = i18n.rtl ? 14 : width - 14;

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
      aria-label={tooltip}
    >
      <rect className="node-hit" width={width} height={height} rx={12} />
      <rect className="node-card" width={width} height={height} rx={12} />
      <text className="node-role" x={textX} y={20}>
        {i18n.lang === 'en' ? roleLabel.toUpperCase() : roleLabel}
      </text>
      <text className="node-id" x={textX} y={44}>
        {id}
      </text>
      <text className="node-caption" x={textX} y={64}>
        {captionText(i18n, caption)}
      </text>
      <circle className={`node-dot status-${status}`} cx={dotX} cy={16} r={4} />
      <title>{tooltip}</title>
    </g>
  );
}
