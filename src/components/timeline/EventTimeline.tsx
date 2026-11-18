import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useSimulationStore } from '../../store/simulation-store';

export function EventTimeline() {
  const state = useSimulationStore((store) => store.state);
  const selectedEventId = useSimulationStore((store) => store.selectedEventId);
  const selectEvent = useSimulationStore((store) => store.selectEvent);
  const endRef = useRef<HTMLLIElement>(null);
  const { t, event, kind, time } = useI18n();

  useEffect(() => {
    const element = endRef.current;
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [state.log.length]);

  return (
    <section className="panel timeline-panel">
      <div className="panel-head compact">
        <h2>{t('eventTimeline')}</h2>
        <span className="panel-sub">{t('eventCount', { count: state.log.length })}</span>
      </div>

      {state.log.length === 0 ? (
        <p className="hint">{t('timelineEmpty')}</p>
      ) : (
        <ol className="timeline">
          {state.log.map((entry, index) => (
            <li
              key={entry.id}
              ref={index === state.log.length - 1 ? endRef : undefined}
              className={`timeline-row${entry.id === selectedEventId ? ' selected' : ''}`}
            >
              <button type="button" onClick={() => selectEvent(entry)}>
                <span className="timeline-time">{time(entry.time)}</span>
                <span className={`timeline-kind kind-${entry.kind}`}>{kind(entry.kind)}</span>
                <span className="timeline-desc">{event(entry.description)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
