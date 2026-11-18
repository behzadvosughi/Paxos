import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useSimulationStore } from '../../store/simulation-store';

export function EventTimeline() {
  const state = useSimulationStore((store) => store.state);
  const selectedEventId = useSimulationStore((store) => store.selectedEventId);
  const selectEvent = useSimulationStore((store) => store.selectEvent);
  const listRef = useRef<HTMLOListElement>(null);
  const { t, event, kind, time } = useI18n();

  // Follow the newest entry inside the timeline only. Scrolling the list itself
  // keeps the page where the user left it while the simulation runs.
  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
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
        <ol className="timeline" ref={listRef}>
          {state.log.map((entry) => (
            <li
              key={entry.id}
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
