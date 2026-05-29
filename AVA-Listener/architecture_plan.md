# AVAListener — Final Execution Plan (v4)
## Architecture Through Controlled Complexity

> **Mandate:** `extract → isolate → stabilize → modularize → extend`
> The current engine works. Preserve it. Build the platform around it.

---

## PART A — PRIORITY CLASSIFICATION

### 🟢 TIER 1: FOUNDATIONAL NOW (V1 — Real Implementations)

| # | Subsystem | Path |
|---|-----------|------|
| 1 | Supervisor Process | `runtime/supervisor/` |
| 2 | Runtime Kernel | `runtime/kernel/` |
| 3 | Internal Event Bus + Contracts | `runtime/events/` |
| 4 | Session System | `runtime/session/` |
| 5 | WebSocket Transport (WS only) | `runtime/transport/` |
| 6 | Control / Data Plane Split | `runtime/transport/control/` + `runtime/transport/stream/` |
| 7 | Message Schema Versioning | `runtime/transport/protocol/schemas/` |
| 8 | Linear Pipeline | `runtime/pipeline/linear.py` |
| 9 | Audio Backend Abstraction (minimal) | `runtime/audio/backends/` ← **PROMOTED from Stub** |
| 10 | VAD Providers (Silero + WebRTC) | `runtime/vad/providers/` |
| 11 | ASR Provider (Sherpa) | `runtime/asr/providers/sherpa.py` |
| 12 | Matcher Engine + Contracts | `runtime/matcher/` + `runtime/matcher/contracts/` |
| 13 | Resource Manager + Memory Budget | `runtime/resources/` |
| 14 | Structured Logging | `runtime/logging/` |
| 15 | Timing / RuntimeClock | `runtime/timing/` |
| 16 | Config Schema + Loader | `runtime/config/` |
| 17 | Runtime Manifest | `runtime/manifest/` |
| 18 | Security Boundaries | `runtime/security/` |
| 19 | Subsystem State FSMs | Per-subsystem `_state.py` |
| 20 | Health Score System | `runtime/health/` |
| 21 | Crash Snapshot | `runtime/debug/crash_snapshot.py` |
| 22 | Realtime Priority Hierarchy | `runtime/events/priority.py` |
| 23 | Node SDK (full core) | `node/` |
| 24 | Node SDK State Machine | `node/state_machine.js` |
| 25 | Audio Fixture System | `tests/fixtures/audio/` |

### 🔵 TIER 2: EXTENSION POINTS (Stubs/Interfaces Only — NOT in V1)

| Subsystem | Path | What Ships |
|-----------|------|------------|
| Pipeline DAG Engine | `runtime/pipeline/graph/` | `GraphExecutor` ABC |
| Plugin SDK | `runtime/plugins/` | `PluginBase` ABC |
| Distributed Runtime | `runtime/distributed/` | README placeholder |
| Replay Engine | `runtime/debug/replay/` | `ReplayBuffer` dataclass |
| Persistence / Storage | `runtime/storage/` | `CacheStore` ABC |
| Alternative Transports | `runtime/transport/transports/` | `TransportAdapter` ABC |
| Advanced Scheduling | `runtime/kernel/scheduling/` | `PriorityLevel` enum |
| Telemetry Sinks | `runtime/telemetry/sinks/` | `TelemetrySink` ABC |
| State Snapshots (full) | `runtime/debug/snapshots/` | `Snapshot` dataclass |
| Feature Flags | `runtime/features/` | `FeatureRegistry` dict |
| Live Config Patching | `runtime/config/live/` | `LiveConfigPatch` dataclass |
| Diagnostic Modes | `runtime/modes/` | `RuntimeMode` enum |

---

## PART B — MVP DEFINITION (Scope Firewall)

The first stable AVAListener release guarantees **exactly this, nothing more:**

```
✅ Wake detection
✅ Configurable phrases + per-phrase variants
✅ WebSocket API (Node SDK ↔ Supervisor ↔ Runtime)
✅ Node.js AVAListener class with EventEmitter API
✅ Auto model download + SHA256 verification
✅ Process supervision + crash recovery
✅ Structured logs with session/correlation IDs
✅ Diagnostics API (latency, memory, health score)
✅ Capability negotiation handshake
✅ Restart recovery with throttling

❌ Plugin system
❌ DAG pipeline engine
❌ Distributed/multi-session runtime
❌ Replay persistence
❌ Alternative transports (gRPC, pipes, etc.)
❌ Hot config patching
❌ Advanced audio backends (WASAPI, CoreAudio)
```

---

## PART C — ARCHITECTURE ADDITIONS

### C.1 Supervisor Process Layer (CRITICAL ADDITION)

The runtime topology is now **three-tier**, not two-tier:

```
Node SDK
   ↕  WebSocket (control plane)
Supervisor Process                ← New mandatory layer
   ↕  IPC / subprocess
Runtime Worker Process            ← Existing engine lives here
```

**Why this matters:**
- ONNX deadlocks kill the Worker, not the Supervisor
- Audio backend freezes are isolated to the Worker
- Node SDK never sees a raw crash — Supervisor handles recovery
- Supervisor enforces restart throttling (no crash loops)

**Supervisor responsibilities:**
- Spawn Runtime Worker with correct config
- Monitor Worker heartbeat (miss 3 → restart)
- Enforce restart policy (max 5 restarts / 60s → fatal)
- Forward control messages from Node SDK to Worker
- Forward events from Worker to Node SDK
- Clean resource teardown on shutdown

