import { formatBallot } from '../../core/paxos/ballot';
import { MESSAGE_META } from '../../core/i18n/terms';
import { useI18n } from '../../i18n/useI18n';
import { useSimulationStore } from '../../store/simulation-store';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-row">
      <span className="field-key">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

export function PacketInspector() {
  const state = useSimulationStore((store) => store.state);
  const selectedPacketId = useSimulationStore((store) => store.selectedPacketId);
  const { t, term, time, reason, messageType } = useI18n();

  const packet = state.messages.find((message) => message.id === selectedPacketId);

  if (!packet) {
    return (
      <section className="panel inspector-panel">
        <div className="panel-head compact">
          <h2>{t('packetInspector')}</h2>
        </div>
        <p className="hint">{t('packetHint')}</p>
      </section>
    );
  }

  const typeLabel = messageType(packet.type);
  const meta = MESSAGE_META[packet.type];
  const payload = JSON.stringify(
    {
      type: typeLabel,
      ballot: formatBallot(packet.ballot),
      value: packet.value,
      acceptedBallot: packet.acceptedBallot ? formatBallot(packet.acceptedBallot) : null,
      acceptedValue: packet.acceptedValue,
      ...(packet.reason ? { reason: reason(packet.reason) } : {}),
    },
    null,
    2,
  );

  const transmission =
    packet.status === 'inflight'
      ? t('inFlight')
      : packet.status === 'delivered'
        ? t('delivered')
        : t('lost');

  return (
    <section className="panel inspector-panel">
      <div className="panel-head compact">
        <h2>
          {t('packet')} <span className="mono">{packet.id}</span>
        </h2>
        <span className="packet-type" style={{ color: meta.color }}>
          {typeLabel}
        </span>
      </div>

      <div className="field-grid">
        <Field label={t('messageType')} value={typeLabel} />
        <Field label={t('sourceNode')} value={packet.from} />
        <Field label={t('destinationNode')} value={packet.to} />
        <Field label={t('proposalNumber')} value={formatBallot(packet.ballot)} />
        <Field label={t('valueField')} value={packet.value ?? '—'} />
        <Field label={t('createdAt')} value={time(packet.sentAt)} />
        <Field label={t('transmission')} value={transmission} />
        <Field
          label={t('delivery')}
          value={
            packet.status === 'delivered'
              ? t('deliveredAt', { time: time(packet.arriveAt) })
              : packet.status === 'dropped'
                ? t('droppedAt', {
                    reason: reason(packet.dropReason ?? { code: 'rejected' }),
                  })
                : t('expectedAt', { time: time(packet.arriveAt) })
          }
        />
        <Field
          label={t('networkLatency')}
          value={time(packet.arriveAt - packet.sentAt)}
        />
      </div>

      <h3 className="sub-head">{t('payload')}</h3>
      <pre className="payload">{payload}</pre>
      <p className="hint small">{term(meta.hint)}</p>
    </section>
  );
}
