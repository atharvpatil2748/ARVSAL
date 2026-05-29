# AVAListener Implementation Plan

## 1. Mission Statement

### What AVAListener currently is
AVAListener is a working realtime wake detection engine built around a queue-decoupled audio pipeline, hybrid VAD, and Sherpa-ONNX streaming ASR. The current engine is stable, predictable, and able to detect wake phrases through the existing `audio/`, `asr/`, `decision/`, `matcher/`, and `core/` layers.

### What it is evolving into
AVAListener is evolving into a production-grade supervised runtime platform with a clear supervisor-worker boundary, a typed transport layer, a Node SDK public API, structured observability, formal state machines, and hardened recovery paths.

### Implementation philosophy
- Preserve the currently working engine at all times.
- Prioritize working runtime first, refactor second, features third.
- Avoid abstraction-first development; prefer concrete structure over speculative layering.
- Favor explicit observability and deterministic behavior over hidden state and magical side effects.
- Make every change reversible and every phase runnable.

### Non-goals for this cycle
- No implementation of plugin systems, distributed runtime, or advanced DAG pipeline execution in V1.
- No cloud sync, speaker identification, or browser/WASM runtime support.
- No breaking of the existing wake engine to chase architecture purity.

---

## 2. Current Stable Baseline Snapshot

### Currently working modules
- `audio/` — microphone capture, buffering, VAD gating, queueing.
- `asr/` — Sherpa streaming ASR integration in `asr/sherpa_stream.py`.
- `core/engine.py` — wake candidate lifecycle, EMA smoothing, cooldown.
- `matcher/` — phrase matching, variants, scoring, confidence.
- `config/settings.py` — global configuration, thresholds, debug flags.
- `utils/logger.py` — runtime logging and debug controls.
- `main.py`, `engine.py` — entrypoints and orchestration glue.

### Runtime topology
The current runtime is a single-process pipeline with the following logical flow:
- microphone input → audio queue → VAD → Sherpa ASR → hypothesis stream → matcher → wake events.
- Logging and debug flags are environment-driven.
- Control and transport are currently local and not yet separated into explicit supervisor or WS boundaries.

### Active dependencies
- `numpy`
- `sounddevice`
- `webrtcvad-wheels`
- `sherpa_onnx`
- `onnxruntime`
- `RapidFuzz`
- `jellyfish`

### Current data flow
1. `sounddevice` audio callback enqueues floating-point microphone chunks.
2. Worker thread drains the queue, runs hybrid VAD, feeds Sherpa, and extracts hypotheses.
3. Stable ASR text is forwarded to the matcher and the core engine.
4. Wake candidates are tracked, confirmed, and emitted through the existing engine.

### Working wake flow
- Wake phrase variants are mapped in `config/settings.py`.
- Candidate score is computed with confidence, stability, attribute weights, and cooldown.
- Wake trigger is emitted when the score passes the configured threshold and cooldown conditions are satisfied.

### Known technical debt
- Mixed runtime concerns in a single process: audio capture, ASR, matching, diagnostics, and control are not isolated.
- Lack of a formal state machine for kernel and subsystem lifecycle.
- Transport via stdout/stdin or ad-hoc internal channels is fragile.
- Observability is present, but not normalized into structured schema or event hierarchy.
- The current architecture is sufficient but brittle for production deployment.

### Baseline v1 definition
This document establishes Baseline v1 as the currently working engine plus the preserved runtime behavior and existing dependency set. All implementation work must be measured against this baseline.

---

## 3. Phase-by-Phase Execution Plan

### PHASE 0 — Baseline Preservation

#### Goal
Freeze the current working engine and create guardrails so every future phase can be reverted cleanly.

#### Tasks
- Snapshot runtime state with `requirements.lock.txt`, current model files, and current configs.
- Lock dependency versions and verify environment isolation.
- Create a regression test suite for current wake flow and audio processing.
- Add smoke tests for startup, model load, microphone open, and basic ASR path.
- Create explicit rollback checkpoints for each preservation artifact.

#### Deliverables
- `requirements.lock.txt` committed.
- Regression test suite in `tests/replay/` and `tests/smoke/`.
- Runtime validation scripts under `scripts/verify_startup.py` or equivalent.
- Baseline metrics report with wake accuracy, latency, and memory footprint.

#### Validation criteria
- Existing engine starts and produces wake events on known audio fixtures.
- `scripts/verify_startup.py` passes on the current environment.
- Regression suite passes at 100% before any architecture change.
- Dependency versions are fixed and reproducible.

#### Rollback strategy
- Preserve original engine files as a branch or checkpoint.
- If a later phase destabilizes runtime, restore the developer branch to the Phase 0 snapshot.
- Keep `requirements.lock.txt`, `models/`, `config/settings.py`, and `scripts/verify_startup.py` frozen.

#### Risk level
Low. This phase is validation and capture only; no behavior changes permitted.

#### Definition of done
- `pytest tests/replay/ tests/smoke/` passes.
- `python scripts/verify_startup.py` passes.
- `requirements.lock.txt` exists and reproduces dependencies.
- Baseline metrics document is created and committed.

---

### PHASE 1 — Internal Modularization

#### Goal
Restructure the codebase into explicit modules and folders without changing behavior.

#### Tasks
- Move files into the planned runtime folder structure by copy/wrap/redirect.
- Isolate runtime concerns into separate top-level packages: audio, vad, asr, matcher, runtime, transport.
- Replace direct cross-module calls with routing wrappers where needed.
- Preserve existing logic exactly: no semantic rewrites, only relocation and API facades.
- Add compatibility layers so the current engine remains runnable during the move.

#### Strict rule
- Copy → wrap → redirect, do not rewrite.
- Existing engine behavior must be preservable through compatibility entrypoints.
- Any new module introduced in this phase is a layer around the current implementation, not a refactor of logic.

#### Validation criteria
- Current wake accuracy and behavior remain identical on fixtures.
- All tests from Phase 0 still pass.
- Runtime imports resolve under the new structure.
- No new wake engine logic is introduced.

#### Rollback strategy
- Preserve original source locations and support both old and new import paths during this phase.
- If the runtime breaks, revert module moves to the Phase 0 baseline and re-run regression tests.

#### Risk level
Medium. Refactoring file layout can break imports and runtime entrypoints, but behavior is unchanged.

#### Definition of done
- Codebase reflects the planned folder structure from `architecture_plan.md` for Tier 1 modules.
- `python main.py` and `scripts/verify_startup.py` still pass.
- A translation layer exists for old import paths and entrypoints.
- Regression tests pass with the relocated modules.

---

### PHASE 2 — Runtime State Machine

#### Goal
Formalize runtime behavior with explicit state machines and lifecycle contracts.

