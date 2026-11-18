import { useEffect, useState } from 'react';
import { STATUS_TERMS } from '../../core/i18n/terms';
import type { SimulationConfig } from '../../core/simulation/simulation-state';
import { useI18n } from '../../i18n/useI18n';
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
  const { t, term } = useI18n();

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
        <h2>{t('configuration')}</h2>
        {dirty && <span className="badge badge-warn">{t('unsaved')}</span>}
      </div>

      <div className="config-section">
        <h3>{t('sectionNetwork')}</h3>
        <label className="field">
          <span className="field-label">{t('acceptors')}</span>
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
          <span className="field-label">{t('proposers')}</span>
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
          <span className="field-label">{t('learners')}</span>
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
          label={t('networkLatency')}
          value={draft.latency}
          onChange={(latency) => update({ latency })}
          min={20}
          max={600}
          step={10}
          suffix="ms"
        />
        <NumberField
          label={t('packetDelay')}
          value={draft.packetDelay}
          onChange={(packetDelay) => update({ packetDelay })}
          min={0}
          max={400}
          step={10}
          suffix="ms"
        />

        <label className="field">
          <span className="field-label">{t('packetLoss')}</span>
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
        <h3>{t('sectionProtocol')}</h3>
        <NumberField
          label={t('proposalRound')}
          value={draft.proposalRound}
          onChange={(proposalRound) => update({ proposalRound })}
          min={1}
          max={99}
        />
        <label className="field">
          <span className="field-label">{t('proposedValue')}</span>
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
          label={t('randomSeed')}
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
          <span className="field-label">{t('autoRetry')}</span>
        </label>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => applyConfig(draft)}>
        {t('applyRestart')}
      </button>
      <p className="hint">{t('applyHint')}</p>

      <div className="config-section">
        <h3>{t('sectionFailures')}</h3>
        <div className="node-failure-list">
          {nodes.map((node) => (
            <div className="node-failure-row" key={node.id}>
              <span className={`node-chip status-${node.status}`}>
                {node.id} · {term(STATUS_TERMS[node.status])}
              </span>
              {node.status === 'crashed' || node.status === 'recovering' ? (
                <button type="button" className="link-btn" onClick={() => recover(node.id)}>
                  {t('recover')}
                </button>
              ) : (
                <button type="button" className="link-btn danger" onClick={() => crash(node.id)}>
                  {t('crash')}
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
          {state.partitionEnabled ? t('healPartition') : t('simulatePartition')}
        </button>
        <button type="button" className="btn btn-block btn-ghost" onClick={dropPackets}>
          {t('dropAllPackets')}
        </button>
        <p className="hint">{t('linkHint')}</p>

        <label className="field field-inline">
          <input
            type="checkbox"
            checked={draft.unsafeRecover}
            onChange={(event) => update({ unsafeRecover: event.target.checked })}
          />
          <span className="field-label">
            {t('unsafeRecover')}
            <em className="unsafe-label">{t('unsafeBadge')}</em>
          </span>
        </label>
      </div>
    </section>
  );
}
