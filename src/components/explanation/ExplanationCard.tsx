import { MESSAGE_META } from '../../core/i18n/terms';
import type { LogKind } from '../../core/simulation/simulation-state';
import type { MessageType } from '../../core/paxos/types';
import { useSimulationStore } from '../../store/simulation-store';

const KIND_TO_MESSAGE: Partial<Record<LogKind, MessageType>> = {
  prepare: 'prepare',
  promise: 'promise',
  accept: 'accept',
  accepted: 'accepted',
  nack: 'nack',
};

export function ExplanationCard() {
  const state = useSimulationStore((store) => store.state);
  const selectedEventId = useSimulationStore((store) => store.selectedEventId);
  const showPersian = useSimulationStore((store) => store.showPersian);

  const entry =
    state.log.find((item) => item.id === selectedEventId) ?? state.log[state.log.length - 1];

  if (!entry) {
    return (
      <section className="panel explanation-panel">
        <div className="explanation-head">
          <span className="explanation-label">How it works</span>
        </div>
        <p className="explanation-body">
          A proposer first asks the acceptors to <strong>promise</strong> a ballot (phase 1). With a
          majority of promises it sends <strong>Accept</strong> for the value implied by the highest
          previously accepted proposal (phase 2). A value is <strong>chosen</strong> once a majority
          of acceptors durably accepted it — every packet you see is a real protocol message.
        </p>
      </section>
    );
  }

  const messageType = KIND_TO_MESSAGE[entry.kind];
  const meta = messageType ? MESSAGE_META[messageType] : null;

  return (
    <section className="panel explanation-panel">
      <div className="explanation-head">
        <span className="explanation-label">Why this happened</span>
        <span className={`timeline-kind kind-${entry.kind}`}>{entry.kind}</span>
        {meta && showPersian && <span className="explanation-fa">{meta.fa}</span>}
      </div>
      <p className="explanation-title">{entry.description}</p>
      <p className="explanation-body">{entry.explanation}</p>
    </section>
  );
}