```
runtime/supervisor/
├── supervisor.py        # Entry point + IPC coordination
├── watchdog.py          # Heartbeat monitor
├── restart_policy.py    # Throttle + backoff + max-restart logic
├── health_monitor.py    # Aggregate Worker health signals
└── heartbeat.py         # Emitter (Worker side) + checker (Supervisor side)
```

### C.2 Control Plane vs Data Plane Separation

Even over a single WebSocket connection, messages are architecturally separated:

**CONTROL PLANE** — Low-frequency, reliability-critical:
```
handshake / handshake_ack
configure
start / stop / pause / resume
diagnostics_request / diagnostics_response
error / fatal
```

**DATA PLANE** — High-frequency, drop-tolerant:
```
partial_transcript
wake_candidate
vad_metrics
telemetry
audio_stats
```

```
runtime/transport/
├── control/
│   ├── handler.py       # Routes control messages to Kernel dispatcher
│   └── messages.py      # Control message dataclasses
├── stream/
│   ├── handler.py       # Routes stream events to transport send queue
│   └── messages.py      # Stream message dataclasses
└── protocol/
    ├── handshake.py
    ├── version.py
    └── schemas/         # Per-message schema versioning + validators
```

### C.3 Message Schema Versioning

Every message includes a `schemaVersion` field:

```json
{
  "type": "wake",
  "schemaVersion": 1,
  "sessionId": "sess_abc123",
  "correlationId": "corr_xyz",
  "payload": {
    "phrase": "hey computer",
    "confidence": 0.87,
    "latencyMs": 142.3
  }
}
```

`runtime/transport/protocol/schemas/` contains:
- Per-type schema validators (Pydantic models)
- Schema migration functions for forward compatibility
- A schema version registry mapping `type + schemaVersion → validator`

### C.4 Audio Device Abstraction — PROMOTED TO TIER 1

Audio backends are no longer a stub. Cross-platform reality demands this from V1.

**`AudioBackend` interface** (all backends must implement):
```python
class AudioBackend(ABC):
    def enumerate_devices(self) -> list[AudioDevice]: ...
    def open_stream(self, device_id, sample_rate, block_size) -> AudioStream: ...
    def close_stream(self) -> None: ...
    def on_device_removed(self, callback) -> None: ...  # Hot-swap support
```

**V1 ships one concrete implementation:**
- `runtime/audio/backends/portaudio.py` — wraps sounddevice

**Stubs created but not implemented:**
- `runtime/audio/backends/wasapi.py`
- `runtime/audio/backends/coreaudio.py`
- `runtime/audio/backends/pulseaudio.py`

**Device handling in V1:**
- Enumerate and select default device at startup
- Detect device removal → emit `audio.device_lost` event
- Kernel attempts reconnect via `audio.backends` on recovery

### C.5 Formal Subsystem State FSMs

Every major subsystem has its own lifecycle state, independent of the runtime-wide state:

```
INITIALIZING → READY → RUNNING → DEGRADED → RECOVERING → FAILED
                                              ↑______________|
```

Applied to: `VAD`, `ASR`, `Transport`, `Audio`, `Matcher`, `Supervisor`

The Kernel aggregates per-subsystem states to compute overall `runtimeHealth`.

`Runtime READY` does **not** imply all subsystems healthy. That distinction is surfaced explicitly in the diagnostics API.

### C.6 Health Score System

```
runtime/health/
├── scorer.py       # Aggregates subsystem states → float 0.0–1.0
├── signals.py      # Named health signals (queue_overruns, vad_lag, etc.)
└── reporter.py     # Formats health report for diagnostics API
```

**Computed from:**
- Audio queue overrun rate
- VAD / ASR processing lag vs real-time
- Memory pressure level
- Restart frequency in last 60s
- Transport latency to Node SDK
- Dropped wake candidate events (always 0 in healthy state)

**Emitted as part of diagnostics response:**
```json
{
  "runtimeHealth": 0.91,
  "subsystems": {
    "vad": "RUNNING",
    "asr": "RUNNING",
    "audio": "DEGRADED",
    "transport": "RUNNING"
  }
}
```

### C.7 Crash Snapshot System — Promoted to V1

Debugging realtime systems without snapshots is unacceptable.

**`runtime/debug/crash_snapshot.py`** captures at crash moment:
- Audio queue depth
- VAD internal state (Silero h/c vectors)
- Current ASR hypothesis + stability count
- EMA confidence state
- Last 10 matcher scores
- Memory usage per budget zone
- Active session ID + uptime

Snapshot is serialized to JSON and emitted over the control plane as a `crash_report` message, forwarded to Node SDK for optional file dump.

### C.8 Matcher Contracts

```
runtime/matcher/contracts/
├── candidates.py    # MatchCandidate, MatchScore dataclasses
├── decisions.py     # StabilizedDecision, WakeDecision dataclasses
└── pipeline.py      # MatchPipeline ABC
```

**Dataclasses:**
```python
@dataclass
class MatchCandidate:
    text: str
    stability: int
    generation_id: int

@dataclass
class MatchScore:
    phrase: str
    raw_score: float
    fuzzy_score: float
    anchor_score: float
    variant_matched: str

@dataclass
class WakeDecision:
    phrase: str
    raw_confidence: float
    smooth_confidence: float
    threshold: float
    triggered: bool
    suppressed_reason: str | None
```

All future matchers, scorers, and ensemble pipelines operate on these contracts. No ad-hoc dict passing.

### C.9 Realtime Event Priority Hierarchy

```
runtime/events/priority.py
```