#### Tasks
- Implement runtime states: `IDLE`, `LISTENING`, `SPEECH_DETECTED`, `CANDIDATE_TRACKING`, `WAKE_CONFIRMED`, `COOLDOWN`, `RECOVERING`, `ERROR`.
- Add subsystem state machines for Audio, VAD, ASR, Transport, and Matcher.
- Define lifecycle contracts for start, stop, recover, and error handling.
- Ensure time and transition decisions are centralized and auditable.
- Keep the existing wake path logic intact while layering the FSM on top.

#### Validation criteria
- No deadlocks or stuck states are introduced.
- State transitions can be traced and logged.
- Runtime remains runnable and wake behavior is preserved.
- A state machine test suite demonstrates valid and invalid transitions.

#### Rollback strategy
- Introduce state machine in a wrapper layer that can be disabled to restore current behavior instantly.
- If runtime becomes nonfunctional, revert to the compatibility wrapper and preserve old state semantics.

#### Risk level
High. Introducing global runtime states touches orchestration and control flow.

#### Definition of done
- All valid runtime and subsystem transitions are implemented and covered by tests.
- Invalid transitions produce deterministic errors without crashing the runtime.
- `scripts/verify_startup.py` passes.
- Wake behavior remains identical across regression fixtures.

---

### PHASE 3 — Telemetry & Observability

#### Goal
Make runtime behavior fully inspectable with structured telemetry, tracing, and health reports.

#### Tasks
- Implement a metrics engine and structured logging layer.
- Add candidate lifecycle tracking and correlation IDs.
- Introduce health report generation and expose it via diagnostics APIs.
- Instrument latency, queue depths, subsystem states, and event priorities.
- Implement deterministic replay capture for debugging: save audio chunks, ASR partials, and candidate state snapshots.
- Keep observability non-invasive: it must not alter wake behavior.

#### Validation criteria
- Every runtime state and phase emits structured events.
- Health report values are available and sensible under load.
- Replay captures record exact wake scenarios and can be replayed deterministically.
- Observability does not change wake accuracy.
- Telemetry regressions are detectable through test harnesses.

#### Rollback strategy
- Encapsulate observability as an orthogonal layer that can be disabled at runtime.
- If telemetry causes instability, disable the new metrics/tracing plumbing while preserving the engine.

#### Risk level
Medium. The main risk is instrumentation overhead or unintended side effects.

#### Definition of done
- Structured logs and metrics are emitted in the runtime.
- Diagnostics API returns runtime health and subsystem status.
- A monitoring test confirms observability output without wake regression.

---

### PHASE 4 — Runtime Hardening

#### Goal
Harden the runtime for production stability and long-duration operation.

#### Tasks
- Implement watchdogs and timeout handling for worker liveness.
- Add queue protections, backpressure policies, and overflow handling.
- Build recovery logic for ASR and microphone failures.
- Add memory pressure monitoring and budget enforcement.
- Verify ONNX recovery and audio backend reconnection.

#### Validation criteria
- Long-duration soak tests run without crashes.
- Watchdog-triggered restarts recover the worker safely.
- Queue overruns are handled gracefully, not silently dropped.
- Recovery logic is exercised in failure mode tests.

#### Rollback strategy
- Introduce hardening features incrementally and keep each guard switchable.
- If recovery logic destabilizes the runtime, disable the new guard and revert to the prior stable baseline.

#### Risk level
High. Hardening interacts with failure modes and lifecycle management.

#### Definition of done
- Soak test with 24h-equivalent load passes in CI or local soak harness.
- Worker heartbeat and restart policy are active and tested.
- A recovery test simulates ASR or mic failure and demonstrates recovery.

---

### PHASE 5 — Config System

#### Goal
Create a stable external configuration system with validation and migration.

#### Tasks
- Implement schema validation and defaults.
- Add config versioning and migration support.
- Add runtime overrides and safe config rejection.
- Move existing settings into structured config schema.

#### Validation criteria
- Invalid configs fail fast with descriptive errors.
- Default config values are documented and verified.
- Runtime accepts safe overrides without restart when supported.
- No hidden config behavior remains.

#### Rollback strategy
- Keep the old config loader as a compatibility path until the new system is validated.
- If migration breaks, fall back to the previous config schema and disable the new loader.

#### Risk level
Medium. Config changes can indirectly affect all subsystems.

#### Definition of done
- Config schema validation passes on current config values.
- Runtime startup works with both legacy and new config paths.
- A config migration test exists for schema upgrades.

---

### PHASE 6 — Supervisor Architecture

#### Goal
Isolate failures by introducing a supervisor layer between Node SDK and runtime worker.

#### Tasks
- Implement Supervisor process with watchdog and restart policy.
- Move runtime worker into its own subprocess.
- Add IPC channels between Supervisor and Worker.
- Ensure the Supervisor survives worker crashes.

#### Validation criteria
- Worker crash does not kill the Supervisor.
- Supervisor can restart the worker and re-establish the runtime.
- Restart throttling works and prevents crash loops.
- Supervisor reports status to Node SDK.

#### Rollback strategy
- Keep current single-process bootstrap path available as a fallback.
- If supervisor startup fails, restore direct runtime launch and document the regression.

#### Risk level
High. Process boundary changes introduce interprocess communication risks.

#### Definition of done
- Supervisor and Worker processes are separate and stable.
- Worker crash recovery and throttling are tested.
- Current engine behavior remains intact through the new layer.

---

### PHASE 7 — WebSocket Transport Layer

#### Goal
Replace fragile stdout parsing with a robust WebSocket-based transport.

#### Tasks
- Implement WebSocket server and client protocol.
- Define control and stream message schemas.
- Add heartbeat and reconnect logic.
- Use schema validators for all messages.

#### Validation criteria
- WS transport works end-to-end for control and data planes.
- Message schema validation rejects malformed payloads.
- Reconnects tolerate transient failures.
- No silent data loss of critical events.

#### Rollback strategy
- Maintain the existing transport path during migration until WS is stable.
- If WS introduces regressions, revert to the prior transport and isolate issues.

#### Risk level
Medium. Transport changes are important but can be validated independently.

#### Definition of done
- Node SDK can communicate with Supervisor/Worker over WebSocket.
- Control messages, partial transcripts, and wake events flow correctly.
- Resilience tests validate reconnect behavior.

---

### PHASE 8 — Node SDK

#### Goal
Expose a stable public API for Electron and Node.js embedding.

#### Tasks
- Implement `const listener = new AVAListener()` with lifecycle methods.
- Add event emission for wake detection, errors, health, and diagnostics.
- Expose config APIs, metrics access, and recovery hooks.
- Implement Node SDK state machine and validate transitions.

#### Validation criteria
- Electron/Node integration works using the SDK.
- Public API calls are idempotent and respect state.
- Recovery hooks fire during worker recovery.
- SDK state machine tests cover all lifecycle transitions.

#### Rollback strategy
- Keep the old local runtime control API available until the SDK is proven stable.
- If SDK integration fails, preserve the runtime and restore the prior control surface.

