# Paxos Protocol Explorer

An interactive, **fully client-side** visual explorer for the Basic Paxos distributed consensus
algorithm. Configure a small cluster of proposers, acceptors and learners, run the protocol step by
step, watch real protocol messages fly across the network as animated packets, crash nodes, cut
links, partition the network, and inspect every byte of internal state.

There is **no backend**: every protocol decision, packet transmission and animation runs in the
browser. The production build is a folder of static files that can be hosted for free on GitHub
Pages.

> Live demo: enable GitHub Pages for this repository (see [Deployment](#deployment)) and open
> `https://<user>.github.io/<repo>/`.

---

## Table of contents

- [What it demonstrates](#what-it-demonstrates)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [How the simulation works](#how-the-simulation-works)
- [Basic Paxos in one page](#basic-paxos-in-one-page)
- [Using the application](#using-the-application)
- [Local installation](#local-installation)
- [Development commands](#development-commands)
- [Testing](#testing)
- [Production build](#production-build)
- [Deployment to GitHub Pages](#deployment-to-github-pages)
- [Repository configuration](#repository-configuration)
- [Implementation status](#implementation-status)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## What it demonstrates

- **Phase 1 (Prepare / Promise)** and **Phase 2 (Accept / Accepted)** as real message exchanges.
- **Quorum arithmetic** (`floor(N/2) + 1`) and the moment a value becomes **chosen** — derived from
  durable acceptor state, never from the fact that a proposer sent an `Accept`.
- **Competing proposers**: multiple proposers with globally ordered ballots `(round, proposerId)`,
  NACKs, preemption, retry with a higher ballot, and adoption of previously accepted values.
- **Failures**: crashed acceptors, crashed proposers, disabled links, network partitions, packet
  loss, dropped packets, restart with preserved durable state, and an intentionally *unsafe* mode
  that erases durable state on restart.
- **Animated packets**: every message is an individual SVG packet travelling along its link, with
  distinct colours and shapes per message type, clickable for inspection.
- **Reversible simulation**: step forward event by event and step backward through deterministic
  state snapshots.
- **Explanations**: each event in the timeline carries a short explanation of *why* it happened.

## Technology stack

| Layer                  | Technology                                        |
| ---------------------- | ------------------------------------------------- |
| Language               | TypeScript (strict)                               |
| UI framework           | React 18                                          |
| Build tool             | Vite 5                                            |
| State management       | Zustand                                           |
| Network visualisation  | SVG                                               |
| Packet animation       | SVG transforms driven by `requestAnimationFrame`  |
| Protocol / network     | Pure TypeScript (no React, no DOM)                |
| Unit & UI tests        | Vitest + React Testing Library (jsdom)            |
| Code quality           | ESLint (flat config) + Prettier                   |
| CI/CD                  | GitHub Actions                                    |
| Hosting                | GitHub Pages (static)                             |

Only three runtime dependencies are used: `react`, `react-dom` and `zustand`. No UI kit, no
animation library, no chart library, no backend SDK.

## Architecture

```
src/
├── app/
│   └── App.tsx                     # shell + playback loop
├── components/
│   ├── layout/Header.tsx
│   ├── network/                    # canvas, nodes, packets, legend
│   ├── controls/                   # transport + configuration panel
│   ├── inspectors/                 # node + packet inspectors
│   ├── timeline/EventTimeline.tsx
│   └── explanation/ExplanationCard.tsx
├── core/
│   ├── paxos/
│   │   ├── types.ts                # protocol state types
│   │   ├── ballot.ts               # total ordering of ballots
│   │   ├── quorum.ts               # quorum = floor(N/2)+1
│   │   ├── proposer.ts             # value selection, promise/NACK bookkeeping
│   │   ├── acceptor.ts             # Prepare/Promise, Accept/Accepted
│   │   ├── learner.ts              # quorum tally for learners
│   │   └── protocol-engine.ts      # chosen-value detection from acceptor state
│   ├── network/
│   │   ├── message.ts              # message = packet model
│   │   ├── event-queue.ts          # deterministic (time, seq) priority queue
│   │   ├── network-engine.ts       # pure transmission planning (latency/loss/links)
│   │   └── rng.ts                  # seeded PRNG (state lives in the snapshot)
│   ├── simulation/
│   │   ├── simulation-state.ts     # full state + factory from configuration
│   │   ├── simulation-engine.ts    # event processing, failures, partitions
│   │   └── snapshot-manager.ts     # bounded history for step-backward
│   └── i18n/terms.ts               # English/Persian terminology + concepts
├── visualization/
│   ├── animation-clock.ts          # display clock, separate from protocol time
│   └── topology.ts                 # node/link geometry, packet positions
├── store/simulation-store.ts       # Zustand store, user actions
├── styles/                         # organised CSS (theme, layout, canvas, timeline, inspectors)
└── main.tsx
tests/
├── paxos/paxos.test.ts
├── network/network.test.ts
├── simulation/simulation.test.ts
└── ui/app.test.tsx
```

The layering is deliberate and enforced by imports:

```
UI components → store → simulation engine → { protocol engine, network engine } → types
```

The protocol engine has **no knowledge of React, SVG or animation**. The animation layer only reads
timestamps recorded by the simulation.

## How the simulation works

### Deterministic discrete-event simulation

- A **virtual clock** and a **priority queue** of events ordered by `(virtualTime, sequence)` are
  the only drivers of protocol progress.
- Events are `start`, `deliver`, `retry` and `recover`. Processing an event may schedule more
  events.
- All randomness (jitter, packet loss) comes from a seeded PRNG whose **state is stored in the
  simulation state**. The same seed and configuration always reproduce the same run, down to the
  arrival time of every packet.

### Messages are packets

Sending a message records `sentAt`, `arriveAt`, status and payload, and schedules a `deliver` event.
The canvas interpolates a packet's position between those two timestamps using a separate display
clock. Animation can never affect protocol correctness: if a frame is skipped, playback simply
processes the same due events slightly later.

### Step forward and step backward

Every processed event (and every manual action such as crashing a node) appends a full state
snapshot to a bounded history (300 entries). Stepping backward restores the previous snapshot,
including the PRNG state, so stepping forward again replays exactly the same run — no CSS animation
is ever reversed.

### Chosen detection

`findQuorumValues()` scans the acceptors' durable `(acceptedBallot, acceptedValue)` pairs and returns
every proposal a quorum has accepted. A value is marked chosen only from that evidence. Multiple
quorum-reaching entries with different values would be recorded as a safety violation (the tests
assert this never happens).

## Basic Paxos in one page

1. **Prepare(n)** — a proposer asks all acceptors to promise ballot `n = (round, proposerId)`.
2. **Promise(n)** — an acceptor promises if `n` is at least its current promise. A lower ballot is
   answered with **NACK**. The promise reports any previously accepted `(ballot, value)`.
3. **Quorum** — once a strict majority promises, phase 2 may start.
4. **Value selection** — the proposer adopts the value of the **highest** accepted ballot it was
   told about; otherwise it uses its own value.
5. **Accept(n, v)** — the proposer asks the acceptors to accept `(n, v)`.
6. **Accepted(n, v)** — an acceptor that has not promised a higher ballot durably accepts and
   reports back to the proposer and to the learners.
7. **Chosen** — when a majority of acceptors accepted the same `(n, v)`, the value is chosen.

Safety comes from quorum intersection: any two majorities share at least one acceptor, so a value
that could have been chosen is always reported to the next proposer and must be adopted. Liveness is
not guaranteed: competing proposers can keep preempting each other (that is what the NACK/retry
visualisation shows), and a partition that leaves a proposer with a minority of acceptors can never
finish.

## Using the application

### Network canvas

- **Proposers** on the left, **acceptors** in the centre, **learners** on the right.
- Node cards show role, id, live protocol status (`promised 2.P1`, `accepted 1.P1`, `chosen …`).
- **Crashed** nodes are red and dashed, **recovering** nodes pulse amber.
- **Click a node** to open its inspector.
- **Click a link** to disable or restore communication between two nodes.
- **Click a packet** to inspect its payload, proposal number, timings and delivery status.

### Packet types

| Message  | Colour | Shape    |
| -------- | ------ | -------- |
| Prepare  | Blue   | Circle   |
| Promise  | Green  | Square   |
| Accept   | Orange | Diamond  |
| Accepted | Purple | Hexagon  |
| NACK     | Red    | Triangle |

Dropped packets fade out before reaching their destination and are marked as lost.

### Configuration

Network:

- Acceptors: 3, 5, 7 or 9.
- Proposers: 1–3 (each proposes a distinct value, derived from the configured value).
- Learners: 1–3.
- Network latency, packet delay (jitter), packet loss probability.
- Animation speed can be changed at any time.

Protocol:

- Proposal round (the first ballot round), proposed value, random seed.
- Auto-retry after NACK (with `ballot = max(round + 1, highest nacked round + 1)`).
- Optional unsafe recovery that forgets durable acceptor state.

Structural changes restart the simulation from a clean state; failure controls act on the running
simulation.

### Simulation controls

- **Play / Pause** — continuous playback at the current animation speed.
- **Step ▶** — process exactly one event (for example: "Proposer sends Prepare").
- **◀ Step** — restore the previous snapshot.
- **Reset** — restart with the current configuration.
- **Animation speed** — 0.25× to 3×.

### Failure experiments

- Crash an acceptor before Prepare: consensus still succeeds with a remaining quorum.
- Crash enough acceptors: the proposer stalls, and the status reads *Stalled — no quorum*.
- Crash after Promise, then recover: durable promises and accepted values are preserved.
- Enable **unsafe recovery**: state is erased on restart — the intentionally unsafe experiment.
- Disable a link, drop all in-flight packets, or partition the network: the minority side cannot
  reach a quorum.
- Use two or three proposers: watch NACKs, preemption, retry and eventual convergence on a single
  value.

## Local installation

Requirements: Node.js 20+ and npm.

```bash
npm install       # or: npm ci  (uses the lock file)
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`).

## Development commands

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with hot reload             |
| `npm test`        | Run the Vitest suite once                             |
| `npm run test:watch` | Run Vitest in watch mode                           |
| `npm run lint`    | Run ESLint over the whole project                     |
| `npm run format`  | Format with Prettier                                  |
| `npm run build`   | Type-check and build the static site into `dist/`     |
| `npm run preview` | Serve the production build locally                    |

## Testing

```bash
npm test
```

The suite covers:

- **Protocol**: consensus with 3, 5 and 7 acceptors; crash before Prepare; no quorum; durable state
  across crash and recovery; adoption of a previously accepted value by a new proposal; competing
  proposers; preemption; rejection of lower ballots; correct chosen detection (including the rule
  that identical values on different ballots do not count as one proposal).
- **Safety**: over many seeds with packet loss and two proposers, no two values are ever chosen, and
  an acceptor never accepts below its promise.
- **Network**: latency and jitter bounds, deterministic planning for a fixed seed, packet loss,
  disabled links, partitions, dropping in-flight packets, node recovery, ordered event delivery.
- **Simulation**: reversible snapshots (restoring the PRNG stream), bounded history, protocol status
  reporting, and reproducibility from a seed.
- **UI**: the app renders, stepping adds real timeline events, and selecting a node opens its
  inspector.

## Production build

```bash
npm run build
```

The output in `dist/` is a completely static site. Serve it with any static file server:

```bash
npm run preview
```

### Base path

GitHub Pages project sites are served from `/<repository>/`, so asset URLs need that prefix. Vite is
configured with a configurable base:

```bash
BASE_PATH=/my-repo/ npm run build
```

The default is `/paxos-protocol-explorer/`. For a user/organisation site (`<user>.github.io`) or a
custom domain, build with `BASE_PATH=/`.

## Deployment to GitHub Pages

The workflow at `.github/workflows/deploy.yml` runs on every push to `main` (and can be triggered
manually): install from the lock file → lint → test → build → upload `dist` → deploy with the
official GitHub Pages actions.

1. Create a public GitHub repository and push this project:

   ```bash
   git init
   git add .
   git commit -m "Paxos Protocol Explorer"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```

2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow from the **Actions** tab).
4. When the workflow finishes, open `https://<user>.github.io/<repo>/`.

No secrets, hosting account, database or server are required — only the repository's Pages settings.

## Repository configuration

- **Pages source** must be *GitHub Actions*.
- The base path defaults to the repository name automatically (`/${{ github.event.repository.name }}/`).
- To override it, create a repository **variable** named `BASE_PATH` (Settings → Secrets and
  variables → Actions → Variables), for example `/` for a custom domain or a user pages site.
- Node.js 20+ is required. The workflow caches npm downloads using the lock file.
- Optional: add a `.nojekyll` file to `public/` if you later serve pre-built assets with Jekyll
  processing enabled. The Pages artifact deployment used here does not need it.

## Implementation status

All milestones are implemented:

| Milestone | Status | Notes |
| --------- | ------ | ----- |
| 1. Project foundation | ✅ | React + TS + Vite, dark theme, responsive layout, static build |
| 2. Network topology | ✅ | Proposer/acceptor/learner columns, links, selection, inspectors |
| 3. Animated packets | ✅ | SVG packets per message, shapes and colours, click to inspect |
| 4. Network simulation | ✅ | Virtual clock, event queue, latency, jitter, loss, crashes, recovery |
| 5. Basic Paxos engine | ✅ | Prepare/Promise, Accept/Accepted, quorum, chosen detection, learners |
| 6. Advanced simulation | ✅ | Multiple proposers, preemption, retry, partitions, step backward, snapshots |
| 7. Testing and deployment | ✅ | 52 automated tests, lint, build, GitHub Actions workflow, README |

Verification performed in this repository:

- `npx tsc --noEmit` — clean.
- `npm test` — 52 tests passing across 4 files.
- `npm run lint` — clean.
- `npm run build` — static production build succeeds.

## Known limitations

- **Basic Paxos, one instance.** There is no Multi-Paxos log, leader election or log replication.
- **Liveness is not guaranteed.** Retry is NACK-driven with a fixed delay; duelling proposers can in
  principle keep preempting each other. Manual retry and a higher ballot break the deadlock, and
  learners stop the moment a value is chosen.
- **Crash recovery is time-based**, not driven by a separate durable-storage simulation; the unsafe
  mode is an intentionally exaggerated experiment.
- **Visual scale.** With 9 acceptors and 3 proposers the canvas is dense; packet lanes reduce
  overlap but a larger viewport helps.
- **Localisation** covers protocol terminology, node roles, statuses and phases (English + Persian).
  Full UI translation would extend `src/core/i18n/terms.ts`.
- No end-to-end browser automation in CI; the UI is covered by React Testing Library in jsdom.

## Roadmap

- Multi-Paxos / replicated log with slots.
- Explicit timeout events with configurable per-attempt deadlines.
- Learner catch-up messages (`learn` RPC) instead of acceptor fan-out.
- Timeline filtering and export of a run as JSON.
- Shareable permalinks (configuration encoded in the URL hash).
- Full localisation including RTL layout for Persian.
- Playback "replay from here" and snapshot branching.

---

Built as a static educational simulator: no backend, no database, no external API at runtime.