```python
class EventPriority(IntEnum):
    CRITICAL = 0   # wake, fatal_error → never dropped, always dispatched first
    HIGH     = 1   # speech_start, speech_end, error
    NORMAL   = 2   # partial_transcript, wake_candidate
    LOW      = 3   # telemetry, vad_metrics, audio_stats
```

**Enforcement rules:**
- Event bus ring queue is priority-ordered
- When queue approaches capacity: LOW events dropped first, NORMAL second
- CRITICAL events bypass queue limits entirely (separate dedicated channel)
- Transport layer respects same hierarchy for WS send ordering

### C.10 Security Boundaries (Cross-Cutting)

```
runtime/security/
├── enforcer.py     # Localhost-only binding validator
├── tokens.py       # Session token generation + validation
├── validator.py    # Config schema + message size limits
└── limits.py       # Queue depth caps, payload size limits
```

**Rules enforced in V1:**
- Runtime binds to `127.0.0.1` only. Any attempt to bind externally → immediate fatal shutdown.
- WebSocket connection requires session token (passed as process argument by Supervisor, forwarded via Node SDK).
- All incoming messages validated against schema before processing. Malformed → silent drop + `security.validation_error` metric.
- Maximum message size: 64KB. Exceeded → connection terminated.
- Config payload validated against Pydantic schema before any subsystem sees it.

### C.11 Runtime Manifest

```
runtime/manifest/
└── manifest.py     # Generates + validates runtime manifest JSON
```

```json
{
  "runtimeVersion": "0.1.0",
  "protocolVersion": 1,
  "platform": { "os": "windows", "arch": "x64", "python": "3.11.9" },
  "models": [
    { "name": "sherpa-zipformer", "version": "2023-06-26", "format": "onnx" },
    { "name": "silero-vad", "version": "v5", "format": "onnx" }
  ],
  "capabilities": {
    "gpu_available": false,
    "streaming_asr": true,
    "dynamic_config": true,
    "multi_session": false,
    "phonetic_matching": true
  },
  "buildMetadata": { "builtAt": "...", "gitSha": "..." }
}
```

Manifest is emitted as part of the capability handshake and queryable via diagnostics API.

### C.12 Node SDK State Machine

```
node/state_machine.js
```

```
UNINITIALIZED
    → INSTALLING     (model download in progress)
    → STARTING       (Supervisor spawned, Worker booting)
    → CONNECTING     (WebSocket handshake in progress)
    → READY          (handshake complete, pipeline warm)
    → RUNNING        (active detection)
    → RECOVERING     (Worker crashed, Supervisor restarting)
    → STOPPED        (clean shutdown)
    → FAILED         (max restarts exceeded or fatal error)
```

**Rules:**
- All public API calls (`start()`, `pause()`, `stop()`) check state validity first
- Invalid state transitions emit `"error"` event with descriptive message
- `RECOVERING` state is transparent to most users but observable via `"recovering"` event
- `FAILED` state requires explicit `listener.reset()` before retry

### C.13 Audio Fixture + Regression System

```
tests/
├── fixtures/
│   └── audio/
│       ├── clean_wake/        # Clear "hey computer" utterances
│       ├── noisy_wake/        # Background noise + wakeword
│       ├── false_positives/   # TV speech, similar words
│       ├── silence/           # Silence, very low RMS
│       └── accented/          # Different accent variations
└── replay/
    ├── runner.py              # Feeds fixture audio through pipeline
    ├── comparator.py          # Compares output vs expected manifest
    └── fixtures/
        └── *.json             # { "audio": "path", "expect_wake": true, "min_confidence": 0.72 }
```

**This becomes the regression firewall.** Before any matcher/VAD/ASR change is merged, replay tests must pass 100%.

### C.14 Clock Synchronization Rule (Enforced)

All timing in the runtime uses `RuntimeClock` exclusively:

```python
# ✅ CORRECT — always
from runtime.timing.clock import RuntimeClock
clock = RuntimeClock.instance()
t = clock.now()          # monotonic ns
elapsed = clock.elapsed_ms(t)

# ❌ FORBIDDEN — anywhere inside runtime/
import time
time.time()              # → grep CI gate flags this
time.monotonic()         # → same
datetime.now()           # → same
```

A CI grep check will flag any direct `time.time()` / `time.monotonic()` / `datetime.now()` inside `runtime/` as a build warning.

---

## PART D — FINAL DIRECTORY STRUCTURE (v4)

