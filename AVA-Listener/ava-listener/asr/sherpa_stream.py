"""
AVAListener — Sherpa-ONNX Streaming ASR
=========================================
Queue-decoupled realtime pipeline.

Architecture
------------
  sounddevice callback (audio thread — must be ultrafast)
    └─ queue.put(chunk)            ← only operation; never blocks; never drops

  ASR worker thread (reads queue sequentially; can take any amount of time)
    ├─ accept_waveform()           ← EVERY chunk, speech AND silence
    ├─ decode_stream()             ← continuous acoustic context always maintained
    ├─ VAD check                  ← gates on_hypothesis() only, NOT audio delivery
    ├─ peak / stability tracking
    └─ on_hypothesis(text, stab, peak)   ← only called when VAD detects speech

Why this matters
----------------
Old design: all ONNX inference ran inside the sounddevice callback.
Callback budget = BLOCK_SIZE / SAMPLE_RATE = 1600/16000 = 100ms.
Zipformer decode = 40–80ms. Combined > 100ms → audio driver drops frames
→ effective sample rate drops to ~15 518 Hz → corrupted acoustic context
→ degraded transcription.

New design: callback is O(1) — just a queue.put(). Worker thread takes however
long it needs. sounddevice's internal ring buffer absorbs the latency gap.
No frames are ever dropped.

VAD semantic
------------
VAD previously gated accept_waveform() — silence frames were never fed to
Sherpa, creating discontinuities in the acoustic feature stream.
Now every frame reaches accept_waveform(). VAD only controls whether we
invoke the matcher. This preserves the model's continuous internal state.

Callback
--------
  on_hypothesis(text: str, stability: int, peak: str, generation_id: int)
    text          — current partial hypothesis from Sherpa (lower-cased, stripped)
    stability     — consecutive frames the text was unchanged (0 = just changed)
    peak          — longest hypothesis decoded since last stream reset
    generation_id — increments on every stream reset; used by engine for
                    utterance-level duplicate suppression
"""

import queue
import threading
import time

import numpy as np
import sounddevice as sd
import sherpa_onnx
import os

from config.settings import (
    SAMPLE_RATE, BLOCK_SIZE, NUM_THREADS, MODELS_DIR,
    ENDPOINT_RULE1_SILENCE, ENDPOINT_RULE2_SILENCE,
    ENDPOINT_RULE3_UTTERANCE, SILENCE_RESET_FRAMES,
    TRAILING_PAD_FRAMES,
    AUDIO_QUEUE_MAX, WORKER_QUEUE_TIMEOUT,
    DEBUG_VAD_BYPASS,
    MIN_SPEECH_FRAMES, MIN_SILENCE_FRAMES,
    MIN_SPEECH_MS, MIN_VALID_UTTERANCE_MS,
    RESET_COOLDOWN_SECONDS, IDLE_STREAM_TIMEOUT_S,
)
from audio.vad import HybridVAD
from utils.logger import get_logger, DEBUG_VAD, DEBUG_SHERPA, DEBUG_TRANSCRIPT_PARTIAL, DEBUG_TRANSCRIPT_FINAL

log = get_logger("sherpa_stream")


