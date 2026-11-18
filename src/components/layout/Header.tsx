import type { ProtocolStatusKey } from '../../core/simulation/simulation-engine';
import type { UiKey } from '../../core/i18n/strings';
import { useI18n } from '../../i18n/useI18n';
import { useSimulationStore } from '../../store/simulation-store';

const STATUS_UI_KEYS: Record<ProtocolStatusKey, UiKey> = {
  ready: 'statusReady',
  chosen: 'statusChosen',
  stalled: 'statusStalled',
  phase1: 'statusPhase1',
  phase2: 'statusPhase2',
  inProgress: 'statusInProgress',
  safety: 'statusSafety',
};

export function Header() {
  const status = useSimulationStore((store) => store.protocolStatus());
  const state = useSimulationStore((store) => store.state);
  const setLanguage = useSimulationStore((store) => store.setLanguage);
  const { lang, t } = useI18n();

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          ◈
        </span>
        <div>
          <h1>{t('appTitle')}</h1>
          <p>
            {t('appSubtitle', {
              acceptors: state.acceptors.length,
              quorum: state.quorum,
            })}
          </p>
        </div>
      </div>

      <div className="header-actions">
        <span className={`status-pill tone-${status.tone}`}>
          <span className="dot" aria-hidden="true" />
          {t(STATUS_UI_KEYS[status.key], { value: status.value })}
        </span>
        <div className="lang-switch" role="group" aria-label={t('languageSwitchTitle')}>
          <button
            type="button"
            className={`btn btn-ghost btn-lang${lang === 'en' ? ' btn-active' : ''}`}
            onClick={() => setLanguage('en')}
            aria-pressed={lang === 'en'}
            title={t('languageSwitchTitle')}
          >
            {t('languageEnglish')}
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-lang${lang === 'fa' ? ' btn-active' : ''}`}
            onClick={() => setLanguage('fa')}
            aria-pressed={lang === 'fa'}
            title={t('languageSwitchTitle')}
          >
            {t('languagePersian')}
          </button>
        </div>
      </div>
    </header>
  );
}