#### Risk level
Medium. SDK changes affect external consumers but not the internal runtime core.

#### Definition of done
- `npm install && node example.js` works in a fresh checkout.
- SDK public API is documented and tested.
- EventEmitter hooks and diagnostics work end-to-end.

---

### PHASE 9 — Embedded Runtime Packaging

#### Goal
Deliver zero-setup runtime installation for end users.

#### Tasks
- Implement embedded Python bootstrapper.
- Add model auto-download and SHA256 verification.
- Build dependency verification for the runtime.
- Package runtime startup logic for fresh-machine use.

#### Validation criteria
- Fresh install performs dependency verification and model download.
- Embedded Python runtime boots without manual environment setup.
- Bootstrapping failures provide actionable diagnostics.

#### Rollback strategy
- Keep manual venv-based startup available until embedded packaging is validated.
- If bootstrap packaging fails, revert to the existing manual install path.

#### Risk level
High. Packaging and installer behavior adds platform risk.

#### Definition of done
- Fresh checkout can launch without pre-existing venv or models.
- Model checksum verification prevents corrupted artifacts.
- Bootstrapper errors are clear and recoverable.

---

### PHASE 10 — Cross-Platform Distribution

#### Goal
Make AVAListener usable as a library and a deployable package.

#### Tasks
- Publish npm package metadata and install scripts.
- Support Windows, Linux, and macOS packaging targets.
- Add GitHub clone workflow and platform-specific install guides.
- Test cold-machine installs on each target.

#### Validation criteria
- Cold-machine installs succeed on Windows, Linux, and macOS.
- `npm install` or GitHub clone mode can bootstrap the runtime.
- Platform-specific packaging issues are documented or fixed.

#### Rollback strategy
- Retain local source install instructions as the fallback.
- If packaging fails on a platform, limit the release to supported platforms only until fixed.

#### Risk level
Medium. Distribution introduces environment and packaging variability.

#### Definition of done
- Verified cold install on each supported OS.
- Package metadata and install docs are complete.
- Platform-specific regressions are tracked and fixed.

---

### PHASE 11 — Performance Optimization

#### Goal
Optimize runtime efficiency for production use.

#### Tasks
- Measure and improve inference latency, CPU usage, and memory usage.
- Tune queue timing, thread priority, and model loading behavior.
- Identify and remove bottlenecks in the realtime path.
- Add benchmark suite for repeatable measurement.

#### Validation criteria
- Benchmark suite measures baseline and improvements.
- Wake latency remains under the target threshold.
- Resource usage is stable under normal and loaded conditions.

#### Rollback strategy
- Apply performance changes behind feature flags or tuning parameters.
- If a tuning optimization regresses accuracy or stability, revert to the previous setting.

#### Risk level
Medium. Optimization can introduce subtle timing regressions.

#### Definition of done
- Benchmark suite exists and passes.
- Measured latency and CPU usage are within targets.
- No new wake regression is introduced by performance work.

---

### PHASE 12 — Public Release Preparation

#### Goal
Prepare AVAListener for public release with full documentation and developer guidance.

#### Tasks
- Complete docs, examples, tutorials, API reference, and changelog.
- Add contribution guide, licensing, and release notes.
- Validate packaging and install workflows.
- Prepare compatibility and stability documentation for V1.

#### Validation criteria
- Documentation covers installation, SDK usage, config, and troubleshooting.
- Example applications compile and run.
- Release notes and changelog are present.
- Community-facing docs clearly state MVP scope.

#### Rollback strategy
- Keep release candidate branches separate from development.
- If release readiness fails, delay publication until split issues are resolved.

#### Risk level
Low. This phase is documentation and packaging validation.

#### Definition of done
- `docs/` contains complete public release documentation.
- Release checklist passes.
- MVP scope and exclusions are explicitly documented.

---

## Phase Promotion Rules

A phase cannot begin until all of the following are satisfied:
- the previous phase Definition of Done is fully met
- the regression suite passes against the current baseline
- performance and budget constraints are verified
- rollback checkpoint artifacts exist and are tagged
- the runtime baseline remains operational and runnable

Promotion gates prevent unfinished architecture drift and ensure that each phase advances only after concrete evidence of stability.

## Runtime Budget Constraints

Hard runtime budgets are enforced from the start to avoid gradual bloat:
- wake latency target: < 300ms from speech to wake event
- VAD processing budget: < 10ms per frame in the hot path
- ASR partial update budget: < 150ms per decode cycle
- idle CPU: < 8% on the worker process without active speech
- steady RAM: < 1.5GB for the runtime worker
- worker restart recovery: < 5s for a supervised restart cycle

These budgets are not optional design goals; they are explicit constraints for every phase.

## Realtime Runtime Safety Rules

- no blocking calls in the audio callback
- no synchronous model downloads during the active runtime path
- no dynamic imports during active listening
- avoid unbounded queues; all hot-path queues must have explicit bounds and drop policies
- avoid hidden thread spawning in the runtime path
- all worker loops must be watchdog-visible and emit heartbeat/liveness signals
- avoid garbage-heavy allocations in hot paths; prefer preallocated buffers and reuse
- avoid direct time APIs inside runtime code; use a shared runtime clock abstraction

## SDK Stability Contract

- semantic versioning is mandatory for the public SDK and transport protocol
- deprecation policy must be explicit, documented, and implemented one major version before removal
- events are guaranteed to remain compatible within the same major version
- config migration guarantees ensure any supported config upgrade path is documented and reversible
- public API behavior must not change in patch releases
- breaking changes require a major version bump and a migration guide

## Model Provider Abstraction Rules

- ASR providers must expose an identical stream interface for accept_waveform, decode, result retrieval, and reset.
- VAD providers must expose normalized confidence output and a consistent speech/pass decision contract.
- matcher logic must remain provider-agnostic and should consume only normalized text/stability/confidence inputs.
- provider-specific logic is isolated to adapters and must not leak into matcher or runtime decision code.
- new model providers (Deepgram, Whisper, NeMo, FasterWhisper) must be pluggable via the same adapter contract.

## Runtime Reloadability Matrix

| Component | Hot Reload | Restart Required |
|-----------|------------|------------------|
| thresholds | yes | no |
| variants | yes | no |
| config logging level | yes | no |
| models | no | yes |
| audio backend | no | yes |
| transport protocol | no | yes |
| supervisor policy | no | yes |
| runtime state machine | no | yes |

This matrix defines what can be modified live versus what requires restart.

## Trust Boundaries

- the local runtime is trusted only within the local host boundary
- WebSocket transport must bind to `127.0.0.1` only for V1
- model manifests must be signed and checksum verified before loading
- runtime code execution is not allowed from untrusted payloads
- no arbitrary runtime code execution over control channels
- all inbound messages are schema-validated before they reach runtime logic

## Failure Classes

