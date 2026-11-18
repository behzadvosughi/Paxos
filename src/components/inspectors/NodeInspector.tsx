import { formatBallot } from '../../core/paxos/ballot';
import { PHASE_TERMS, ROLE_TERMS, STATUS_TERMS } from '../../core/i18n/terms';
import type { MessageSummary } from '../../core/paxos/types';
import { useI18n } from '../../i18n/useI18n';
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
  const { messageType, time } = useI18n();
  if (items.length === 0) return <p className="hint small">{empty}</p>;
  return (
    <ul className="message-list">
      {items.slice(-6).map((item, index) => (
        <li key={`${item.type}-${item.peer}-${item.at}-${index}`}>
          <span className={`msg-tag msg-${item.type}`}>{messageType(item.type)}</span>
          <span className="msg-peer">
            {item.peer} · {formatBallot(item.ballot)}
          </span>
          {item.value !== null && <span className="msg-value">{item.value}</span>}
          <span className="msg-time">{time(item.at)}</span>
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
  const { t, term } = useI18n();

  const proposer = state.proposers.find((node) => node.id === selectedNodeId);
  const acceptor = state.acceptors.find((node) => node.id === selectedNodeId);
  const learner = state.learners.find((node) => node.id === selectedNodeId);

  if (!selectedNodeId || (!proposer && !acceptor && !learner)) {
    return (
      <section className="panel inspector-panel">
        <div className="panel-head compact">
          <h2>{t('nodeInspector')}</h2>
        </div>
        <p className="hint">{t('selectNodeHint')}</p>
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
            {selectedNodeId} <span className="role-tag">{term(ROLE_TERMS[role])}</span>
          </h2>
          <p className="panel-sub">
            {t('statusLabel')} <strong className={`text-${status}`}>{term(STATUS_TERMS[status])}</strong>
          </p>
        </div>
        <div className="inspector-actions">
          {(status === 'crashed' || status === 'recovering') && (
            <button type="button" className="btn btn-small" onClick={() => recover(selectedNodeId)}>
              {t('recover')}
            </button>
          )}
          {status === 'active' && (
            <button type="button" className="btn btn-small danger" onClick={() => crash(selectedNodeId)}>
              {t('crash')}
            </button>
          )}
        </div>
      </div>

      {proposer && (
        <div className="field-grid">
          <Field label={t('proposerId')} value={proposer.id} />
          <Field label={t('currentBallot')} value={formatBallot(proposer.ballot)} />
          <Field label={t('proposedValueField')} value={proposer.proposedValue} />
          <Field label={t('promisesField')} value={`${proposer.promises.length} / ${state.quorum}`} />
          <Field
            label={t('acceptedResponsesField')}
            value={`${proposer.accepts.length} / ${state.quorum}`}
          />
          <Field label={t('quorumRequirement')} value={state.quorum} />
          <Field label={t('currentPhase')} value={term(PHASE_TERMS[proposer.phase])} />
          <Field label={t('selectedValue')} value={proposer.selectedValue ?? '—'} />
          <Field label={t('retries')} value={proposer.retries} />
          <Field label={t('nacksReceived')} value={proposer.nacks.length} />
          {proposer.phase !== 'chosen' && (
            <button
              type="button"
              className="btn btn-small btn-block"
              onClick={() => retry(proposer.id)}
              disabled={proposer.status !== 'active'}
            >
              {t('retryHigherBallot')}
            </button>
          )}
        </div>
      )}

      {acceptor && (
        <>
          <div className="field-grid">
            <Field label={t('acceptorId')} value={acceptor.id} />
            <Field label={t('promisedBallot')} value={formatBallot(acceptor.promisedBallot)} />
            <Field label={t('acceptedBallot')} value={formatBallot(acceptor.acceptedBallot)} />
            <Field label={t('acceptedValue')} value={acceptor.acceptedValue ?? '—'} />
            <Field label={t('nodeStatus')} value={term(STATUS_TERMS[acceptor.status])} />
          </div>
          <h3 className="sub-head">{t('receivedMessages')}</h3>
          <MessageList items={acceptor.received} empty={t('emptyReceived')} />
          <h3 className="sub-head">{t('sentResponses')}</h3>
          <MessageList items={acceptor.sent} empty={t('emptySent')} />
        </>
      )}

      {learner && (
        <>
          <div className="field-grid">
            <Field label={t('learnerId')} value={learner.id} />
            <Field label={t('acceptedMessages')} value={learner.received.length} />
            <Field
              label={t('acceptedProposal')}
              value={
                learner.chosenBallot
                  ? `${formatBallot(learner.chosenBallot)} · ${learner.chosenValue ?? '—'}`
                  : learner.received.length > 0
                    ? `${formatBallot(learner.received[learner.received.length - 1].ballot)}`
                    : '—'
              }
            />
            <Field label={t('detectedChosen')} value={learner.chosenValue ?? '—'} />
          </div>
          <h3 className="sub-head">{t('receivedMessages')}</h3>
          <MessageList items={learner.received} empty={t('emptyLearned')} />
        </>
      )}
    </section>
  );
}
