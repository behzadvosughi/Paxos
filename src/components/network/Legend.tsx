import { MESSAGE_META, type PacketShape } from '../../core/i18n/terms';
import type { MessageType } from '../../core/paxos/types';

const ORDER: MessageType[] = ['prepare', 'promise', 'accept', 'accepted', 'nack'];

function MiniShape({ shape, color }: { shape: PacketShape; color: string }) {
  const common = { fill: color, stroke: 'rgba(255,255,255,0.8)', strokeWidth: 1 };
  return (
    <svg viewBox="-10 -10 20 20" width="14" height="14" aria-hidden="true">
      {shape === 'circle' && <circle r={7.5} {...common} />}
      {shape === 'square' && <rect x={-6.5} y={-6.5} width={13} height={13} rx={2} {...common} />}
      {shape === 'diamond' && <polygon points="0,-8 8,0 0,8 -8,0" {...common} />}
      {shape === 'hexagon' && (
        <polygon points="-7,-4.5 -7,4.5 0,8 7,4.5 7,-4.5 0,-8" {...common} />
      )}
      {shape === 'triangle' && <polygon points="0,-8 8,6 -8,6" {...common} />}
    </svg>
  );
}

export function Legend({ showPersian }: { showPersian: boolean }) {
  return (
    <div className="legend">
      {ORDER.map((type) => {
        const meta = MESSAGE_META[type];
        return (
          <span className="legend-item" key={type} title={meta.hint}>
            <MiniShape shape={meta.shape} color={meta.color} />
            {meta.en}
            {showPersian && <em className="fa">{meta.fa}</em>}
          </span>
        );
      })}
    </div>
  );
}