class SherpaStreamer:
    """
    Microphone → queue → ASR worker → on_hypothesis callback.

    Usage:
        streamer = SherpaStreamer()
        streamer.start(on_hypothesis_fn)   # blocks until stop() is called
        streamer.stop()
    """

    def __init__(self):
        self._load_recognizer()
        self._vad = HybridVAD()

        # Inter-thread communication
        self._audio_queue: queue.Queue = queue.Queue()
        self._stop_event  = threading.Event()

        # ASR stream state (owned exclusively by worker thread)
        self._stream              = None   # created fresh in worker
        self._silence_frames: int = 0
        self._trailing_pad:   int = 0
        self._last_hypothesis: str = ""
        self._stable_frames:   int = 0
        self._peak_hypothesis: str = ""
        self._peak_length:     int = 0

        # Hysteresis state
        self._is_speaking: bool = False
        self._consecutive_speech: int = 0
        self._consecutive_silence: int = 0
        self._has_spoken_in_generation: bool = False

        # Utterance generation counter.
        # Increments on every _reset_stream() call (silence timeout).
        # Passed to on_hypothesis so the engine can suppress duplicate triggers
        # from the same stabilized hypothesis — generation gate is the PRIMARY
        # duplicate suppression mechanism; cooldown is secondary.
        self._generation_id: int = 0

        # Stream lifetime and reset telemetry
        self._last_stream_activity = time.monotonic()
        self._last_reset_time = self._last_stream_activity
        self._stream_start_time = self._last_stream_activity
        self._reset_count = 0
        self._stream_lifetimes: list[float] = []
        self._worker_heartbeat = time.monotonic()
        self._worker_thread: threading.Thread | None = None

        # Diagnostics
        self._callback_count:  int = 0
        self._queue_warn_logged = False

    # ── Public API ─────────────────────────────────────────────────────────────

    def start(self, on_hypothesis) -> None:
        """
        Open microphone, start ASR worker thread, block until stop() is called
        or KeyboardInterrupt.

        on_hypothesis(text: str, stability: int, peak: str) is called from the
        worker thread whenever Sherpa produces a non-empty result during speech.
        """
        self._stop_event.clear()
        self._stream = self._recognizer.create_stream()

        # Start worker thread BEFORE opening the mic so it's ready to consume
        worker = threading.Thread(
            target=self._worker,
            args=(on_hypothesis,),
            daemon=True,
            name="asr-worker",
        )
        self._worker_thread = worker
        worker.start()
        log.info("ASR worker thread started")

        # Open mic — callback is deliberately minimal (just queue.put)
        with sd.InputStream(
            channels=1,
            samplerate=SAMPLE_RATE,
            dtype="float32",
            blocksize=BLOCK_SIZE,
            callback=self._audio_callback,
        ):
            log.info(
                "🎤 Mic open | BLOCK=%d (%dms) | RATE=%d",
                BLOCK_SIZE, BLOCK_SIZE * 1000 // SAMPLE_RATE, SAMPLE_RATE,
            )
            # Keep mic open until stop() is requested
            while not self._stop_event.is_set():
                time.sleep(0.2)

        # Signal worker to drain and exit
        self._stop_event.set()
        worker.join(timeout=5.0)
        if worker.is_alive():
            log.warning("ASR worker did not exit cleanly within 5s")

    def stop(self) -> None:
        """Signal the stream to stop. start() will return shortly after."""
        self._stop_event.set()

    # ── Audio callback (runs in sounddevice audio thread) ──────────────────────

    def _audio_callback(self, indata, frames, time_info, status) -> None:
        """
        Called by sounddevice on every audio block.

        CRITICAL: this function MUST return in << 1ms.
        The only permitted operation is copying audio into the queue.
        No VAD, no ONNX, no logging, no Python GC pressure.
        """
        if status:
            # Log via a separate thread to avoid blocking here
            # status is a sounddevice.CallbackFlags object; convert to str safely
            log.warning("sounddevice status: %s", status)

        # Extract mono float32 and enqueue — copy() is mandatory; indata is a
        # view into a reused buffer that will be overwritten on the next callback
        chunk = indata[:, 0].copy()   # shape: (BLOCK_SIZE,), dtype float32
        self._audio_queue.put_nowait(chunk)
        self._callback_count += 1

        # Warn if queue is growing (worker falling behind) — but log only once
        # to avoid flooding. Uses an approximate check (no lock needed).
        qsize = self._audio_queue.qsize()
        if qsize > AUDIO_QUEUE_MAX and not self._queue_warn_logged:
            self._queue_warn_logged = True
            log.warning(
                "Audio queue depth %d > %d — ASR worker falling behind. "
                "Possible causes: slow ONNX, CPU contention.",
                qsize, AUDIO_QUEUE_MAX,
            )

    # ── ASR worker (runs in dedicated thread) ──────────────────────────────────

    def _worker(self, on_hypothesis) -> None:
        """
        Consumer thread: reads audio from queue, feeds Sherpa, calls on_hypothesis.

        Key invariants:
          - Every chunk from the queue reaches accept_waveform() — no drops.
          - VAD only gates on_hypothesis() invocation, not ASR feeding.
          - Stream resets only after SILENCE_RESET_FRAMES consecutive silent chunks.
        """
        log.debug("ASR worker: entering processing loop")
        last_qsize_log = time.monotonic()
        chunk_count = 0
        vad_latency = 0.0

        while not self._stop_event.is_set():
            # ── Drain queue ─────────────────────────────────────────────────
            try:
                chunk = self._audio_queue.get(timeout=WORKER_QUEUE_TIMEOUT)
            except queue.Empty:
                # No audio for WORKER_QUEUE_TIMEOUT seconds — normal during silence
                continue

            chunk_count += 1

            # ── VAD decision (does NOT gate audio delivery immediately) ──────
            # Run the hybrid WebRTC + Silero pipeline
            t0 = time.perf_counter()
            vad_res = self._vad.process_chunk(chunk)
            vad_latency = (time.perf_counter() - t0) * 1000
            chunk_speech = vad_res["pass"]

            # Per-frame VAD diagnostic — only when DEBUG_VAD is on
            if DEBUG_VAD and vad_res["rms"] >= 0.0001:
                log.debug(
                    "[VAD] webrtc=%s silero_prob=%.2f silero_pass=%s rms=%.4f peak=%.3f pass=%s",
                    vad_res["webrtc"], vad_res["silero_prob"], vad_res["silero_pass"],
                    vad_res["rms"], vad_res["peak"], chunk_speech
                )

            # ── Speech State Hysteresis (Phase 4A Calibration) ───────────────
            if chunk_speech:
                self._consecutive_speech += 1
                self._consecutive_silence = 0
                if self._consecutive_speech >= MIN_SPEECH_FRAMES and not self._is_speaking:
                    self._is_speaking = True
                    self._utterance_start_time = time.monotonic()
                    self._has_spoken_in_generation = True
                    log.info("🎤 Speech started")
            else:
                self._consecutive_silence += 1
                self._consecutive_speech = 0
                if self._consecutive_silence >= MIN_SILENCE_FRAMES and self._is_speaking:
                    self._is_speaking = False
                    duration_ms = 0.0
                    if hasattr(self, "_utterance_start_time"):
                        duration_ms = (time.monotonic() - self._utterance_start_time) * 1000.0
                    if duration_ms < MIN_VALID_UTTERANCE_MS:
                        log.info(
                            "🔕 Ignored ultra-short burst: %.0fms (noise threshold)" ,
                            duration_ms,
                        )
                    else:
                        log.info("🔇 Speech ended")
                    self._last_valid_speech_duration = duration_ms

            # In bypass mode, feed ASR regardless of VAD decision.
            effective_speech = True if DEBUG_VAD_BYPASS else self._is_speaking

            # Force an ASR flush if non-speech duration exceeds timeout AND we actually spoke.
            # Do NOT reset during total starvation (prevents reset storms).
            partial_tokens = ["wake", "listen", "hey", "ar", "arv", "arbe", "wake up"]
            is_partial = any(tok in self._last_hypothesis for tok in partial_tokens)
            silence_timeout = 25 if is_partial else 18
            silence_time = self._consecutive_silence * (BLOCK_SIZE / SAMPLE_RATE)

            if self._consecutive_silence >= silence_timeout:
                now = time.monotonic()
                if self._consecutive_silence == silence_timeout and self._has_spoken_in_generation:
                    if now - self._last_reset_time >= RESET_COOLDOWN_SECONDS:
                        lifetime = now - self._stream_start_time
                        log.debug(
                            "[VAD] non_speech_duration > %.1fs → forced stream reset",
                            silence_timeout * (BLOCK_SIZE / SAMPLE_RATE),
                        )
                        self._reset_stream(reason="inactivity")
                        self._stream_lifetimes.append(lifetime)
                
                if not DEBUG_VAD_BYPASS:
                    continue

            if not self._stop_event.is_set():
                self._last_stream_activity = time.monotonic()

            # ── Feed Sherpa — Only during speech or trailing pad ─────────────
            if effective_speech:
                self._stream.accept_waveform(SAMPLE_RATE, chunk)
                self._trailing_pad = 0
            else:
                # Give Sherpa trailing context to cleanly finalize current hypothesis
                if self._trailing_pad < TRAILING_PAD_FRAMES:
                    self._stream.accept_waveform(SAMPLE_RATE, chunk)
                    self._trailing_pad += 1
                else:
                    # True silence: feed zeros to advance time without injecting noise
                    silence = np.zeros(len(chunk), dtype=np.float32)
                    self._stream.accept_waveform(SAMPLE_RATE, silence)

            # Periodic Queue/VAD diagnostic log (every 30s)
            now = time.monotonic()
            if now - last_qsize_log >= 30.0:
                qsize = self._audio_queue.qsize()
                if DEBUG_SHERPA:
                    log.debug(
                        "worker: chunks=%d qsize=%d vad_ms=%.1f drops[webrtc=%d silero=%d] passed=%d",
                        chunk_count, qsize, vad_latency,
                        self._vad.stats['webrtc_dropped'],
                        self._vad.stats['silero_dropped'],
                        self._vad.stats['speech_passed']
                    )
                last_qsize_log = now
                self._queue_warn_logged = False

            # ── Decode ───────────────────────────────────────────────────────
            while self._recognizer.is_ready(self._stream):
                self._recognizer.decode_stream(self._stream)

            result = self._recognizer.get_result(self._stream).strip().lower()

            if not result:
                continue

            # ── Transcript logging ─────────────────────────────────────────────
            # Log partial transcripts during speech, final transcripts at end of utterance
            is_final = not effective_speech and self._trailing_pad <= TRAILING_PAD_FRAMES
            if DEBUG_TRANSCRIPT_PARTIAL and not is_final:
                log.debug(
                    "[ASR] partial | gen=%d stab=%d | '%s'",
                    self._generation_id, self._stable_frames, result
                )
            elif DEBUG_TRANSCRIPT_FINAL and is_final:
                log.info(
                    "[ASR] final | gen=%d stab=%d len=%d | '%s'",
                    self._generation_id, self._stable_frames, len(result), result
                )

            # ── Peak tracking ────────────────────────────────────────────────
            if len(result) > self._peak_length:
                self._peak_hypothesis = result
                self._peak_length     = len(result)

            # ── Stability tracking ───────────────────────────────────────────
            if result == self._last_hypothesis:
                self._stable_frames += 1
            else:
                self._stable_frames   = 0
                self._last_hypothesis = result

            # ── Only pass hypothesis to engine during speech ──────────────────
            # During silence, Sherpa may emit stale partial text; suppressing
            # those prevents phantom matches in the window after speech ends.
            if effective_speech:
                on_hypothesis(result, self._stable_frames, self._peak_hypothesis,
                              self._generation_id)
            # (trailing-pad frames: pass through so engine sees the final text)
            elif self._trailing_pad <= TRAILING_PAD_FRAMES:
                on_hypothesis(result, self._stable_frames, self._peak_hypothesis,
                              self._generation_id)

        log.debug("ASR worker: stop event received, exiting")

    # ── Model loading ──────────────────────────────────────────────────────────

    def _load_recognizer(self) -> None:
        enc = os.path.join(MODELS_DIR, "encoder.onnx")
        dec = os.path.join(MODELS_DIR, "decoder.onnx")
        joi = os.path.join(MODELS_DIR, "joiner.onnx")
        tok = os.path.join(MODELS_DIR, "tokens.txt")

        for path, label in [
            (enc, "encoder"), (dec, "decoder"),
            (joi, "joiner"),  (tok, "tokens"),
        ]:
            if not os.path.isfile(path):
                raise FileNotFoundError(
                    f"Model file missing: {path}\n"
                    f"Download sherpa-onnx-streaming-zipformer-en-2023-06-26 "
                    f"and place files in wakeword/models/"
                )

        log.info("Loading Sherpa ONNX model from %s", MODELS_DIR)
        self._recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
            encoder=enc,
            decoder=dec,
            joiner=joi,
            tokens=tok,
            num_threads=NUM_THREADS,
            sample_rate=SAMPLE_RATE,
            feature_dim=80,
            enable_endpoint_detection=True,
            rule1_min_trailing_silence=ENDPOINT_RULE1_SILENCE,
            rule2_min_trailing_silence=ENDPOINT_RULE2_SILENCE,
            rule3_min_utterance_length=ENDPOINT_RULE3_UTTERANCE,
        )
        log.info("Model loaded ✓")

    # ── Stream lifecycle ───────────────────────────────────────────────────────

    def _reset_stream(self, reason: str = "manual") -> None:
        """Reset ASR stream after long silence or recovery events."""
        now = time.monotonic()
        lifetime = now - self._stream_start_time
        self._last_reset_time = now
        self._stream_start_time = now
        self._reset_count += 1

        # Increment FIRST — any hypothesis emitted after this belongs to new generation.
        self._generation_id  += 1
        log.info(
            "🔄 ASR stream reset → generation %d reason=%s lifetime=%.1fs resets=%d",
            self._generation_id,
            reason,
            round(lifetime, 1),
            self._reset_count,
        )
        self._stream          = self._recognizer.create_stream()
        self._vad.reset_state()
        self._silence_frames  = 0
        self._trailing_pad    = 0
        self._last_hypothesis = ""
        self._stable_frames   = 0
        self._peak_hypothesis = ""
        self._peak_length     = 0
        
        self._is_speaking = False
        self._consecutive_speech = 0
        self._consecutive_silence = 0
        self._has_spoken_in_generation = False
        self._utterance_start_time = now