```text
ava-listener/
├── package.json
├── pyproject.toml
├── README.md
│
├── node/                               # 🟢 Node SDK
│   ├── index.js                        # Exports AVAListener
│   ├── listener.js                     # AVAListener class + EventEmitter
│   ├── state_machine.js                # Node SDK FSM (NEW)
│   ├── supervisor.js                   # Supervisor process bridge
│   ├── process_manager.js              # Spawns Supervisor
│   ├── transport.js                    # WebSocket client
│   ├── model_manager.js                # Download + verify models
│   ├── config_validator.js             # Config schema validation
│   ├── protocol/
│   │   ├── handshake.js
│   │   ├── messages.js
│   │   └── version.js
│   └── utils/
│       ├── logger.js
│       └── retry.js
│
├── runtime/
│   ├── main.py                         # Bootstrapper → spawns Supervisor
│   │
│   ├── supervisor/                     # 🟢 Supervisor Layer (NEW - Tier 1)
│   │   ├── supervisor.py
│   │   ├── watchdog.py
│   │   ├── restart_policy.py
│   │   ├── health_monitor.py
│   │   └── heartbeat.py
│   │
│   ├── kernel/                         # 🟢 Runtime Kernel
│   │   ├── orchestrator.py
│   │   ├── lifecycle.py                # Runtime-wide FSM
│   │   ├── dispatcher.py
│   │   ├── runtime_state.py
│   │   ├── startup.py
│   │   ├── shutdown.py
│   │   └── scheduling/                 # 🔵 [STUB]
│   │       └── __init__.py
│   │
│   ├── pipeline/                       # 🟢 Linear Pipeline
│   │   ├── linear.py                   # mic→vad→asr→matcher→event
│   │   ├── nodes.py                    # PipelineNode base
│   │   └── graph/                      # 🔵 [STUB] DAG
│   │       └── executor.py
│   │
│   ├── session/                        # 🟢 Session Abstraction
│   │   ├── manager.py
│   │   └── context.py
│   │
│   ├── events/                         # 🟢 Event Bus
│   │   ├── bus.py
│   │   ├── emitter.py
│   │   ├── priority.py                 # EventPriority enum (NEW)
│   │   ├── types.py
│   │   └── contracts/
│   │       ├── audio.py
│   │       ├── vad.py
│   │       ├── asr.py
│   │       ├── matcher.py
│   │       └── system.py
│   │
│   ├── transport/                      # 🟢 Transport
│   │   ├── websocket_server.py
│   │   ├── control/                    # (NEW) Control plane
│   │   │   ├── handler.py
│   │   │   └── messages.py
│   │   ├── stream/                     # (NEW) Data plane
│   │   │   ├── handler.py
│   │   │   └── messages.py
│   │   ├── protocol/
│   │   │   ├── handshake.py
│   │   │   ├── version.py
│   │   │   └── schemas/                # (NEW) Per-message versioned validators
│   │   ├── security/
│   │   │   ├── token.py
│   │   │   └── enforcer.py
│   │   └── transports/                 # 🔵 [STUB]
│   │       └── base.py
│   │
│   ├── audio/                          # 🟢 Audio
│   │   ├── stream.py
│   │   ├── realtime/
│   │   │   └── ring_buffer.py
│   │   └── backends/                   # 🟢 PROMOTED TO TIER 1
│   │       ├── base.py                 # AudioBackend ABC
│   │       ├── portaudio.py            # V1 implementation
│   │       ├── wasapi.py               # 🔵 [STUB]
│   │       ├── coreaudio.py            # 🔵 [STUB]
│   │       └── pulseaudio.py           # 🔵 [STUB]
│   │
│   ├── vad/
│   │   ├── pipeline.py
│   │   └── providers/
│   │       ├── base.py
│   │       ├── silero.py
│   │       └── webrtc.py
│   │
│   ├── asr/
│   │   ├── streaming.py
│   │   └── providers/
│   │       ├── base.py
│   │       └── sherpa.py
│   │
│   ├── matcher/                        # 🟢 With Contracts (EXPANDED)
│   │   ├── engine.py
│   │   ├── ema.py
│   │   ├── cooldown.py
│   │   ├── variants.py
│   │   ├── contracts/                  # (NEW)
│   │   │   ├── candidates.py
│   │   │   ├── decisions.py
│   │   │   └── pipeline.py
│   │   ├── scorers/
│   │   │   ├── base.py
│   │   │   ├── fuzzy.py
│   │   │   └── phonetic.py
│   │   ├── pipelines/                  # 🔵 [STUB]
│   │   └── ensembles/                  # 🔵 [STUB]
│   │
│   ├── models/
│   │   ├── registry.py
│   │   ├── verifier.py
│   │   └── cache.py
│   │
│   ├── config/
│   │   ├── schema.py
│   │   ├── defaults.py
│   │   ├── loader.py
│   │   ├── versioning.py
│   │   ├── migrations/                 # 🔵 [STUB]
│   │   └── live/                       # 🔵 [STUB]
│   │       └── patch.py
│   │
│   ├── resources/
│   │   ├── pools.py
│   │   ├── budget.py
│   │   └── cleanup.py
│   │
│   ├── security/                       # 🟢 Cross-cutting security (NEW)
│   │   ├── enforcer.py
│   │   ├── tokens.py
│   │   ├── validator.py
│   │   └── limits.py
│   │
│   ├── health/                         # 🟢 Health Score System (NEW)
│   │   ├── scorer.py
│   │   ├── signals.py
│   │   └── reporter.py
│   │
│   ├── manifest/                       # 🟢 Runtime Manifest (NEW)
│   │   └── manifest.py
│   │
│   ├── logging/
│   │   ├── logger.py
│   │   ├── context.py
│   │   ├── formatters.py
│   │   └── sinks.py
│   │
│   ├── timing/
│   │   ├── clock.py                    # RuntimeClock singleton
│   │   └── latency.py
│   │
│   ├── debug/
│   │   ├── crash_snapshot.py           # 🟢 PROMOTED TO TIER 1
│   │   ├── snapshots/                  # 🔵 [STUB]
│   │   └── replay/                     # 🔵 [STUB]
│   │
│   ├── plugins/                        # 🔵 [STUB]
│   ├── features/                       # 🔵 [STUB]
│   ├── modes/                          # 🔵 [STUB]
│   ├── telemetry/                      # 🔵 [STUB — counters only]
│   ├── storage/                        # 🔵 [STUB]
│   └── distributed/                    # 🔵 [STUB]
│
├── models/
│   └── manifests/
│
├── distributions/                      # 🔵 [STUB]
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   │   └── audio/                      # 🟢 Audio fixture system
│   ├── replay/                         # 🟢 Regression firewall
│   ├── latency/
│   ├── soak/
│   └── memory/
│
└── docs/
    ├── architecture/
    ├── api/
    │   └── stability.md
    ├── guides/
    └── tuning/
```

