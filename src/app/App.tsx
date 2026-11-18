import { useEffect } from 'react';
import { peekEvent } from '../core/network/event-queue';
import { isRtl } from '../core/i18n/lang';
import { useI18n } from '../i18n/useI18n';
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

/** Keep the document language and writing direction in sync with the UI. */
function useDocumentLanguage(): void {
  const lang = useSimulationStore((store) => store.language);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = isRtl(lang) ? 'rtl' : 'ltr';
  }, [lang]);
}

export function App() {
  usePlayback();
  useDocumentLanguage();
  const { t } = useI18n();

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
      <footer className="app-footer">{t('footer')}</footer>
    </div>
  );
}
