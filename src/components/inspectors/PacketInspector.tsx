import { MESSAGE_META, formatTime } from '../../core/i18n/terms';
import { formatBallot } from '../../core/paxos/ballot';
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
  const showPersian = useSimulationStore((store) => store.showPersian);

  const packet = state.messages.find((message) => message.id === selectedPacketId);

  if (!packet) {
    return (
      <section className="panel inspector-panel">
        <div className="panel-head compact">
          <h2>Packet inspector</h2>
        </div>
        <p className="hint">
          Click a travelling packet (or an event in the timeline) to inspect its payload,
          transmission and delivery status.
        </p>
      </section>
    );
  }

  const meta = MESSAGE_META[packet.type];
  const payload = JSON.stringify(
    {
      type: packet.type,
      ballot: formatBallot(packet.ballot),
      value: packet.value,
      acceptedBallot: packet.acceptedBallot ? formatBallot(packet.acceptedBallot) : null,
      acceptedValue: packet.acceptedValue,
      ...(packet.reason ? { reason: packet.reason } : {}),
    },
    null,
    2,
  );

  const transmission =
    packet.status === 'inflight' ? 'In flight' : packet.status === 'delivered' ? 'Delivered' : 'Lost';

  return (
    <section className="panel inspector-panel">
      <div className="panel-head compact">
        <h2>
          Packet <span className="mono">{packet.id}</span>
        </h2>
        <span className="packet-type" style={{ color: meta.color }}>
          {meta.en}
          {showPersian ? ` · ${meta.fa}` : ''}
        </span>
      </div>

      <div className="field-grid">
        <Field label="Message type" value={meta.en} />
        <Field label="Source node" value={packet.from} />
        <Field label="Destination node" value={packet.to} />
        <Field label="Proposal number" value={formatBallot(packet.ballot)} />
        <Field label="Value" value={packet.value ?? '—'} />
        <Field label="Created at" value={formatTime(packet.sentAt)} />
        <Field label="Transmission" value={transmission} />
        <Field
          label="Delivery"
          value={
            packet.status === 'delivered'
              ? `at ${formatTime(packet.arriveAt)}`
              : packet.status === 'dropped'
                ? `dropped — ${packet.dropReason ?? 'unknown'}`
                : `expected ${formatTime(packet.arriveAt)}`
          }
        />
        <Field label="Network latency" value={`${Math.round(packet.arriveAt - packet.sentAt)} ms`} />
      </div>

      <h3 className="sub-head">Payload</h3>
      <pre className="payload">{payload}</pre>
      <p className="hint small">{meta.hint}</p>
    </section>
  );
}