---

## PART E — STAGED IMPLEMENTATION SEQUENCE

| Stage | Focus | Exit Criteria |
|-------|-------|---------------|
| **1 — Restructure** | Create skeleton. Move files verbatim. Create all stubs. | All imports resolve. Wake behavior 100% preserved. |
| **2 — Kernel + Event Bus** | Lifecycle FSM. Event bus with typed contracts. | Wake events flow through bus. No direct cross-module calls. |
| **3 — Supervisor + Transport** | Supervisor watchdog. WS server. Protocol handshake. Retire stdin/stdout IPC. | `listener.start()` connects over WS. Crash → auto recovery. |
| **4 — Node SDK** | Full Node SDK. Model download. State machine. Public API. | `npm install && node example.js` works end-to-end. |
| **5 — Observability** | Structured logging. Latency tracking. Health score. Crash snapshots. | Diagnostics API returns real metrics. Simulated crash → clean snapshot. |
| **6 — Extensions** | Plugins, DAG, persistence, advanced transports. | Post-stabilization only. |

---

## PART F — HARD ENGINEERING RULES (SUMMARY)

```
AUDIO THREAD:   capture + enqueue ONLY. No logs. No locks. No inference.
EVENT BUS:      typed dataclasses only. No json.dumps in realtime path.
CLOCK:          RuntimeClock everywhere. time.time() inside runtime/ = CI warning.
OWNERSHIP:      every resource has exactly one owner. Documented.
BACKPRESSURE:   LOW drops first. CRITICAL never drops. All queues have overflow policy.
FAILURES:       every failure is classified: Recoverable/Restartable/Isolated/Fatal.
SECURITY:       localhost-only. Token auth. Schema validation. Size limits.
MVP:            scope = wake + config + WS API + Node SDK + supervision + logs + diagnostics.
MIGRATION:      copy → wrap → test → verify → refactor. Never delete before replacement proven.
```

---

> **The architecture is now ready to begin Stage 1.**
> The challenge is no longer architectural weakness. It is implementation discipline.
> Scope creep during execution is the only remaining risk.

---

---

# PART G — PUBLIC SDK API CONTRACT (v5 Addition)
## The SDK API is the Real Product. The Runtime is Infrastructure.

> All sections below are additive to Parts A–F. No prior content is modified.

---

## G.1 — Public Lifecycle API

The Node SDK exposes six lifecycle methods. These are the **entire public control surface**. Every one has formal semantics, idempotency rules, and a corresponding lifecycle event.

### Files
- `node/lifecycle.js` — method implementations
- `node/state_machine.js` — enforces valid transitions
- `docs/api/lifecycle.md` — canonical reference

---

### `await listener.start()`

**Guarantees** (in sequence — resolves only when ALL complete):
1. Config validated against schema
2. Models verified (SHA256 checksums pass)
3. Supervisor process spawned
4. Runtime Worker spawned by Supervisor
5. WebSocket server bound on localhost ephemeral port
6. Protocol handshake complete (capabilities exchanged)
7. Audio device opened and streaming
8. VAD initialized and warm
9. ASR model loaded and first stream ready
10. Detection loop active

**Emits:** `"starting"` → (each step progresses) → `"ready"` → `"running"`

**Throws if:** already `RUNNING`, models missing and download fails, no audio device found, handshake timeout exceeded.

---

### `await listener.pause()`

**Semantics:** Soft pause. Detection is gated. Nothing tears down.

**What stays alive:**
- WebSocket connection
- Audio capture thread
- VAD pipeline (optionally stays warm — configurable)
- ASR stream (stays open, context preserved)
- Supervisor + Worker processes

**What stops:**
- Matcher evaluation
- Wake event emission

**Why:** Preserves LSTM context. Avoids cold-boot latency on resume. Identical to the current `engine._detection_paused = True` but formalized.

**Emits:** `"paused"`

**Idempotency:** `pause()` while already `PAUSED` → **no-op**, no event emitted.

---

### `await listener.resume()`

**Semantics:** Returns to `RUNNING` without cold boot.

**Guarantees:** Detection active within one audio block after call resolves.

**Emits:** `"resumed"` → `"running"`

**Idempotency:** `resume()` while already `RUNNING` → **no-op**.

---

### `await listener.stop()`

**Graceful shutdown sequence (ordered):**
1. Matcher paused (no new wake events)
2. ASR stream finalized
3. VAD pipeline stopped
4. Audio capture closed
5. Pending transport events flushed
6. WebSocket connection closed
7. Runtime Worker signaled to terminate
8. Supervisor awaits Worker exit (timeout: 5s, then SIGKILL)
9. Supervisor terminates cleanly

**Transitions:** `RUNNING → STOPPING → STOPPED`

**Emits:** `"stopping"` → `"stopped"`

**Idempotency:** `stop()` while already `STOPPED` → **no-op**.

**Timeout:** Each step has a defined timeout. If a step exceeds it, the next step proceeds anyway. The final supervisor SIGKILL is always guaranteed.

---

### `await listener.restart()`

**Semantics:** Equivalent to `stop()` followed by `start()`, but with these guarantees:

- All `on(...)` listeners are **preserved**
- User config is **preserved**
- Session diagnostics counters **optionally reset** (controlled by `restartOptions.resetDiagnostics`)
- Emits full lifecycle sequence: `"stopping"` → `"stopped"` → `"starting"` → `"ready"` → `"running"`