### Recoverable
- microphone disconnect
- worker timeout
- websocket reconnect
- transient audio backend errors
- temporary model load latency

### Semi-recoverable
- corrupted model on disk
- partial dependency failure (missing optional component)
- degraded audio quality
- runtime health score drop below threshold

### Fatal
- incompatible runtime version
- unsupported platform
- invalid signed manifest
- invalid config schema that cannot be migrated
- unrecoverable runtime or transport failure after supervised retries

A clear failure taxonomy is essential for supervisor and recovery decisions.

## Testing Strategy Pyramid

- unit tests: verify small runtime and adapter behaviors.
- integration tests: validate inter-module behavior for audio, ASR, matcher, and transport.
- replay tests: verify exact wake scenarios using captured audio and event replay.
- stress tests: exercise queue and worker behavior under load.
- soak tests: validate long-duration stability and recovery.
- cold machine tests: validate fresh install and runtime boot on a clean environment.
- recovery tests: validate restart, worker crash, and transport reconnect behavior.
- false positive tests: capture and verify no-wake scenarios.

## Contributor Engineering Rules

- no silent architectural rewrites; every large change must be phased and gated.
- preserve compatibility layers until the new implementation is proven stable.
- all new runtime features require telemetry hooks and observability points.
- all async loops require explicit cancellation and shutdown paths.
- all queues require explicit bounds, overflow policy, and backlog metrics.
- no new external dependency is allowed without a documented necessity and budget impact review.
- every public API change must be documented in the SDK Stability Contract.

## Golden Rule

AVAListener is a realtime runtime system first, a library second. All abstractions must justify their existence against latency, stability, observability, and recoverability costs.

## Runtime Concurrency Model

The runtime is composed of multiple cooperating threads with explicit ownership:

### Thread Responsibilities
- **Audio Thread** (sounddevice callback): Capture microphone frames, enqueue to audio queue. No locks, no blocking, no inference.
- **Worker Thread**: Drain audio queue, run VAD, feed Sherpa, extract hypotheses, dispatch events.
- **ASR Thread** (internal to Sherpa): Model inference. Owned by Sherpa, not directly managed.
- **Supervisor Thread**: Monitor worker liveness, manage restart policy, forward IPC messages.
- **WebSocket Thread**: Accept connections, route control/stream messages, emit events to transport queue.
- **Event Dispatch Thread** (optional): Consume event queue, apply priority, send to transport.

### State Ownership Rules
- Audio callback owns: ring buffer pointers, audio queue handle.
- Worker thread owns: VAD state, ASR stream, hypothesis tracking, candidate tracker.
- Supervisor owns: process handles, restart state, health monitoring counters.
- WebSocket owns: connection state, session tokens, transport queues.
- No state is shared without explicit synchronization (Queue, Lock, or Event).

### Synchronization Primitives
- Use only: thread-safe queues, locks (with documented contention), events, and atomics.
- No direct shared mutable state without explicit ownership documentation.
- All queue operations must be non-blocking (timeouts allowed, busy-waits forbidden).

## Backpressure Strategy

When the runtime becomes overloaded, different queue types handle pressure differently:

### Audio Queue (FIFO, bounded)
- **Capacity**: 20 frames (2 seconds of audio)
- **On overrun**: Drop oldest frame. Log warning once per minute.
- **Rationale**: Lost audio is better than blocked microphone callback.

### Hypothesis/Transcript Queue (LIFO for partials, bounded)
- **Capacity**: 100 events
- **On overrun**: Drop intermediate partials. Keep latest.
- **Rationale**: Latest partial is most useful; intermediate partials become stale.

### Event Queue (priority-ordered, bounded)
- **Capacity**: 10000 events
- **On overrun by priority**:
  - CRITICAL: never dropped (unlimited internal buffer if needed).
  - HIGH: drop oldest same-priority event.
  - NORMAL: drop to 50% capacity if overflow, oldest first.
  - LOW: drop to 25% capacity if overflow, oldest first.
- **Rationale**: Protect critical events; drop best-effort telemetry first.

### Telemetry Queue (sampled, bounded)
- **Capacity**: 1000 events
- **On overrun**: Sample at 50% if threshold exceeded. Drop half the oldest.
- **Rationale**: Telemetry is observational; loss is acceptable if noted in health score.

### Wake Events (reserved, never dropped)
- **Capacity**: dedicated unbounded channel or separate small queue.
- **On overrun**: Process synchronously if necessary (brief pause acceptable).
- **Rationale**: Wake events are the fundamental product and must never be lost silently.

## Event Priority Classes

All events flowing through the runtime are assigned a priority that governs queue ordering, drop policy, and transport reliability:

| Priority | Examples | Drop on Overload | Transport Latency SLA |
|----------|----------|------------------|-----------------------|
| CRITICAL | wake, fatal_error, shutdown | never | immediate |
| HIGH | speech_start, speech_end, error | oldest same-priority | < 100ms |
| NORMAL | partial_transcript, hypothesis_update | to 50% capacity | < 500ms |
| LOW | telemetry, metrics, vad_debug | to 25% capacity, sample | best effort |
| DEBUG | trace_point, internal_state | drop first | not queued |

### Priority Enforcement Rules
- Event bus enforces FIFO within priority level.
- Transport sends CRITICAL first, then HIGH, then NORMAL/LOW in order.
- Transport may batch LOW/DEBUG events or apply local sampling without loss notification.

## Clock Synchronization Strategy

All timing inside the runtime uses a shared monotonic runtime clock to ensure consistency:

### RuntimeClock Singleton
- Owned by the Kernel.
- Initialized at startup with `time.monotonic()` as epoch.
- Exported as `runtime.timing.clock.RuntimeClock.instance()`.

### Rules
- All latency measurements use: `t_now = clock.now()` (returns nanoseconds).
- All duration calculations use: `elapsed_ns = clock.elapsed(t_start, t_end)`.
- All timeout checks use: `is_expired = clock.is_expired(deadline_ns)`.
- No direct calls to `time.time()`, `time.monotonic()`, or `datetime.now()` inside `runtime/` paths.
- CI linting rule: grep warnings for `time\.time|time\.monotonic|datetime\.now` in `runtime/` modules.

### Benefits
- Latency metrics are consistent across all subsystems.
- Replay can use deterministic time advancement.
- Soak tests can be time-independent (frame-based).

## Runtime Snapshot Contract

For deterministic replay and debugging, the runtime can serialize its state into a snapshot:

### Snapshot Contents
```python
@dataclass
class RuntimeSnapshot:
    timestamp_ns: int                      # clock.now() at snapshot time
    generation_id: int                     # ASR generation counter
    kernel_state: str                      # IDLE, LISTENING, SPEECH_DETECTED, etc.
    subsystem_states: Dict[str, str]       # audio, vad, asr, transport, matcher
    audio_queue_depth: int
    hypothesis_queue_depth: int
    event_queue_depth: int
    vad_state: Dict[str, Any]              # Silero h/c vectors, WebRTC noise floor
    asr_hypothesis: str                    # current text
    asr_stability: int                     # stability counter
    candidate_tracker: Dict[str, Any]      # active candidates with scores
    ema_confidence_state: Dict[str, float] # per-phrase EMA values
    memory_usage_bytes: int
    last_10_candidates: List[MatchCandidate]  # recent candidates
    replay_metadata: Dict[str, str]        # session_id, correlation_ids, etc.
```

### Snapshot Guarantees
- Snapshots can be captured at runtime without stopping.
- Snapshots are emitted on crash via `crash_snapshot.py`.
- Snapshots are queryable via diagnostics API.
- Replay engine can load snapshot and advance frame-by-frame to reproduce behavior.

## Resource Ownership Rules

Every resource (file, socket, thread, memory buffer, model) has a designated owner responsible for allocation and cleanup:

| Resource | Owner | Allocation | Cleanup | Transfer Rules |
|----------|-------|------------|---------|-----------------|
| Microphone handle | Audio subsystem | startup | stop/error | No transfer |
| Audio queue | Kernel | startup | shutdown | Signal stop before cleanup |
| Sherpa ASR stream | Worker thread | on-demand per generation | on-reset | Exclusive ownership |
| ONNX session (Sherpa) | Sherpa provider | model load | restart | Owned by provider, not runtime |
| WebSocket connection | Transport | accept | close/error | Supervisor notified before close |
| Event queue | Event bus | startup | shutdown | No transfer between threads |
| Candidate tracker | Matcher | initialization | reset per generation | Cleared on stream reset |
| Model file descriptors | Model manager | download | cleanup or cache | Cached with age limit |

### Cleanup Guarantees
- No double-close: ownership rules prevent multiple close attempts.
- No use-after-free: ownership is exclusive until explicit transfer.
- Leak prevention: every allocation has a documented cleanup path in shutdown or error handlers.

## Cold Start Strategy

The runtime optimizes for two distinct startup scenarios:

### First-Time Startup (Fresh Install)
1. **Model Download & Verification** (Phase 9)
   - Download Sherpa + Silero models on first `listener.start()`.
   - Verify SHA256 checksums before loading.
   - Cache in `~/.ava-listener/models/`.
   - Estimated time: 30–60s on broadband.

2. **Lazy Initialization**
   - Audio backend: opened only on `start()`.
   - VAD state (Silero vectors): initialized on first frame.
   - ASR stream: created fresh per generation.
   - WebSocket connection: established on Node SDK init, reconnected on worker restart.

3. **Eager Warmup** (optional, Phase 11)
   - Pre-warm Sherpa inference with dummy frames before accepting real audio.
   - Reduces first-hypothesis latency by ~200ms.
   - Gated behind feature flag for user preference.

### Startup Latency Budget
- **Model load**: < 5s after model download (ONNX session creation).
- **VAD initialization**: < 1s (vector allocation, state reset).
- **ASR stream creation**: < 200ms (Sherpa stream object).
- **First partial hypothesis**: < 500ms after audio arrives.
- **First wake event**: < 300ms after speech ends (if variants matched).

### Tuning Parameters (Phase 11)
- Model preloading: eager vs lazy.
- ASR stream pre-warmup: enabled/disabled.
- VAD confidence initialization: seeded vs fresh.

## Compatibility Guarantees

AVAListener V1 commits to the following compatibility surfaces:

### Python Runtime
- **Supported**: Python 3.10, 3.11, 3.12.
- **EOL behavior**: When Python X reaches EOL, AVAListener will drop support in a new major version.
- **Deprecation notice**: 1 major release before dropping version.

### Node.js Runtime
- **Supported**: Node.js 18 LTS, 20 LTS, 22 LTS.
- **EOL behavior**: Following Node.js LTS schedule.
- **Deprecation notice**: 1 major release before dropping version.

### ONNX Runtime
- **Supported**: `onnxruntime >= 1.17.0`.
- **Breaking changes**: Only on major version bumps.

### Model Compatibility
- **Sherpa zipformer** (2023-06-26): V1 baseline.
- **Silero VAD** (v5): V1 baseline.
- **Future models**: Introduced via provider abstraction; no breaking changes to model format.

### Platform Targets (V1)
- **Windows**: 10 / 11, x64.
- **Linux**: Ubuntu 20.04+, x64, ARM64.
- **macOS**: 12+, Intel x64, Apple Silicon.

### GPU Support (V1)
- **CPU-only**: fully supported.
- **NVIDIA CUDA**: optional, requires ONNX Runtime CUDA build.
- **Intel Arc**: optional, requires ONNX Runtime DirectML.
- **Apple Metal**: optional, requires ONNX Runtime CoreML.

## Observability Schema Versioning

All runtime events and telemetry carry a schema version to prevent future dashboarding breakage:

### Message Structure
```json
{
  "type": "partial_transcript",
  "schemaVersion": 1,
  "timestamp": 1715787540000,
  "sessionId": "sess_abc123",
  "correlationId": "corr_xyz_789",
  "payload": {
    "text": "hello world",
    "stability": 5,
    "generation": 0
  }
}
```

### Versioning Rules
- Every message type has a `schemaVersion` field (integer, starting at 1).
- Schema changes increment the version.
- Consumers support at least the current version and one prior version.
- Breaking changes trigger a major SDK version bump.
- Old schema versions are mapped to current via migration functions in `runtime/transport/protocol/schemas/migrations.py`.

### Telemetry Schema Registry
```python
SCHEMA_REGISTRY = {
    ("partial_transcript", 1): PartialTranscriptV1,
    ("partial_transcript", 2): PartialTranscriptV2,
    ("wake", 1): WakeEventV1,
    ("health", 1): HealthReportV1,
    # ... all message types versioned
}
```

## Architectural Red Lines

These are permanent, non-negotiable constraints that protect the architecture from decay:

### No Forbidden Patterns
- **No hidden singleton state**: All singletons must be explicitly documented and owned (RuntimeClock OK, global config must be immutable).
- **No global mutable runtime state**: All mutable state must be owned by a specific thread/component with documented synchronization.
- **No blocking network I/O in the runtime path**: All I/O is async or fire-and-forget (transport exceptions are non-blocking).
- **No direct provider-specific logic outside adapters**: Sherpa, Silero, future models are accessed only through `runtime/asr/providers` and `runtime/vad/providers`.
- **No uncontrolled background threads**: Every thread must have a documented lifecycle, ownership, and shutdown path.
- **No silent auto-recovery loops**: Every recovery attempt must be observable and counted. Exponential backoff is required.
- **No runtime mutation without observability**: Every state change in the kernel must emit an event (or be benchmarked as too-frequent to emit).

### Enforcement
- Code review: architecture reviewers verify no red lines are crossed.
- CI gates: optional linting rules to flag suspicious patterns (e.g., no `while True` recovery loops in runtime/).
- Documentation: every exception to these rules must be documented with justification and an issue ticket.

