#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARVSAL VAD Test Harness
========================
Standalone validation tool — no running server required.

Usage:
  python vad_test.py                          # interactive test menu
  python vad_test.py --wav <path>             # test a specific WAV file
  python vad_test.py --sweep --dir <dir>      # sweep a directory of WAVs
  python vad_test.py --worker-health          # check model path and ONNX load

Tests map to V1-V5 of ARVSAL_SILERO_VAD_IMPLEMENTATION_SPEC.md Section 7.
"""

import sys
import io

# Force UTF-8 stdout so Unicode symbols don't crash on Windows cp1252 consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import os
import json
import argparse
import time
import wave
import struct
import subprocess
import platform

# ── Resolve vad_worker module ─────────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

from vad_worker import load_model, read_wav_float32, analyze_audio, _get_model_path


# ── Terminal helpers ──────────────────────────────────────────────────────────

GREEN  = '\033[92m'
RED    = '\033[91m'
YELLOW = '\033[93m'
CYAN   = '\033[96m'
RESET  = '\033[0m'
BOLD   = '\033[1m'


def _ok(msg):   print(f"  {GREEN}✓ PASS{RESET}  {msg}")
def _fail(msg): print(f"  {RED}✗ FAIL{RESET}  {msg}")
def _warn(msg): print(f"  {YELLOW}⚠ WARN{RESET}  {msg}")
def _info(msg): print(f"  {CYAN}ℹ INFO{RESET}  {msg}")


# ── Test: model health ────────────────────────────────────────────────────────

def test_worker_health() -> bool:
    print(f"\n{BOLD}[V2] Worker Health / Model Check{RESET}")
    model_path = _get_model_path()
    _info(f"Model path: {model_path}")

    if not os.path.isfile(model_path):
        _fail(f"silero_vad.onnx NOT FOUND at {model_path}")
        _info("Re-run: npm install  (triggers npx ava-listener setup)")
        return False

    _ok(f"Model file found ({os.path.getsize(model_path) // 1024} KB)")

    try:
        t0 = time.perf_counter()
        load_model()
        elapsed = (time.perf_counter() - t0) * 1000
        _ok(f"ONNX session loaded in {elapsed:.1f} ms")
        return True
    except Exception as exc:
        _fail(f"ONNX load failed: {exc}")
        return False


# ── Synthetic WAV generators ──────────────────────────────────────────────────

def _make_silence_wav(path: str, duration_s: float = 3.0):
    """Write a WAV file containing digital silence."""
    n = int(16000 * duration_s)
    samples = b'\x00\x00' * n
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(samples)


def _make_tone_wav(path: str, freq: float = 1000.0, duration_s: float = 3.0, amp: float = 0.3):
    """Write a WAV file with a pure sine tone (mimics non-speech audio)."""
    import math
    n = int(16000 * duration_s)
    samples = bytes()
    for i in range(n):
        v = int(amp * 32767 * math.sin(2 * math.pi * freq * i / 16000))
        samples += struct.pack('<h', v)
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(samples)


# ── Test: silence rejection ───────────────────────────────────────────────────

def test_silence_rejection(threshold: float = 0.35, min_speech_ms: float = 400.0) -> bool:
    print(f"\n{BOLD}[V3] Silence Rejection Test{RESET}")
    import tempfile

    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp = f.name

    passed = True
    try:
        _make_silence_wav(tmp, duration_s=3.0)
        audio, _ = read_wav_float32(tmp)
        t0 = time.perf_counter()
        result = analyze_audio(audio, threshold, min_speech_ms)
        elapsed = (time.perf_counter() - t0) * 1000

        _info(f"maxProb={result['maxProb']:.4f}  speechDurationMs={result['speechDurationMs']}  elapsed={elapsed:.1f}ms")

        if result['pass']:
            _fail(f"Silence was NOT rejected (maxProb={result['maxProb']:.4f})")
            passed = False
        else:
            _ok(f"Silence correctly rejected in {elapsed:.1f} ms")
    finally:
        os.unlink(tmp)

    return passed


# ── Test: speech acceptance ───────────────────────────────────────────────────

def test_wav_file(wav_path: str, expected_pass: bool, label: str,
                  threshold: float = 0.35, min_speech_ms: float = 400.0) -> bool:
    print(f"\n{BOLD}[Test] {label}{RESET}")

    if not os.path.isfile(wav_path):
        _warn(f"WAV not found, skipping: {wav_path}")
        return True  # not a failure — test file simply not available

    try:
        audio, n = read_wav_float32(wav_path)
        dur = n / 16000.0
    except Exception as exc:
        _fail(f"Read failed: {exc}")
        return False

    _info(f"File: {wav_path}  duration={dur:.2f}s  samples={n}")

    t0 = time.perf_counter()
    result = analyze_audio(audio, threshold, min_speech_ms)
    elapsed = (time.perf_counter() - t0) * 1000

    _info(f"pass={result['pass']}  maxProb={result['maxProb']:.4f}  "
          f"speechDur={result['speechDurationMs']}ms  "
          f"start={result['speechStartMs']}ms  end={result['speechEndMs']}ms  "
          f"elapsed={elapsed:.1f}ms")

    if result['pass'] == expected_pass:
        _ok(f"Expected {'ACCEPT' if expected_pass else 'REJECT'} — got correct result")
        return True
    else:
        _fail(f"Expected {'ACCEPT' if expected_pass else 'REJECT'} — got {'ACCEPT' if result['pass'] else 'REJECT'}")
        return False


# ── Test: persistent worker via subprocess ────────────────────────────────────

def test_persistent_worker_ipc() -> bool:
    print(f"\n{BOLD}[V2/V5] Persistent Worker IPC Test{RESET}")
    import tempfile

    # Find Python
    python = sys.executable

    # Find worker script
    worker_script = os.path.join(_HERE, 'vad_worker.py')
    if not os.path.isfile(worker_script):
        _fail(f"vad_worker.py not found at {worker_script}")
        return False

    # Generate a silence WAV for testing
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp_wav = f.name
    _make_silence_wav(tmp_wav, 3.0)

    try:
        proc = subprocess.Popen(
            [python, worker_script, '--persistent'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )

        # Read ready signal (timeout 15s)
        import select, threading

        ready_line = None
        def _read_ready():
            nonlocal ready_line
            ready_line = proc.stdout.readline()

        t = threading.Thread(target=_read_ready, daemon=True)
        t.start()
        t.join(timeout=15)

        if not ready_line:
            _fail("Worker did not send ready signal within 15s")
            proc.kill()
            return False

        try:
            ready = json.loads(ready_line.strip())
        except Exception:
            _fail(f"Worker sent invalid ready JSON: {ready_line!r}")
            proc.kill()
            return False

        if not ready.get('ready'):
            _fail(f"Worker startup failed: {ready.get('error', ready_line)}")
            proc.kill()
            return False

        _ok("Worker started and sent ready signal")

        # Send a request
        req = json.dumps({
            'id': 'test-001',
            'wavPath': os.path.abspath(tmp_wav),
            'threshold': 0.35,
            'minSpeechMs': 400,
        }) + '\n'
        proc.stdin.write(req)
        proc.stdin.flush()

        resp_line = None
        def _read_resp():
            nonlocal resp_line
            resp_line = proc.stdout.readline()

        t2 = threading.Thread(target=_read_resp, daemon=True)
        t2.start()
        t2.join(timeout=10)

        if not resp_line:
            _fail("Worker did not respond to request within 10s")
            proc.kill()
            return False

        try:
            resp = json.loads(resp_line.strip())
        except Exception:
            _fail(f"Worker sent invalid response JSON: {resp_line!r}")
            proc.kill()
            return False

        _ok(f"Worker responded: pass={resp.get('pass')} maxProb={resp.get('maxProb')}")

        # Graceful shutdown
        proc.stdin.write(json.dumps({'shutdown': True}) + '\n')
        proc.stdin.flush()
        proc.stdin.close()
        proc.wait(timeout=5)
        _ok("Worker shut down cleanly")
        return True

    except Exception as exc:
        _fail(f"IPC test exception: {exc}")
        try: proc.kill()
        except: pass
        return False
    finally:
        os.unlink(tmp_wav)


# ── Threshold sweep ───────────────────────────────────────────────────────────

def threshold_sweep(wav_dir: str):
    """
    V7 — Sweep a directory of WAV files over threshold range 0.15-0.55.
    Files named 'speech_*' are expected to ACCEPT; 'noise_*' and 'silence_*' to REJECT.
    """
    print(f"\n{BOLD}[V7] Threshold Calibration Sweep — {wav_dir}{RESET}")

    wavs = [f for f in os.listdir(wav_dir) if f.endswith('.wav')]
    if not wavs:
        _warn(f"No .wav files found in {wav_dir}")
        return

    thresholds = [0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55]

    print(f"\n{'Threshold':>10} {'Speech Accept %':>16} {'Noise Reject %':>15} {'Recommended':>12}")
    print('-' * 60)

    for thresh in thresholds:
        speech_pass = 0; speech_total = 0
        noise_reject = 0; noise_total = 0

        for fname in wavs:
            fpath = os.path.join(wav_dir, fname)
            try:
                audio, _ = read_wav_float32(fpath)
                result = analyze_audio(audio, thresh, 400.0)
            except Exception:
                continue

            base = fname.lower()
            if base.startswith('speech_'):
                speech_total += 1
                if result['pass']: speech_pass += 1
            elif base.startswith('noise_') or base.startswith('silence_'):
                noise_total += 1
                if not result['pass']: noise_reject += 1

        sp_pct = (speech_pass / speech_total * 100) if speech_total else float('nan')
        nr_pct = (noise_reject / noise_total * 100) if noise_total else float('nan')
        rec    = '★ GOOD' if sp_pct >= 97 and nr_pct >= 90 else ''
        print(f"{thresh:>10.2f} {sp_pct:>15.1f}% {nr_pct:>14.1f}% {rec:>12}")

    print()
    _info("Set ARVSAL_VAD_THRESHOLD in .env to the lowest threshold marked ★ GOOD")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='ARVSAL VAD Test Harness')
    parser.add_argument('--wav',          metavar='PATH',    help='Test a single WAV file')
    parser.add_argument('--expect',       choices=['pass', 'fail'], default='pass',
                        help='Expected outcome for --wav test')
    parser.add_argument('--sweep',        action='store_true', help='Run threshold sweep')
    parser.add_argument('--dir',          metavar='DIR',     help='Directory of WAVs for sweep')
    parser.add_argument('--worker-health',action='store_true', help='Check model + ONNX load')
    parser.add_argument('--ipc-test',     action='store_true', help='Test persistent worker IPC')
    parser.add_argument('--threshold',    type=float, default=0.35)
    parser.add_argument('--min-speech-ms',type=float, default=400.0)
    parser.add_argument('--all',          action='store_true', help='Run all built-in tests')
    args = parser.parse_args()

    all_ok = True

    if args.worker_health or args.all:
        all_ok &= test_worker_health()

    if args.all or (not any([args.wav, args.sweep, args.worker_health, args.ipc_test])):
        # Load model for built-in tests
        try:
            load_model()
        except Exception as exc:
            print(f"\n{RED}Cannot load model: {exc}{RESET}")
            sys.exit(1)
        all_ok &= test_silence_rejection(args.threshold, args.min_speech_ms)

    if args.ipc_test or args.all:
        all_ok &= test_persistent_worker_ipc()

    if args.wav:
        try:
            load_model()
        except Exception as exc:
            print(f"\n{RED}Cannot load model: {exc}{RESET}")
            sys.exit(1)
        expected = args.expect == 'pass'
        all_ok &= test_wav_file(args.wav, expected, os.path.basename(args.wav),
                                 args.threshold, args.min_speech_ms)

    if args.sweep and args.dir:
        try:
            load_model()
        except Exception as exc:
            print(f"\n{RED}Cannot load model: {exc}{RESET}")
            sys.exit(1)
        threshold_sweep(args.dir)

    print()
    if all_ok:
        print(f"{GREEN}{BOLD}All tests passed.{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}{BOLD}One or more tests FAILED.{RESET}")
        sys.exit(1)


if __name__ == '__main__':
    main()