**Emits:** `"restarting"` at the beginning of the sequence.

**Use case:** Supervisor-triggered recovery, user-requested reset, config update requiring full restart.

---

### `listener.destroy()`

**Semantics:** Permanent. Instance is invalidated after this call.

**Sequence:**
1. Calls `stop()` if not already stopped
2. Removes all event listeners
3. Deletes temporary runtime files (if any)
4. Invalidates internal references
5. Marks instance as `DESTROYED`

**After `destroy()`:**
- `listener.start()` → throws `Error: AVAListener instance has been destroyed`
- All other methods → throw same error

**Emits:** `"destroyed"` (last event ever emitted by this instance)

**Idempotency:** `destroy()` twice → **safe no-op** on second call.

---

## G.2 — Idempotency Rules

Enforced in `node/state_machine.js`. No silent failures — every violation is logged at WARN level.

| Call | While In State | Result |
|------|---------------|--------|
| `start()` | `RUNNING` | Throws `AlreadyRunningError` |
| `start()` | `STARTING` | Throws `AlreadyStartingError` |
| `start()` | `DESTROYED` | Throws `DestroyedError` |
| `pause()` | `PAUSED` | No-op (no event) |
| `pause()` | `STOPPED` | Throws `NotRunningError` |
| `resume()` | `RUNNING` | No-op (no event) |
| `resume()` | `STOPPED` | Throws `NotRunningError` |
| `stop()` | `STOPPED` | No-op (no event) |
| `stop()` | `UNINITIALIZED` | No-op (no event) |
| `restart()` | `DESTROYED` | Throws `DestroyedError` |
| `destroy()` | `DESTROYED` | Safe no-op |

---

## G.3 — Lifecycle Events

All lifecycle state transitions emit a corresponding event **before** the transition completes. This enables Electron and other integrations to react to intermediate states.

```js
listener.on("starting",    () => { /* Supervisor booting */           })
listener.on("ready",       () => { /* Handshake complete, warm */     })
listener.on("running",     () => { /* Detection fully active */       })
listener.on("paused",      () => { /* Matcher gated */                })
listener.on("resumed",     () => { /* Detection reactivated */        })
listener.on("stopping",    () => { /* Shutdown sequence started */    })
listener.on("stopped",     () => { /* Full shutdown complete */       })
listener.on("restarting",  () => { /* Restart sequence initiated */   })
listener.on("recovering",  () => { /* Supervisor restarting Worker */ })
listener.on("recovered",   () => { /* Worker back up after crash */   })
listener.on("failed",      (err) => { /* Max restarts exceeded */     })
listener.on("destroyed",   () => { /* Instance permanently closed */ })
```

**Ordering guarantee:** For `start()`, the event sequence is always:
`"starting"` → (progress steps) → `"ready"` → `"running"`.
The `await start()` promise resolves **after** `"running"` is emitted.

---

## G.4 — READY vs RUNNING Distinction

These are explicitly different states.

| State | Meaning |
|-------|---------|
| `READY` | Models loaded. Processes up. WebSocket connected. Handshake complete. **Detection NOT active.** Audio may be open but matcher is gated. |
| `RUNNING` | Detection loop fully active. VAD evaluating frames. Matcher scoring hypotheses. Wake events can fire. |

**Why this matters:** Embedded integrations may want to hold the runtime in `READY` state (warm, fast-resume) without consuming CPU on continuous detection. `start()` progresses through `READY` to `RUNNING` automatically unless `startPaused: true` is passed in options.

```js
// Start warm but detection gated — manually resume when needed
await listener.start({ startPaused: true })
// listener is now in READY state (not RUNNING)
await listener.resume()  // → RUNNING
```

---

## G.5 — Diagnostics & Observability API

```js
// Current FSM state string
const state = listener.getState()
// → "RUNNING" | "PAUSED" | "STOPPED" | ...

// Aggregated health score 0.0–1.0 + subsystem breakdown
const health = await listener.getHealth()
// → { score: 0.91, subsystems: { vad: "RUNNING", asr: "RUNNING", audio: "DEGRADED" } }

// Raw real-time metrics snapshot
const metrics = await listener.getMetrics()
// → { wakeCount: 12, avgWakeLatencyMs: 143, queueDepth: 2, droppedFrames: 0, ... }

// Full diagnostic report (all of the above + timing breakdowns)
const diag = await listener.getDiagnostics()
// → {
//     state, health, metrics,
//     latency: { captureToQueue: 0.3, vadDecision: 4.1, asrHypothesis: 38.2, ... },
//     memory:  { onnxBytes: 182000000, queueBytes: 51200, totalTrackedBytes: ... },
//     session: { id: "sess_abc", uptimeMs: 43200000, restartCount: 0 }
//   }

// Runtime manifest (versions, capabilities, models, platform)
const manifest = await listener.getManifest()
// → { runtimeVersion, protocolVersion, capabilities, models, platform }
```

All diagnostic calls resolve within 100ms. If the runtime is unreachable, they reject with `DiagnosticsUnavailableError` rather than hanging.

---

## G.6 — Safe Config Update API

Not full live patching. Only fields safe to update without pipeline restart.

```js
await listener.updateConfig({
  wakePhrases: [
    { phrase: "hey computer", threshold: 0.75, enabled: true }
  ],
  debug: { partialTranscripts: true },
  vad: { sileroThreshold: 0.22 }
})
```

