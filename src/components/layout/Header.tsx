import { useSimulationStore } from '../../store/simulation-store';

export function Header() {
  const status = useSimulationStore((store) => store.protocolStatus());
  const state = useSimulationStore((store) => store.state);
  const showPersian = useSimulationStore((store) => store.showPersian);
  const togglePersian = useSimulationStore((store) => store.togglePersian);

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          ◈
        </span>
        <div>
          <h1>Paxos Protocol Explorer</h1>
          <p>
            Basic Paxos consensus · {state.acceptors.length} acceptors · quorum {state.quorum}
            {showPersian ? ' · شبیه‌ساز تعاملی پاکسوس' : ''}
          </p>
        </div>
      </div>

      <div className="header-actions">
        <span className={`status-pill tone-${status.tone}`}>
          <span className="dot" aria-hidden="true" />
          {status.label}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={togglePersian}
          title="Toggle Persian terminology"
        >
          {showPersian ? 'EN + فارسی' : 'English'}
        </button>
      </div>
    </header>
  );
}
