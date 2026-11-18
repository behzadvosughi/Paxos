import { formatTime } from '../../core/i18n/terms';
import { useSimulationStore } from '../../store/simulation-store';

export function SimulationControls() {
  const state = useSimulationStore((store) => store.state);
  const isPlaying = useSimulationStore((store) => store.isPlaying);
  const speed = useSimulationStore((store) => store.speed);
  const togglePlay = useSimulationStore((store) => store.togglePlay);
  const stepForward = useSimulationStore((store) => store.stepForward);
  const stepBackward = useSimulationStore((store) => store.stepBackward);
  const reset = useSimulationStore((store) => store.reset);
  const setSpeed = useSimulationStore((store) => store.setSpeed);
  const canStepBack = useSimulationStore((store) => store.canStepBack());

  const hasNext = state.queue.length > 0;

  const proposer =
    state.proposers.find((entry) => entry.phase === 'accepting') ??
    state.proposers.find((entry) => entry.phase === 'preparing') ??
    state.proposers[0];

  const phase = proposer?.phase;
  const count = !proposer
    ? 0
    : phase === 'accepting' || phase === 'chosen'
      ? proposer.accepts.length
      : proposer.promises.length;
  const quorumProgress = Math.min(1, count / state.quorum);

  return (
    <section className="panel controls-panel">
      <div className="panel-head compact">
        <h2>Simulation</h2>
        <span className="clock">{formatTime(state.virtualTime)}</span>
      </div>

      <div className="transport">
        <button type="button" className="btn btn-primary" onClick={togglePlay} disabled={!hasNext && !isPlaying}>
          {isPlaying ? '❙❙ Pause' : '▶ Play'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={stepBackward}
          disabled={!canStepBack}
          title="Restore the previous deterministic snapshot"
        >
          ◀ Step
        </button>
        <button
          type="button"
          className="btn"
          onClick={stepForward}
          disabled={!hasNext}
          title="Process exactly one simulation event"
        >
          Step ▶
        </button>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          ⟲ Reset
        </button>
      </div>

      <div className="speed-row">
        <label htmlFor="speed">Animation speed</label>
        <input
          id="speed"
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
        />
        <span className="mono">{speed.toFixed(2)}×</span>
      </div>

      <div className="quorum-row">
        <div className="quorum-label">
          <span>
            {phase === 'accepting' || phase === 'chosen' ? 'Accepted responses' : 'Promises'}
            {proposer ? ` · ${proposer.id}` : ''}
          </span>
          <span className="mono">
            {count} / {state.quorum}
          </span>
        </div>
        <div className="quorum-track">
          <div
            className={`quorum-fill${count >= state.quorum ? ' full' : ''}`}
            style={{ width: `${quorumProgress * 100}%` }}
          />
          <div className="quorum-marker" style={{ left: '100%' }} />
        </div>
        <p className="hint">
          quorum = floor({state.acceptors.length} / 2) + 1 = {state.quorum}
        </p>
      </div>
    </section>
  );
}
