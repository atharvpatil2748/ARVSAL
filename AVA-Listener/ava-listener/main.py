"""
AVAListener — Entry Point
Run with: python main.py
Designed to be spawned as a child process by Node.js.
stdout → structured JSON events for Node.js
stderr → human-readable debug logs

stdin command protocol (line-delimited, from Node.js):
  pause    → suppress wake detection (pipeline stays warm)
  resume   → reactivate wake detection
  suppress → suppress during TTS/assistant speech
"""
import sys
import os
import threading

# ── Force CPU-only for OnnxRuntime ───────────────────────────────────────────
# Must be set BEFORE any onnxruntime import. On Windows, ort DLL init attempts
# GPU enumeration which can deadlock when CUDA driver is held by Whisper/Ollama.
# Silero VAD uses CPUExecutionProvider, so CUDA is never needed here.
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("ORT_NO_OPERATOR_CUSTOM_OPS", "1")

# Guarantee wakeword/ is on the path regardless of where Python is invoked from
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.engine import WakeEngine


def _stdin_command_reader(engine: WakeEngine) -> None:
    """
    Daemon thread: reads newline-delimited commands from stdin.
    Node.js sends commands by writing to the child process stdin pipe.

    Commands:
        pause    → engine._detection_paused = True  (pipeline stays warm)
        resume   → engine._detection_paused = False
        suppress → engine._detection_paused = True  (alias for TTS suppression)

    This thread exits automatically when stdin closes (process shutdown).
    """
    try:
        for raw_line in sys.stdin:
            cmd = raw_line.strip().lower()
            if cmd == "pause" or cmd == "suppress":
                engine._detection_paused = True
                sys.stderr.write(f"[engine] stdin cmd={cmd!r} → detection PAUSED\n")
                sys.stderr.flush()
            elif cmd == "resume":
                engine._detection_paused = False
                sys.stderr.write("[engine] stdin cmd='resume' → detection ACTIVE\n")
                sys.stderr.flush()
            # Unknown commands are silently ignored for forward compatibility
    except Exception:
        pass  # stdin closed or broken pipe — normal on process exit


if __name__ == "__main__":
    engine = WakeEngine()

    # Start stdin listener BEFORE engine.start() so commands work immediately
    stdin_thread = threading.Thread(
        target=_stdin_command_reader,
        args=(engine,),
        daemon=True,
        name="stdin-cmd",
    )
    stdin_thread.start()

    engine.start()