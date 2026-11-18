import { useEffect } from 'react';
import { peekEvent } from '../core/network/event-queue';
import { useSimulationStore } from '../store/simulation-store';
import { getAnimationTime, setAnimationTime } from '../visualization/animation-clock';
import { Header } from '../components/layout/Header';
import { NetworkCanvas } from '../components/network/NetworkCanvas';
import { SimulationControls } from '../components/controls/SimulationControls';
import { ConfigurationPanel } from '../components/controls/ConfigurationPanel';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { NodeInspector } from '../components/inspectors/NodeInspector';
import { PacketInspector } from '../components/inspectors/PacketInspector';
import { ExplanationCard } from '../components/explanation/ExplanationCard';

/** virtual milliseconds of simulation advanced per real second at 1× speed */
const PLAYBACK_RATE = 420;

/**
 * Playback loop.
 *
 * Each frame advances the *display* clock and drains every event that became
 * due. The protocol engine is never driven by animation frames: if a frame is
 * dropped, the loop simply processes the same events a moment later.
 */
function usePlayback(): void {
  const isPlaying = useSimulationStore((store) => store.isPlaying);
  const speed = useSimulationStore((store) => store.speed);

  useEffect(() => {
    if (!isPlaying || typeof requestAnimationFrame !== 'function') return;

    let frame = 0;
    let last = performance.now();
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;
      const delta = Math.min(now - last, 120);
      last = now;

      const store = useSimulationStore.getState();
      const time = getAnimationTime() + (delta * PLAYBACK_RATE * store.speed) / 1000;

      // Process every event whose virtual time has been reached.
      for (let guard = 0; guard < 500; guard += 1) {
        const current = useSimulationStore.getState();
        const event = peekEvent(current.state.queue);
        if (!event || event.time > time) break;
        if (!current.advanceEvent()) break;
      }

      setAnimationTime(time);

      if (!useSimulationStore.getState().isPlaying) return;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    };
  }, [isPlaying, speed]);
}

export function App() {
  usePlayback();

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <aside className="col col-left">
          <ConfigurationPanel />
        </aside>

        <section className="col col-center">
          <NetworkCanvas />
          <ExplanationCard />
          <SimulationControls />
          <EventTimeline />
        </section>

        <aside className="col col-right">
          <NodeInspector />
          <PacketInspector />
        </aside>
      </main>
      <footer className="app-footer">
        Basic Paxos consensus simulator · runs entirely in your browser · no backend, no external
        API
      </footer>
    </div>
  );
}
