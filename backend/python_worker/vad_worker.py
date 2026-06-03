#!/usr/bin/env python3
"""
ARVSAL VAD Worker
=================
Standalone Silero ONNX speech detection worker.

Modes:
  --persistent           Read newline-delimited JSON requests from stdin,
                         write responses to stdout. Model loaded once.
  --oneshot '<json>'     Process one request from argv, print result, exit.
"""

import sys
import os
import json
import wave
import argparse
import struct

import numpy as np


# ── Model path resolution ─────────────────────────────────────────────────────

def _get_model_path() -> str:
    """
    Resolve silero_vad.onnx from AVAListener's managed model cache.
    Mirrors the logic in ava-listener/node/runtime_manager.js and
    ava-listener/runtime/config/defaults.py — honours AVA_CACHE_DIR env var.
    """
    import platform

    cache_dir = os.environ.get('AVA_CACHE_DIR')
    if not cache_dir:
        sys_plat = platform.system()
        if sys_plat == 'Windows':
            local_app = os.environ.get(
                'LOCALAPPDATA',
                os.path.join(os.path.expanduser('~'), 'AppData', 'Local')
            )
            cache_dir = os.path.join(local_app, 'AVAListener')
        elif sys_plat == 'Darwin':
            cache_dir = os.path.join(
                os.path.expanduser('~'), 'Library', 'Application Support', 'AVAListener'
            )
        else:
            cache_dir = os.path.join(
                os.path.expanduser('~'), '.local', 'share', 'avalistener'
            )

    return os.path.join(cache_dir, 'models', 'silero_vad.onnx')


# ── ONNX session (module-level singleton) ─────────────────────────────────────

_session = None


def load_model():
    """Load the Silero ONNX model. Raises FileNotFoundError if absent."""
    global _session
    model_path = _get_model_path()
    if not os.path.isfile(model_path):
        raise FileNotFoundError(f"Silero VAD model missing: {model_path}")

    import onnxruntime as ort

    opts = ort.SessionOptions()
    opts.inter_op_num_threads = 1
    opts.intra_op_num_threads = 1
    _session = ort.InferenceSession(
        model_path,
        providers=['CPUExecutionProvider'],
        sess_options=opts,
    )


# ── WAV reader ────────────────────────────────────────────────────────────────

def read_wav_float32(wav_path: str):
    """
    Read a 16kHz mono PCM WAV and return (float32_array, n_samples).
    Validates sample rate and bit depth. Raises on format mismatch.
    """
    with wave.open(wav_path, 'rb') as wf:
        n_channels   = wf.getnchannels()
        sample_width = wf.getsampwidth()
        frame_rate   = wf.getframerate()
        n_frames     = wf.getnframes()
        raw_bytes    = wf.readframes(n_frames)

    if frame_rate != 16000:
        raise ValueError(f"Expected 16kHz, got {frame_rate}Hz: {wav_path}")
    if sample_width != 2:
        raise ValueError(f"Expected 16-bit PCM, got {sample_width * 8}-bit: {wav_path}")

    samples = np.frombuffer(raw_bytes, dtype=np.int16)

    # Collapse multi-channel to mono by taking the first channel
    if n_channels > 1:
        samples = samples[::n_channels]

    return samples.astype(np.float32) / 32768.0, len(samples)


# ── Silero inference constants ────────────────────────────────────────────────

CHUNK_SAMPLES   = 512          # 32 ms @ 16 kHz
CONTEXT_SAMPLES = 64           # CNN overlap required by Silero v4/v5
SR_INT64        = np.array(16000, dtype=np.int64)
MS_PER_CHUNK    = (CHUNK_SAMPLES / 16000.0) * 1000.0   # 32.0 ms


# ── Core analysis ─────────────────────────────────────────────────────────────

