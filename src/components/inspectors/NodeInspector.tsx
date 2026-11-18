import { formatBallot } from '../../core/paxos/ballot';
import {
  PHASE_TERMS,
  ROLE_TERMS,
  STATUS_TERMS,
  bilingual,
  formatTime,
} from '../../core/i18n/terms';
import type { MessageSummary } from '../../core/paxos/types';
import { useSimulationStore } from '../../store/simulation-store';

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="field-row">
      <span className="field-key">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

function MessageList({ items, empty }: { items: MessageSummary[]; empty: string }) {
  if (items.length === 0) return <p className="hint small">{empty}</p>;
  return (
    <ul className="message-list">
      {items.slice(-6).map((item, index) => (
        <li key={`${item.type}-${item.peer}-${item.at}-${index}`}>
          <span className={`msg-tag msg-${item.type}`}>{item.type}</span>
          <span className="msg-peer">
            {item.peer} · {formatBallot(item.ballot)}
          </span>
          {item.value !== null && <span className="msg-value">{item.value}</span>}
          <span className="msg-time">{formatTime(item.at)}</span>
        </li>
      ))}
    </ul>
  );
}

export function NodeInspector() {
  const state = useSimulationStore((store) => store.state);
  const selectedNodeId = useSimulationStore((store) => store.selectedNodeId);
  const crash = useSimulationStore((store) => store.crash);
  const recover = useSimulationStore((store) => store.recover);
  const retry = useSimulationStore((store) => store.retry);
  const showPersian = useSimulationStore((store) => store.showPersian);

  const proposer = state.proposers.find((node) => node.id === selectedNodeId);
  const acceptor = state.acceptors.find((node) => node.id === selectedNodeId);
  const learner = state.learners.find((node) => node.id === selectedNodeId);

  if (!selectedNodeId || (!proposer && !acceptor && !learner)) {
    return (
      <section className="panel inspector-panel">
        <div className="panel-head compact">
          <h2>Node inspector</h2>
        </div>
        <p className="hint">Select a node in the network to inspect its internal protocol state.</p>
      </section>
    );
  }

  const node = proposer ?? acceptor ?? learner;
  const role = node?.role ?? 'acceptor';
  const status = node?.status ?? 'active';

  return (
    <section className="panel inspector-panel">
      <div className="panel-head compact">
        <div>
          <h2>
            {selectedNodeId} <span className="role-tag">{bilingual(ROLE_TERMS[role], showPersian)}</span>
          </h2>
          <p className="panel-sub">
            Status: <strong className={`text-${status}`}>{STATUS_TERMS[status].en}</strong>
          </p>
        </div>
        <div className="inspector-actions">
          {(status === 'crashed' || status === 'recovering') && (
            <button type="button" className="btn btn-small" onClick={() => recover(selectedNodeId)}>
              Recover
            </button>
          )}
          {status === 'active' && (
            <button type="button" className="btn btn-small danger" onClick={() => crash(selectedNodeId)}>
              Crash
            </button>
          )}
        </div>
      </div>

      {proposer && (
        <div className="field-grid">
          <Field label="Proposer ID" value={proposer.id} />
          <Field label="Current ballot" value={formatBallot(proposer.ballot)} />
          <Field label="Proposed value" value={proposer.proposedValue} />
          <Field label="Promises" value={`${proposer.promises.length} / ${state.quorum}`} />
          <Field label="Accepted responses" value={`${proposer.accepts.length} / ${state.quorum}`} />
          <Field label="Quorum requirement" value={state.quorum} />
          <Field
            label="Current phase"
            value={bilingual(PHASE_TERMS[proposer.phase], showPersian)}
          />
          <Field label="Selected value" value={proposer.selectedValue ?? '—'} />
          <Field label="Retries" value={proposer.retries} />
          <Field label="NACKs received" value={proposer.nacks.length} />
          {proposer.phase !== 'chosen' && (
            <button
              type="button"
              className="btn btn-small btn-block"
              onClick={() => retry(proposer.id)}
              disabled={proposer.status !== 'active'}
            >
              Retry with higher ballot
            </button>
          )}
        </div>
      )}

      {acceptor && (
        <>
          <div className="field-grid">
            <Field label="Acceptor ID" value={acceptor.id} />
            <Field label="Promised ballot" value={formatBallot(acceptor.promisedBallot)} />
            <Field label="Accepted ballot" value={formatBallot(acceptor.acceptedBallot)} />
            <Field label="Accepted value" value={acceptor.acceptedValue ?? '—'} />
            <Field label="Node status" value={STATUS_TERMS[acceptor.status].en} />
          </div>
          <h3 className="sub-head">Received messages</h3>
          <MessageList items={acceptor.received} empty="No messages received yet." />
          <h3 className="sub-head">Sent responses</h3>
          <MessageList items={acceptor.sent} empty="No responses sent yet." />
        </>
      )}

      {learner && (
        <>
          <div className="field-grid">
            <Field label="Learner ID" value={learner.id} />
            <Field label="Accepted messages" value={learner.received.length} />
            <Field
              label="Accepted proposal"
              value={
                learner.chosenBallot
                  ? `${formatBallot(learner.chosenBallot)} · ${learner.chosenValue ?? '—'}`
                  : learner.received.length > 0
                    ? `${formatBallot(learner.received[learner.received.length - 1].ballot)}`
                    : '—'
              }
            />
            <Field label="Detected chosen value" value={learner.chosenValue ?? '—'} />
          </div>
          <h3 className="sub-head">Received messages</h3>
          <MessageList items={learner.received} empty="No Accepted messages yet." />
        </>
      )}
    </section>
  );
}