## Memory Ownership Rules

Audio and inference buffers must follow explicit ownership and lifecycle rules to prevent corruption and leaks:

### Buffer Allocation
| Buffer Type | Allocator | Lifecycle | Mutation |
|-------------|-----------|-----------|----------|
| Audio frame (sounddevice) | sounddevice | per-callback | read-only copy in callback |
| Audio queue payload | worker thread | on-enqueue | copy on write, single owner |
| numpy array (VAD input) | VAD provider | per-frame | owned by VAD, discarded after process |
| ONNX tensor | Sherpa provider | per-decode | owned by Sherpa, not accessible to runtime |
| Hypothesis string | ASR provider | per-result | immutable after return, no mutation |
| Event payload | event bus | on-emit | immutable after enqueue |
| Snapshot buffer | crash handler | on-crash | single-use, serialized to JSON, then freed |
| WebSocket payload | transport | on-receive | validated, parsed, then freed |

### Copy vs Zero-Copy Rules
- **Audio frames**: must copy in callback (ring buffer is reused). No zero-copy allowed here.
- **Hypothesis text**: immutable strings, safe to share without copy.
- **Numpy arrays**: VAD may work in-place on copies, Sherpa owns tensor lifetime.
- **ONNX tensors**: never returned to runtime; Sherpa manages lifetime.
- **Event payloads**: dataclass instances are immutable; safe to share.
- **Snapshots**: single snapshot per crash, serialized immediately, reference freed after JSON write.

### Memory Pressure Behavior
- If heap usage exceeds 90% of budget: emit `memory_pressure` event.
- If heap usage exceeds 95% of budget: enter degraded mode, reduce queue sizes, disable telemetry.
- If heap usage exceeds 100% of budget: emit fatal error and prepare graceful shutdown.

## Queue Latency Monitoring

Every queue in the runtime emits latency metrics to enable production debugging:

### Metrics per Queue

**Audio Queue**
- `audio.queue.enqueue_delay_ms`: time from sounddevice callback to queue.put().
- `audio.queue.age_ms`: age of oldest frame in queue.
- `audio.queue.depth`: current depth.
- `audio.queue.dropped_frames`: cumulative count of dropped frames.

**Hypothesis Queue**
- `hypothesis.queue.dequeue_delay_ms`: latency from ASR emit to worker dequeue.
- `hypothesis.queue.age_ms`: age of oldest hypothesis.
- `hypothesis.queue.depth`: current depth.
- `hypothesis.queue.dropped_events`: count of dropped intermediate partials.

**Event Queue (by priority)**
- `event.queue.CRITICAL.dequeue_delay_ms`: latency to dispatch.
- `event.queue.HIGH.dequeue_delay_ms`: latency to dispatch.
- `event.queue.NORMAL.dequeue_delay_ms`: latency to dispatch.
- `event.queue.LOW.dequeue_delay_ms`: latency to dispatch.
- `event.queue.dropped_by_priority`: dict of drops per priority.

**Transport Send Queue**
- `transport.queue.age_ms`: age of oldest pending event.
- `transport.queue.depth`: current backlog.
- `transport.queue.dropped`: count of dropped events during overload.

### Thresholds for Alerts
- Queue age > 1s: warning log.
- Queue depth > 80% capacity: degraded health score.
- Dropped frames > 1% per minute: error log.
- Dequeue latency > 100ms: telemetry event.

## Runtime Health Score Formula

The health score is a single float (0.0 to 1.0) computed every second that summarizes runtime state:

```
health_score = 
  (1.0 - latency_penalty) * 
  (1.0 - drop_penalty) * 
  (1.0 - restart_penalty) * 
  (1.0 - memory_penalty) * 
  (1.0 - queue_penalty)
```

### Component Penalties

**Latency Penalty**
- If any queue age > 500ms: 0.1.
- If any queue age > 1s: 0.3.
- If dequeue latency > 100ms: 0.05.

**Drop Penalty**
- If drop rate > 0.1%: 0.1.
- If drop rate > 1%: 0.3.
- If CRITICAL events dropped: 1.0 (fatal, immediate shutdown).

**Restart Penalty**
- If no restarts in 24h: 0.0.
- If 1 restart in 24h: 0.05.
- If 2 restarts in 24h: 0.1.
- If 5+ restarts in 24h: 0.5.

**Memory Penalty**
- If heap usage < 80%: 0.0.
- If 80–90%: 0.1.
- If 90–95%: 0.3.
- If > 95%: 1.0 (fatal).

**Queue Penalty**
- If any queue > 80% capacity: 0.1.
- If any queue > 95% capacity: 0.3.
- If any queue overflowed: 0.2.

### Health Score Tiers
- 0.9–1.0: `excellent` — no intervention.
- 0.75–0.89: `good` — monitor for trends.
- 0.5–0.74: `degraded` — consider safe mode.
- < 0.5: `critical` — escalate recovery.

## Recovery Escalation Policy

When a failure is detected, the supervisor implements a staged recovery strategy:

| Failure Count | Time Window | Action | Observable As |
|---------------|------------|--------|-----------------|
| 1 | 5 minutes | restart worker | `worker.restart_attempt_1` |
| 2 | 5 minutes | reload ASR + VAD providers | `recovery.provider_reload` |
| 3 | 5 minutes | full runtime restart | `worker.restart_attempt_3` |
| 4 | 5 minutes | enter safe degraded mode | `runtime.enter_safe_mode` |
| 5 | 60 minutes | fatal error, emit signal | `runtime.fatal_failure` |

### Escalation Rules
- Each restart adds exponential backoff: `1s → 2s → 4s → 8s → 16s`.
- Time window resets if no failures occur for 60 minutes.
- `max_restarts_per_hour = 6`; exceeded → fatal.
- Every escalation emits an event and updates health score.

## Degraded Runtime Mode

When the runtime detects resource constraints or repeated failures, it enters safe degraded mode:

### Degraded Mode Adjustments
- **Telemetry**: disabled. No metrics, logs only errors.
- **ASR Beam Size**: reduced from 4 to 2 (faster, lower quality).
- **Queue Sizes**: audio queue 20 → 10, event queue 10000 → 1000.
- **Debug Stream**: disabled. No partial transcript events.
- **VAD Confidence Threshold**: increased by 20% (more conservative).
- **CPU Cores**: limited to 1 (from 2).
- **Transport**: prioritize CRITICAL only, drop NORMAL/LOW.

### Activation Triggers
- Health score < 0.5.
- Memory pressure > 90%.
- 3+ failures in 30 minutes.
- Manual override via config.

### Recovery from Degraded Mode
- Automatic: if health score recovers to > 0.75 for 5 minutes.
- Manual: admin request via control plane.
- On exit: emit `runtime.exit_safe_mode` event.

