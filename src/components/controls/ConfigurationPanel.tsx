import { useEffect, useState } from 'react';
import { STATUS_TERMS } from '../../core/i18n/terms';
import type { SimulationConfig } from '../../core/simulation/simulation-state';
import { useSimulationStore } from '../../store/simulation-store';

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}

export function ConfigurationPanel() {
  const config = useSimulationStore((store) => store.config);
  const state = useSimulationStore((store) => store.state);
  const applyConfig = useSimulationStore((store) => store.applyConfig);
  const crash = useSimulationStore((store) => store.crash);
  const recover = useSimulationStore((store) => store.recover);
  const togglePartition = useSimulationStore((store) => store.togglePartition);
  const dropPackets = useSimulationStore((store) => store.dropPackets);

  const [draft, setDraft] = useState<SimulationConfig>(config);
  useEffect(() => setDraft(config), [config]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const update = (patch: Partial<SimulationConfig>) => setDraft((prev) => ({ ...prev, ...patch }));

  const nodes = [
    ...state.proposers.map((node) => ({ id: node.id, status: node.status })),
    ...state.acceptors.map((node) => ({ id: node.id, status: node.status })),
    ...state.learners.map((node) => ({ id: node.id, status: node.status })),
  ];

  return (
    <section className="panel config-panel">
      <div className="panel-head compact">
        <h2>Configuration</h2>
        {dirty && <span className="badge badge-warn">unsaved</span>}
      </div>

      <div className="config-section">
        <h3>Network</h3>
        <label className="field">
          <span className="field-label">Acceptors</span>
          <span className="field-input">
            <select
              value={draft.acceptorCount}
              onChange={(event) => update({ acceptorCount: Number(event.target.value) })}
            >
              {[3, 5, 7, 9].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="field">
          <span className="field-label">Proposers</span>
          <span className="field-input">
            <select
              value={draft.proposerCount}
              onChange={(event) => update({ proposerCount: Number(event.target.value) })}
            >
              {[1, 2, 3].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="field">
          <span className="field-label">Learners</span>
          <span className="field-input">
            <select
              value={draft.learnerCount}
              onChange={(event) => update({ learnerCount: Number(event.target.value) })}
            >
              {[1, 2, 3].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </span>
        </label>

        <NumberField
          label="Network latency"
          value={draft.latency}
          onChange={(latency) => update({ latency })}
          min={20}
          max={600}
          step={10}
          suffix="ms"
        />
        <NumberField
          label="Packet delay (jitter)"
          value={draft.packetDelay}
          onChange={(packetDelay) => update({ packetDelay })}
          min={0}
          max={400}
          step={10}
          suffix="ms"
        />

        <label className="field">
          <span className="field-label">Packet loss</span>
          <span className="field-input">
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.05}
              value={draft.packetLoss}
              onChange={(event) => update({ packetLoss: Number(event.target.value) })}
            />
            <em>{Math.round(draft.packetLoss * 100)}%</em>
          </span>
        </label>
      </div>

      <div className="config-section">
        <h3>Protocol</h3>
        <NumberField
          label="Proposal round"
          value={draft.proposalRound}
          onChange={(proposalRound) => update({ proposalRound })}
          min={1}
          max={99}
        />
        <label className="field">
          <span className="field-label">Proposed value</span>
          <span className="field-input">
            <input
              type="text"
              value={draft.proposedValue}
              maxLength={20}
              onChange={(event) => update({ proposedValue: event.target.value || 'alpha' })}
            />
          </span>
        </label>
        <NumberField
          label="Random seed"
          value={draft.seed}
          onChange={(seed) => update({ seed })}
          min={1}
          max={999999}
        />
        <label className="field field-inline">
          <input
            type="checkbox"
            checked={draft.autoRetry}
            onChange={(event) => update({ autoRetry: event.target.checked })}
          />
          <span className="field-label">Auto-retry after NACK</span>
        </label>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => applyConfig(draft)}>
        Apply &amp; restart
      </button>
      <p className="hint">
        Structural changes restart the simulation from a clean state. Speed can be changed at any
        time.
      </p>

      <div className="config-section">
        <h3>Failures</h3>
        <div className="node-failure-list">
          {nodes.map((node) => (
            <div className="node-failure-row" key={node.id}>
              <span className={`node-chip status-${node.status}`}>
                {node.id} · {STATUS_TERMS[node.status].en}
              </span>
              {node.status === 'crashed' || node.status === 'recovering' ? (
                <button type="button" className="link-btn" onClick={() => recover(node.id)}>
                  Recover
                </button>
              ) : (
                <button type="button" className="link-btn danger" onClick={() => crash(node.id)}>
                  Crash
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className={`btn btn-block${state.partitionEnabled ? ' btn-active' : ''}`}
          onClick={togglePartition}
        >
          {state.partitionEnabled ? 'Heal network partition' : 'Simulate network partition'}
        </button>
        <button type="button" className="btn btn-block btn-ghost" onClick={dropPackets}>
          Drop all in-flight packets
        </button>
        <p className="hint">Click any link on the canvas to disable or restore it.</p>

        <label className="field field-inline">
          <input
            type="checkbox"
            checked={draft.unsafeRecover}
            onChange={(event) => update({ unsafeRecover: event.target.checked })}
          />
          <span className="field-label">
            Unsafe recovery: forget durable state
            <em className="unsafe-label">intentionally unsafe</em>
          </span>
        </label>
      </div>
    </section>
  );
}
