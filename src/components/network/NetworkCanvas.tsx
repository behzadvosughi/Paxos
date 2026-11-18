import { useMemo } from 'react';
import { linkBlockReason } from '../../core/network/network-engine';
import { useI18n } from '../../i18n/useI18n';
import { useSimulationStore } from '../../store/simulation-store';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  computeTopology,
} from '../../visualization/topology';
import { Legend } from './Legend';
import { NodeCard } from './NodeCard';
import { PacketLayer } from './PacketLayer';

export function NetworkCanvas() {
  const state = useSimulationStore((store) => store.state);
  const selectedNodeId = useSimulationStore((store) => store.selectedNodeId);
  const selectedPacketId = useSimulationStore((store) => store.selectedPacketId);
  const selectNode = useSimulationStore((store) => store.selectNode);
  const selectPacket = useSimulationStore((store) => store.selectPacket);
  const toggleLink = useSimulationStore((store) => store.toggleLink);
  const { t, reason } = useI18n();

  const { nodes, links } = useMemo(() => computeTopology(state), [state]);

  const accepted = state.acceptors.filter((acceptor) => acceptor.acceptedBallot !== null).length;

  return (
    <section className="panel canvas-panel">
      <div className="panel-head">
        <div>
          <h2>{t('network')}</h2>
          <p className="panel-sub">
            {t('networkSummary', {
              proposers: state.proposers.length,
              acceptors: state.acceptors.length,
              learners: state.learners.length,
            })}
          </p>
        </div>
        <div className="canvas-metrics">
          <span className="metric">
            <strong>{state.quorum}</strong> {t('metricQuorum')}
          </span>
          <span className="metric">
            <strong>{accepted}</strong> {t('metricAccepted')}
          </span>
          <span className="metric">
            <strong>{state.stats.dropped}</strong> {t('metricDropped')}
          </span>
        </div>
      </div>

      <div className="canvas-wrap">
        <svg
          className="network-svg"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          role="img"
          aria-label={t('canvasAria')}
          onClick={() => selectNode(null)}
        >
          <defs>
            <filter id="node-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className="links">
            {links.map((link) => {
              const blocked = linkBlockReason(
                link.endpointA,
                link.endpointB,
                state.disabledLinks,
                state.partitionEnabled,
                state.partitionGroupA,
              );
              return (
                <g
                  key={link.id}
                  className={`link${blocked ? ' link-blocked' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleLink(link.endpointA, link.endpointB);
                  }}
                >
                  <line
                    className="link-line"
                    x1={link.fromPoint.x}
                    y1={link.fromPoint.y}
                    x2={link.toPoint.x}
                    y2={link.toPoint.y}
                  />
                  <line
                    className="link-hit"
                    x1={link.fromPoint.x}
                    y1={link.fromPoint.y}
                    x2={link.toPoint.x}
                    y2={link.toPoint.y}
                  />
                  {blocked && (
                    <text
                      className="link-x"
                      x={(link.fromPoint.x + link.toPoint.x) / 2}
                      y={(link.fromPoint.y + link.toPoint.y) / 2 + 4}
                    >
                      ×
                    </text>
                  )}
                  <title>
                    {blocked
                      ? t('linkTooltipBlocked', {
                          a: link.endpointA,
                          b: link.endpointB,
                          reason: reason(blocked),
                        })
                      : t('linkTooltip', { a: link.endpointA, b: link.endpointB })}
                  </title>
                </g>
              );
            })}
          </g>

          <g className="nodes">
            {nodes.map((node) => (
              <NodeCard key={node.id} node={node} selected={node.id === selectedNodeId} onSelect={selectNode} />
            ))}
          </g>

          <PacketLayer
            messages={state.messages}
            nodes={nodes}
            selectedPacketId={selectedPacketId}
            onSelect={selectPacket}
          />
        </svg>
      </div>

      <div className="canvas-foot">
        <Legend />
        <span className="canvas-hint">{t('canvasHint')}</span>
      </div>
    </section>
  );
}
