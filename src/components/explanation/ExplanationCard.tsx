import { useI18n } from '../../i18n/useI18n';
import { useSimulationStore } from '../../store/simulation-store';

export function ExplanationCard() {
  const state = useSimulationStore((store) => store.state);
  const selectedEventId = useSimulationStore((store) => store.selectedEventId);
  const { t, event, kind } = useI18n();

  const entry =
    state.log.find((item) => item.id === selectedEventId) ?? state.log[state.log.length - 1];

  if (!entry) {
    return (
      <section className="panel explanation-panel">
        <div className="explanation-head">
          <span className="explanation-label">{t('howItWorks')}</span>
        </div>
        <p className="explanation-body">{t('introBody')}</p>
      </section>
    );
  }

  return (
    <section className="panel explanation-panel">
      <div className="explanation-head">
        <span className="explanation-label">{t('whyThisHappened')}</span>
        <span className={`timeline-kind kind-${entry.kind}`}>{kind(entry.kind)}</span>
      </div>
      <p className="explanation-title">{event(entry.description)}</p>
      <p className="explanation-body">{event(entry.explanation)}</p>
    </section>
  );
}
