import { useEffect, useMemo, useRef } from 'react';
import { MESSAGE_META, type PacketShape } from '../../core/i18n/terms';
import { isPacketVisible, packetProgress, type Message } from '../../core/network/message';
import { getAnimationTime, subscribeAnimationClock } from '../../visualization/animation-clock';
import { laneFor, packetPosition, type NodeLayout } from '../../visualization/topology';

interface PacketLayerProps {
  messages: Message[];
  nodes: NodeLayout[];
  selectedPacketId: string | null;
  onSelect: (id: string) => void;
}

function Shape({ shape, color }: { shape: PacketShape; color: string }) {
  const stroke = 'rgba(255, 255, 255, 0.85)';
  const common = { fill: color, stroke, strokeWidth: 1.2 };
  switch (shape) {
    case 'square':
      return <rect x={-6.5} y={-6.5} width={13} height={13} rx={2} {...common} />;
    case 'diamond':
      return <polygon points="0,-9 9,0 0,9 -9,0" {...common} />;
    case 'hexagon':
      return <polygon points="-8,-5 -8,5 0,9 8,5 8,-5 0,-9" {...common} />;
    case 'triangle':
      return <polygon points="0,-9 9,7 -9,7" {...common} />;
    case 'circle':
    default:
      return <circle r={8} {...common} />;
  }
}

/**
 * Packets are rendered once per simulation state and then moved every frame by
 * writing SVG transforms directly. React does not re-render during animation.
 */
export function PacketLayer({ messages, nodes, selectedPacketId, onSelect }: PacketLayerProps) {
  const refs = useRef(new Map<string, SVGGElement>());

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of nodes) map.set(node.id, { x: node.x, y: node.y });
    return map;
  }, [nodes]);

  const rendered = useMemo(() => {
    const time = getAnimationTime();
    // Keep only packets that can still be on screen: in flight, or already
    // resolved but not yet reached by the display clock (step-by-step mode).
    return messages.filter((message) => {
      if (message.status === 'inflight') return true;
      if (message.status === 'dropped') return (message.dropAt ?? 0) > time;
      return message.arriveAt > time;
    });
  }, [messages]);

  useEffect(() => {
    const apply = () => {
      const time = getAnimationTime();
      for (const message of rendered) {
        const group = refs.current.get(message.id);
        if (!group) continue;
        const from = positions.get(message.from);
        const to = positions.get(message.to);
        if (!from || !to || !isPacketVisible(message, time)) {
          group.style.display = 'none';
          continue;
        }
        group.style.display = '';
        const point = packetPosition(
          from,
          to,
          packetProgress(message, time),
          laneFor(message.id),
        );
        group.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);
        group.style.opacity =
          message.status === 'dropped' ? String(1 - packetProgress(message, time) * 0.75) : '1';
      }
    };

    apply();
    return subscribeAnimationClock(apply);
  }, [rendered, positions]);

  return (
    <g className="packet-layer">
      {rendered.map((message) => {
        const meta = MESSAGE_META[message.type];
        const selected = message.id === selectedPacketId;
        return (
          <g
            key={message.id}
            ref={(element) => {
              if (element) refs.current.set(message.id, element);
              else refs.current.delete(message.id);
            }}
            className={`packet packet-${message.type}${selected ? ' packet-selected' : ''}${
              message.status === 'dropped' ? ' packet-dropped' : ''
            }`}
            aria-label={`${meta.en} from ${message.from} to ${message.to}`}
          >
            {selected && <circle r={14} className="packet-selection" />}
            <Shape shape={meta.shape} color={meta.color} />
            <circle
              r={15}
              className="packet-hit"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(message.id);
              }}
            />
            <title>
              {meta.en} · {message.from} → {message.to}
            </title>
          </g>
        );
      })}
    </g>
  );
}
