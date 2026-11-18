import { useEffect, useRef } from 'react';
import { formatTime } from '../../core/i18n/terms';
import { useSimulationStore } from '../../store/simulation-store';

export function EventTimeline() {
  const state = useSimulationStore((store) => store.state);
  const selectedEventId = useSimulationStore((store) => store.selectedEventId);
  const selectEvent = useSimulationStore((store) => store.selectEvent);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const element = endRef.current;
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [state.log.length]);

  return (
    <section className="panel timeline-panel">
      <div className="panel-head compact">
        <h2>Event timeline</h2>
        <span className="panel-sub">{state.log.length} events</span>
      </div>

      {state.log.length === 0 ? (
        <p className="hint">Press Play or Step ▶ to start the protocol. Every row below is a real simulation event.</p>
      ) : (
        <ol className="timeline">
          {state.log.map((entry, index) => (
            <li
              key={entry.id}
              ref={index === state.log.length - 1 ? endRef : undefined}
              className={`timeline-row${entry.id === selectedEventId ? ' selected' : ''}`}
            >
              <button type="button" onClick={() => selectEvent(entry)}>
                <span className="timeline-time">{formatTime(entry.time)}</span>
                <span className={`timeline-kind kind-${entry.kind}`}>{entry.kind}</span>
                <span className="timeline-desc">{entry.description}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