**Allowed at runtime (no restart required):**
- Per-phrase `threshold`, `cooldownMs`, `enabled`, `weight`
- Variants per phrase
- `debug.*` toggles
- `vad.sileroThreshold`
- `matcher.emaAlpha`

**Not allowed at runtime (throws `RestartRequiredError`):**
- `asr.provider` swap
- `audio.device` swap
- `transport.*` changes
- `vad.provider` swap

The runtime validates the partial config against `runtime/config/schema.py` before applying. Invalid fields → `ConfigValidationError` thrown with field-level details.

---

## G.7 — Phrase Management API

Per-phrase variant management is a core library identity feature. These APIs make it first-class.

```js
// Add a new wake phrase at runtime
await listener.addPhrase({
  phrase: "wake up",
  variants: ["wake up please", "hey wake up"],
  threshold: 0.70,
  cooldownMs: 2000
})

// Remove a phrase by its canonical string
await listener.removePhrase("wake up")

// Enable / disable without removing
await listener.enablePhrase("hey computer")
await listener.disablePhrase("hey computer")

// Update variants for an existing phrase
await listener.updateVariants("hey computer", [
  "a computer",
  "hey compute",
  "hey computers"
])

// Query the current live phrase registry
const phrases = await listener.getPhrases()
// → [{ phrase, variants, threshold, cooldownMs, enabled, weight }, ...]
```

**Implementation path:**
- Node SDK sends a `control.configure_phrases` message over the control plane WebSocket
- Runtime Kernel dispatches to `runtime/matcher/variants.py` live registry update
- No restart. No pipeline interruption.
- Confirmation emitted as `"phrases-updated"` event.

**Validation:** Adding a phrase with no variants → auto-registers the canonical phrase as its own variant. Duplicate phrase → `DuplicatePhraseError`.

---

## G.8 — Transport Reconnect Contract

Formally defines what happens when the WebSocket link between Node SDK and Supervisor drops.

**On disconnect detected (Node side):**
1. State transitions to `RECOVERING`
2. Emits `"recovering"` event
3. Retry with exponential backoff: 200ms → 400ms → 800ms → 1600ms → 3200ms
4. Max 5 attempts within 30s window
5. On success: re-handshake, re-confirm capabilities, resume prior state
6. On failure after max attempts: transition to `FAILED`, emit `"failed"` event

**On disconnect detected (Supervisor side):**
- Supervisor does NOT terminate Worker on WS drop
- Worker continues running (VAD/ASR/audio alive)
- Supervisor buffers up to 50 critical events (wake, error) for replay on reconnect
- Stale events older than 10s are discarded on reconnect

**Heartbeat contract:**
- Runtime sends heartbeat every `5s` over control plane
- Node SDK marks connection stale if no heartbeat for `12s` (2.4× interval)
- Reconnect sequence triggered automatically

---

## G.9 — Audio Device Recovery Policy

Explicitly prevents unnecessary runtime churn when USB audio devices reconnect.

**Policy on device loss:**

```
Audio device removed
   → Audio backend emits DeviceLostEvent
   → Audio subsystem state → DEGRADED (not FAILED)
   → Pipeline pauses (no audio frames)
   → Supervisor is NOT notified to restart Worker
   → Kernel polls for device reacquisition every 2s for up to 30s
   → On reacquisition: resume pipeline from DEGRADED → RUNNING
   → If not reacquired within 30s: escalate to Supervisor → restart Worker
```

**Events emitted during this flow:**
```js
listener.on("audio-device-lost",     ({ deviceId }) => { ... })
listener.on("audio-device-restored", ({ deviceId }) => { ... })
```

**Why:** USB headset unplugging during a conversation should not cause a full runtime restart + cold ASR model reload. The 30s grace window handles the physical reconnect time.

---

## G.10 — Cancellation & Timeout Contracts

Every async subsystem operation defines its timeout and cleanup guarantee.

| Operation | Timeout | On Timeout |
|-----------|---------|-----------|
| `start()` overall | 30s | Throws `StartupTimeoutError`, full teardown |
| Model download (per file) | 120s | Throws `DownloadTimeoutError`, partial file deleted |
| WS handshake | 10s | Throws `HandshakeTimeoutError`, ports released |
| Worker startup | 15s | Supervisor kills Worker PID, throws `WorkerStartupError` |
| Worker shutdown | 5s | Supervisor SIGKILLs Worker, continues teardown |
| `stop()` overall | 15s | Forces SIGKILL on all children, resolves anyway |
| Audio device acquire | 5s | Logs warning, tries next available device |
| Reconnect sequence | 30s total | Transitions to `FAILED` |

All timeouts are configurable via `AVAListener` constructor options:
```js
new AVAListener({ timeouts: { startup: 30000, handshake: 10000 } })
```

---

## PART H — RESOURCE OWNERSHIP TABLE

*Canonical reference. Also published to `docs/architecture/ownership.md`.*