## Capability Detection Layer

At startup, the runtime probes the environment and adapts automatically:

### Capabilities Detected
```python
@dataclass
class RuntimeCapabilities:
    cpu_cores: int                         # logical cores
    ram_available_gb: float                # available system RAM
    avx2_supported: bool                   # SIMD support
    cuda_available: bool                   # NVIDIA GPU
    cuda_device_count: int                 # GPU device count
    directml_available: bool               # Windows GPU (Intel/AMD)
    coreml_available: bool                 # macOS acceleration
    mic_available: bool                    # microphone detection
    network_available: bool                # internet connectivity
    platform: str                          # windows / linux / macos
    python_version: str                    # X.Y.Z
    onnx_runtime_version: str              # with acceleration info
```

### Adaptive Behavior
- **CPU cores**: adjust ASR threads (min 1, max cores/2).
- **Available RAM**: set memory budget (base 512MB + 100MB per GB available).
- **CUDA/DirectML/CoreML**: select ONNX provider automatically.
- **Microphone**: warn if no audio input detected at startup.
- **Network**: if offline, skip telemetry upload (non-fatal).

### Capability Reporting
- Emit `runtime.capabilities` as part of handshake message.
- Include in diagnostics API response.
- Use for feature flag decisions (e.g., disable GPU if not available).

## Runtime Profile Presets

Users can select a runtime profile that automatically tunes parameters:

### Profile Options

**`ultra_low_latency`**
- ASR beam size: 2
- VAD aggressiveness: 3
- Queue sizes: minimal
- Telemetry: disabled
- Goal: < 200ms wake latency, high CPU.

**`balanced`** (default)
- ASR beam size: 4
- VAD aggressiveness: 1
- Queue sizes: normal (20, 100, 10000)
- Telemetry: normal
- Goal: good latency and accuracy.

**`low_memory`**
- ASR beam size: 2
- VAD aggressiveness: 1
- Queue sizes: small (10, 50, 1000)
- Telemetry: minimal
- Goal: < 500MB RAM, slower latency.

**`debug`**
- ASR beam size: 4
- VAD aggressiveness: 0 (disabled)
- Queue sizes: large (50, 500, 100000)
- Telemetry: verbose, full tracing
- Goal: maximum observability.

### Profile Selection
- Default: `balanced`.
- Set at config time: `{ "profile": "ultra_low_latency" }`.
- Cannot be changed live (requires restart).

## Transport Reliability Classes

Different event types guarantee different delivery semantics:

### Delivery Guarantees

| Event Type | Reliability Class | Behavior |
|------------|-------------------|----------|
| wake | **guaranteed** | retry until acked; CRITICAL priority |
| speech_start, speech_end | **retry** | retry up to 3 times; HIGH priority |
| partial_transcript | **best_effort** | sent once; may batch; NORMAL priority |
| hypothesis_update | **best_effort** | sent once; may batch; NORMAL priority |
| telemetry, metrics | **best_effort** | may sample; fire-and-forget; LOW priority |
| debug, trace | **fire_and_forget** | no retry; may drop; DEBUG priority |

### Retry Policy (for `retry` class)
- Exponential backoff: `100ms → 200ms → 400ms`.
- Max 3 retries (total ~700ms).
- After max retries: emit `transport.message_dropped` and continue.

### Batching (for `best_effort` class)
- Buffer up to 10 events or 100ms, whichever first.
- Send as batch array: `[event1, event2, ...]`.
- On transport error: silently drop the batch.

## Deterministic Replay Guarantees

When replaying a captured scenario, the runtime guarantees deterministic behavior:

### Replay Invariants
- Same input audio (exact frames from snapshot).
- Same config (all thresholds, variants, model paths).
- Same model versions (Sherpa 2023-06-26, Silero v5).
- Same runtime clock (deterministic frame-by-frame time).
- Same random seed (no randomness in matcher or VAD).

### Replay Guarantees
- **Given identical inputs** → identical wake decisions (same phrase, same confidence, same latency).
- **No network I/O** during replay (config comes from snapshot).
- **No model changes** during replay.
- **Deterministic within 5 frames** (due to floating-point rounding).

### Replay Use Cases
- Reproduce false positive or false negative.
- Debug confidence scoring.
- Validate model upgrade impact.
- Create regression test from real-world audio.

### Replay API
```python
replayer = ReplayEngine.from_snapshot(snapshot)
replayer.set_audio_frames(audio_chunks)
while replayer.has_frames():
    event = replayer.advance_frame()
    if event.type == "wake":
        print(f"Wake detected: {event.phrase}")
```

## Architectural Identity

AVAListener is not merely a wake-word detector. It is a **supervised realtime speech event runtime** designed for production embedding with the following core commitments:

### Defining Principles
- **Deterministic Behavior**: Same input, same config, same output. No hidden randomness.
- **Observability First**: Every runtime state change emits an observable event. Dark corners are unacceptable.
- **Recoverability Designed In**: Failures are expected; recovery is structured, tested, and bounded.
- **Configurability Without Recompile**: Thresholds, variants, and profiles adapt without restart.
- **Production Embeddability**: Designed for Electron, Node.js, and server deployment; never a toy.

### Not In Scope
- Speaker identification or voice cloning.
- Multilingual phonetic models (future).
- Cloud sync or distributed runtime (future).
- Browser/WASM embedding (future).
- Plugin system (future).

### Long-Term Vision
AVAListener evolves into a complete **realtime speech runtime platform** with:
- Deterministic replay for debugging.
- Pluggable ASR and VAD providers.
- Multi-tenant supervision.
- Advanced audio backends.
- Observability dashboards.

But always starting with:
- Rock-solid baseline.
- Observable operation.
- Predictable failure recovery.
- Clear ownership and safety rules.

---

## 4. Dependency Graph

| Dependent Phase | Depends On |
|-----------------|------------|
| Phase 1 | Phase 0 |
| Phase 2 | Phase 1 |
| Phase 3 | Phase 2 |
| Phase 4 | Phase 2, Phase 3 |
| Phase 5 | Phase 1, Phase 2 |
| Phase 6 | Phase 1, Phase 2, Phase 5 |
| Phase 7 | Phase 6 |
| Phase 8 | Phase 6, Phase 7 |
| Phase 9 | Phase 6, Phase 8 |
| Phase 10 | Phase 8, Phase 9 |
| Phase 11 | Phase 3, Phase 7 |
| Phase 12 | Phase 8, Phase 10, Phase 11 |

### Dependency ordering rationale
- Telemetry depends on a stable state machine and modular runtime.
- Supervisor must exist before WS transport is fully relied on.
- Node SDK requires the supervisor and transport layer.
- Packaging depends on runtime stabilization and SDK maturity.
- Release preparation depends on all platform and runtime hardening work.