def analyze_audio(audio: np.ndarray, threshold: float, min_speech_ms: float) -> dict:
    """
    Evaluate float32 audio through Silero ONNX.
    Resets internal RNN state fresh for each call (stateless per-request semantics).

    Returns a dict compatible with the NDJSON response contract:
      pass, speechStartMs, speechEndMs, maxProb, speechDurationMs
    """
    # Fresh state for every request (spec requirement)
    state   = np.zeros((2, 1, 128), dtype=np.float32)
    context = np.zeros((1, CONTEXT_SAMPLES), dtype=np.float32)

    speech_start_ms  = None
    speech_end_ms    = None
    speech_dur_ms    = 0.0
    max_prob         = 0.0
    frame_start_ms   = 0.0

    # Pad audio so length is a multiple of CHUNK_SAMPLES
    remainder = len(audio) % CHUNK_SAMPLES
    if remainder:
        audio = np.concatenate([audio, np.zeros(CHUNK_SAMPLES - remainder, dtype=np.float32)])

    n_chunks = len(audio) // CHUNK_SAMPLES

    for i in range(n_chunks):
        chunk = audio[i * CHUNK_SAMPLES: (i + 1) * CHUNK_SAMPLES]
        chunk_2d = chunk.reshape(1, -1)                          # (1, 512)

        # Prepend 64-sample context (CNN boundary requirement)
        feed = np.ascontiguousarray(
            np.concatenate([context, chunk_2d], axis=1)          # (1, 576)
        )

        ort_outs = _session.run(
            ['output', 'stateN'],
            {'input': feed, 'state': state, 'sr': SR_INT64},
        )
        prob    = float(ort_outs[0][0][0])
        state   = ort_outs[1]
        context = feed[:, -CONTEXT_SAMPLES:]                     # last 64 samples

        if prob > max_prob:
            max_prob = prob

        if prob >= threshold:
            if speech_start_ms is None:
                speech_start_ms = frame_start_ms
            speech_end_ms  = frame_start_ms + MS_PER_CHUNK
            speech_dur_ms += MS_PER_CHUNK

        frame_start_ms += MS_PER_CHUNK

    passed = speech_start_ms is not None and speech_dur_ms >= min_speech_ms

    return {
        'pass':              passed,
        'speechStartMs':     round(speech_start_ms) if speech_start_ms is not None else None,
        'speechEndMs':       round(speech_end_ms)   if speech_end_ms   is not None else None,
        'maxProb':           round(max_prob, 4),
        'speechDurationMs':  round(speech_dur_ms),
    }


# ── Request dispatcher ────────────────────────────────────────────────────────

def handle_request(req: dict) -> dict:
    req_id       = req.get('id', 'unknown')
    wav_path     = req.get('wavPath', '')
    threshold    = float(req.get('threshold',   0.35))
    min_speech   = float(req.get('minSpeechMs', 400.0))

    try:
        audio, _ = read_wav_float32(wav_path)
    except FileNotFoundError:
        return {'id': req_id, 'error': 'wav_not_found',
                'message': f'Not found: {wav_path}', 'pass': False}
    except Exception as exc:
        return {'id': req_id, 'error': 'wav_read_failed',
                'message': str(exc), 'pass': False}

    try:
        result = analyze_audio(audio, threshold, min_speech)
        result['id'] = req_id
        return result
    except Exception as exc:
        return {'id': req_id, 'error': 'onnx_inference_failed',
                'message': str(exc), 'pass': False}


# ── I/O helpers ───────────────────────────────────────────────────────────────

def _emit(obj: dict) -> None:
    """Write a JSON line to stdout and flush immediately."""
    sys.stdout.write(json.dumps(obj) + '\n')
    sys.stdout.flush()


# ── Persistent mode ───────────────────────────────────────────────────────────

def main_persistent() -> None:
    """
    Start persistent worker:
      1. Load model once.
      2. Signal ready (or failure) on stdout.
      3. Loop reading NDJSON requests from stdin.
      4. Respond to each request on stdout.
      5. Exit cleanly on shutdown sentinel or stdin EOF.
    """
    try:
        load_model()
        _emit({'ready': True})
    except FileNotFoundError as exc:
        _emit({'ready': False, 'error': str(exc)})
        sys.exit(1)
    except Exception as exc:
        _emit({'ready': False, 'error': f'model_load_failed: {exc}'})
        sys.exit(1)

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            _emit({'error': 'invalid_json', 'message': str(exc), 'pass': False})
            continue

        if req.get('shutdown'):
            break

        _emit(handle_request(req))


# ── One-shot mode ─────────────────────────────────────────────────────────────

def main_oneshot(json_str: str) -> None:
    """
    Process a single request encoded as a JSON string in argv.
    Writes exactly one JSON line to stdout and exits.
    Always exits 0 — caller detects errors via 'error' field in JSON.
    """
    try:
        load_model()
    except Exception as exc:
        _emit({'error': 'model_load_failed', 'message': str(exc), 'pass': False})
        sys.exit(0)

    try:
        req = json.loads(json_str)
    except json.JSONDecodeError as exc:
        _emit({'error': 'invalid_json', 'message': str(exc), 'pass': False})
        sys.exit(0)

    _emit(handle_request(req))


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='ARVSAL Silero VAD Worker')
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--persistent', action='store_true',
                       help='Run persistent stdin/stdout NDJSON IPC loop')
    group.add_argument('--oneshot', metavar='JSON',
                       help='Process a single JSON request and exit')
    args = parser.parse_args()

    if args.persistent:
        try:
            main_persistent()
        except KeyboardInterrupt:
            pass
        except Exception as exc:
            _emit({'error': 'worker_crash', 'message': str(exc), 'pass': False})
            sys.exit(1)
    else:
        main_oneshot(args.oneshot)