| Resource | Owner | Lifetime | Cleanup Responsibility |
|----------|-------|----------|----------------------|
| Audio stream handle | `runtime/audio/stream.py` | Session | `audio/stream.py::close()` |
| Audio ring buffer | `runtime/audio/realtime/ring_buffer.py` | Session | Auto on stream close |
| Silero ONNX session | `runtime/resources/pools.py` | Runtime Worker | `pools.py::release_onnx(id)` |
| Sherpa ONNX session | `runtime/resources/pools.py` | Runtime Worker | `pools.py::release_onnx(id)` |
| ASR stream context | `runtime/asr/providers/sherpa.py` | Per generation | `sherpa.py::_reset_stream()` |
| VAD LSTM state | `runtime/vad/providers/silero.py` | Per session | `silero.py::reset_state()` |
| Hypothesis buffer | `runtime/session/context.py` | Session | `context.py::clear()` |
| Phrase variant registry | `runtime/matcher/variants.py` | Runtime Worker | `variants.py::clear()` |
| WebSocket connection | `runtime/transport/websocket_server.py` | Runtime Worker | `websocket_server.py::close()` |
| Session auth token | `runtime/security/tokens.py` | Per connection | Invalidated on WS close |
| Runtime Worker process | `runtime/supervisor/supervisor.py` | Supervisor | `supervisor.py::terminate_worker()` |
| Supervisor process | `node/process_manager.js` | Node SDK lifecycle | `process_manager.js::kill()` |
| Thread pool | `runtime/resources/pools.py` | Runtime Worker | `pools.py::shutdown()` |
| Telemetry buffers | `runtime/telemetry/` | Session | Flushed before transport close |

**Rule:** No module may hold a direct reference to a resource it does not own. Cross-module resource access must go through the owner's defined public interface.

---

## PART I — NODE SDK STATE MACHINE (Complete Definition)

```
UNINITIALIZED
    │
    ├─ start() ──────────────────────→ INSTALLING
    │                                       │ (models verified)
    │                                       ↓
    │                                   STARTING
    │                                       │ (supervisor + worker up)
    │                                       ↓
    │                                   CONNECTING
    │                                       │ (WS + handshake)
    │                                       ↓
    │                                   READY ←──────────────────────┐
    │                                       │ (detection active)      │
    │                                       ↓                        │
    │                                   RUNNING                       │
    │                                       │                        │
    │                     ┌─────────────────┤                        │
    │                     │                 │                        │
    │                  pause()           crash                       │
    │                     │                 │                        │
    │                     ↓                 ↓                        │
    │                   PAUSED          RECOVERING ──(success)───────┘
    │                     │                 │
    │                  resume()          (max retries exceeded)
    │                     │                 │
    │                     └────────────┐    ↓
    │                                  │  FAILED
    │                                  │
    │                               RUNNING
    │
    ├─ stop() (any active state) ────→ STOPPING
    │                                       │
    │                                       ↓
    │                                   STOPPED
    │
    └─ destroy() (any state) ────────→ DESTROYED
```

**Invariants:**
- `FAILED` can only be exited via `restart()` or `destroy()`
- `DESTROYED` is terminal — no transitions out
- `RECOVERING` is automatic — not triggered by user calls
- `INSTALLING` only occurs if models are missing on first `start()`

---

## PART J — COMPLETE PUBLIC EVENTS REFERENCE

All events emitted by `AVAListener` (the npm library surface). Runtime internals never surface directly.

### Detection Events
```js
listener.on("wake", ({ phrase, confidence, rawConfidence, smoothConfidence, latencyMs, sessionId }))
listener.on("wake-candidate", ({ phrase, score, threshold, sessionId }))
listener.on("speech-start", ({ sessionId, timestamp }))
listener.on("speech-end",   ({ sessionId, duration, sessionId }))
listener.on("partial-transcript", ({ text, stability, generationId, sessionId }))
```

### Lifecycle Events
```js
listener.on("starting",   ())
listener.on("ready",      ({ manifest }))        // includes full runtime manifest
listener.on("running",    ())
listener.on("paused",     ())
listener.on("resumed",    ())
listener.on("stopping",   ())
listener.on("stopped",    ())
listener.on("restarting", ())
listener.on("recovering", ({ reason, attempt, maxAttempts }))
listener.on("recovered",  ({ downtimeMs }))
listener.on("failed",     ({ reason, restartCount }))
listener.on("destroyed",  ())
```

### Configuration Events
```js
listener.on("config-updated",   ({ changes }))
listener.on("phrases-updated",  ({ phrases }))
listener.on("capability-unavailable", ({ capability }))
```

### Audio Events
```js
listener.on("audio-device-lost",     ({ deviceId, deviceName }))
listener.on("audio-device-restored", ({ deviceId, deviceName }))
```

### Error & Diagnostic Events
```js
listener.on("error",   (err))   // non-fatal, runtime continues
listener.on("crash",   ({ subsystem, reason, snapshot }))  // with crash snapshot
listener.on("metrics", ({ interval, data }))  // periodic metric flush (if enabled)
```

**Rule:** `"error"` means the runtime is still alive. `"crash"` means a subsystem died and recovery is in progress. `"failed"` means recovery gave up.

---

## PART K — FINAL ARCHITECTURAL SUMMARY (v5)

The architecture now has two equally important layers:

### Layer 1: The Runtime Platform (internal)
- Kernel orchestration
- Supervisor isolation
- Session-scoped state
- Event bus + priority hierarchy
- Real-time audio thread safety
- Provider abstraction (VAD, ASR, Audio, Matchers)
- Typed message contracts
- Health scoring + crash snapshots
- Memory budgets + resource ownership

### Layer 2: The SDK Product (public)
- Explicit lifecycle semantics (`start/pause/resume/stop/restart/destroy`)
- Strict idempotency rules
- Complete lifecycle event stream
- Diagnostics + health + metrics API
- Phrase management API
- Safe config update API
- Transport reconnect contract
- Audio device recovery policy
- Cancellation + timeout contracts

> **Both layers must evolve together.**
> A perfect runtime with a brittle SDK is not a product.
> A polished SDK over an unstable runtime is not a platform.
> AVAListener must be both.

---

*Architecture plan complete. Ready to begin Stage 1 implementation on approval.*
