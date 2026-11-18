import { useI18n } from '../../i18n/useI18n';
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
  const { t, time } = useI18n();

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
        <h2>{t('simulation')}</h2>
        <span className="clock">{time(state.virtualTime)}</span>
      </div>

      <div className="transport">
        <button
          type="button"
          className="btn btn-primary"
          onClick={togglePlay}
          disabled={!hasNext && !isPlaying}
        >
          <span className="glyph">{isPlaying ? '❙❙' : '▶'}</span> {isPlaying ? t('pause') : t('play')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={stepBackward}
          disabled={!canStepBack}
          title={t('stepBackTitle')}
        >
          <span className="glyph">◀</span> {t('stepBack')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={stepForward}
          disabled={!hasNext}
          title={t('stepForwardTitle')}
        >
          {t('stepBack')} <span className="glyph">▶</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          <span className="glyph">⟲</span> {t('reset')}
        </button>
      </div>

      <div className="speed-row">
        <label htmlFor="speed">{t('animationSpeed')}</label>
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
            {phase === 'accepting' || phase === 'chosen'
              ? t('acceptedResponses')
              : t('promises')}
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
          {t('quorumFormula', {
            acceptors: state.acceptors.length,
            quorum: state.quorum,
          })}
        </p>
      </div>
    </section>
  );
}