### Circular dependency prevention
- No phase introduces a dependency back to earlier stabilization work.
- Observability and hardening are intentionally sequenced after state formalization.
- The Node SDK is not started until the supervisor and transport layers are stable.

---

## 5. Regression Protection Strategy

### Smoke tests
- Startup verification: `python scripts/verify_startup.py`
- Model load and audio open.
- Basic ASR path sanity check.

### Wake detection tests
- Fixture replay tests for known wake phrases.
- False positive fixtures for similar speech and silence.
- Confidence threshold regression checks.

### Latency tests
- Measure capture-to-wake latency on audio fixtures.
- Ensure ASR decode loop runtime remains bounded.

### Long-run stability tests
- Soak tests with continuous runtime operation.
- Worker heartbeat and restart monitoring.

### Memory leak tests
- Monitor heap usage over long-duration runtimes.
- Track queue growth and budget zone pressure.

### Regression firewall
- All phases must run the baseline regression suite before merge.
- Any failure blocks phase promotion.

---

## 6. Rollback Strategy

### Phase-level checkpoints
- Phase 0: immutable baseline snapshot.
- Phase 1: compatibility wrappers and path redirects.
- Phase 2: FSM wrappers that can be disabled.
- Phase 3: telemetry instrumentation toggles.
- Phase 4: hardening guards with runtime switches.
- Phase 5: config loader fallback to legacy schema.
- Phase 6: supervisor fallback to direct runtime launch.
- Phase 7: transport fallback to known working channel.
- Phase 8: SDK fallback to existing control API.
- Phase 9: bootstrapper fallback to manual venv install.
- Phase 10: packaging limited by supported platforms.
- Phase 11: performance flags allow conservative defaults.

### Safe revert rules
- Preserve a runnable baseline at every commit boundary.
- Use feature flags and compatibility shims, not immediate deletion.
- Do not merge structural changes without a working fallback path.

### Rollback triggers
- Any wake accuracy regression.
- Any startup failure on the baseline environment.
- Any durability failure on soak or recovery tests.

---

## 7. Risk Analysis

### Phase 0
- Technical risk: low
- Regression risk: none
- Concurrency risk: none
- Platform risk: low
- Packaging risk: low

### Phase 1
- Technical risk: medium (import and bootstrap breakage)
- Regression risk: medium
- Concurrency risk: low
- Platform risk: low
- Packaging risk: low

### Phase 2
- Technical risk: high (lifecycle behavior changes)
- Regression risk: high
- Concurrency risk: medium
- Platform risk: low
- Packaging risk: low

### Phase 3
- Technical risk: medium (instrumentation side effects)
- Regression risk: medium
- Concurrency risk: low
- Platform risk: low
- Packaging risk: low

### Phase 4
- Technical risk: high (failure recovery and timeouts)
- Regression risk: high
- Concurrency risk: high
- Platform risk: medium
- Packaging risk: low

### Phase 5
- Technical risk: medium (config semantics)
- Regression risk: medium
- Concurrency risk: low
- Platform risk: low
- Packaging risk: low

### Phase 6
- Technical risk: high (process isolation)
- Regression risk: high
- Concurrency risk: high
- Platform risk: medium
- Packaging risk: medium

### Phase 7
- Technical risk: medium
- Regression risk: medium
- Concurrency risk: medium
- Platform risk: medium
- Packaging risk: medium

### Phase 8
- Technical risk: medium
- Regression risk: medium
- Concurrency risk: low
- Platform risk: medium
- Packaging risk: medium

### Phase 9
- Technical risk: high
- Regression risk: medium
- Concurrency risk: low
- Platform risk: high
- Packaging risk: high

### Phase 10
- Technical risk: medium
- Regression risk: medium
- Concurrency risk: low
- Platform risk: high
- Packaging risk: high

### Phase 11
- Technical risk: medium
- Regression risk: medium
- Concurrency risk: medium
- Platform risk: medium
- Packaging risk: low

### Phase 12
- Technical risk: low
- Regression risk: low
- Concurrency risk: low
- Platform risk: medium
- Packaging risk: medium

---

## 8. Definition of Done

### Phase 0
- Baseline snapshot committed.
- Regression suite and smoke tests pass.
- `requirements.lock.txt` exists.

### Phase 1
- Runtime folder structure is in place.
- Imports resolve and compatibility wrappers exist.
- Wake engine behavior is identical.

### Phase 2
- Runtime and subsystem FSMs exist.
- No deadlocks or stuck transitions.
- Wake accuracy preserved.

### Phase 3
- Structured telemetry is emitted.
- Diagnostics API exposes runtime health.
- Observability does not alter behavior.

### Phase 4
- Watchdogs, recovery, and queue protections are active.
- Soak and failure recovery tests pass.

### Phase 5
- Config schema and migration are implemented.
- Invalid config rejection is active.

### Phase 6
- Supervisor works and isolates worker crashes.
- Restart throttling operates safely.

### Phase 7
- WebSocket transport works end-to-end.
- Protocol validation and reconnect logic are in place.

### Phase 8
- Node SDK public API is stable and documented.
- Electron/Node integration works.

### Phase 9
- Embedded bootstrapper installs and verifies runtime.
- Fresh checkout can start without manual environment setup.

### Phase 10
- Cross-platform packaging is verified.
- Cold install tests pass.

### Phase 11
- Benchmark suite exists.
- Performance targets are met.

### Phase 12
- Public release documentation is complete.
- Release checklist passes.

---

## 9. MVP Boundary

### In-scope for V1
- Wake detection with configurable phrases and variants.
- Supervisor + worker isolation.
- Structured WebSocket transport.
- Node SDK with lifecycle and event APIs.
- Model auto-download and verification.
- Runtime supervision, recovery, and observability.
- Diagnostics and health reporting.

### Out-of-scope for V1
- Plugin SDK or runtime plugin hosting.
- DAG pipeline execution engine.
- Distributed multi-session runtime.
- Replay persistence and long-term storage.
- Alternative transports beyond WebSocket.
- Browser/WASM runtime or direct browser embedding.
- Speaker ID, multilingual models, or cloud sync.

---

## 10. Future Roadmap Section

### Future ideas (not part of current implementation)
- Plugin-based custom matcher stages.
- Graph-based pipeline execution.
- gRPC / TCP transport alternatives.
- Live config patching and feature flags.
- Replay capture / deterministic replay debugging.
- Full snapshot restore and runtime rewind.
- Multi-session, multi-tenant runtime.
- Advanced audio backends beyond PortAudio.
- Cloud-enabled wake aggregation and analytics.

### Roadmap guardrails
- These items remain future work until the production runtime is stable.
- No phase in this implementation plan should be extended to include them without a separate release plan.

---

## Execution discipline
- Before writing code, stabilize implementation order.
- Every phase must maintain a runnable baseline.
- Behavior regressions are unacceptable.
- Architecture changes must be executed as migration steps, not rewrites.
- Observability and recoverability are first-class engineering goals.
