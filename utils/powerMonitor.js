const { execFile } = require("child_process");

// ── Cached battery state ───────────────────────────────────────────────────
// WMIC on Windows cold-starts in 2-8 seconds.
// Calling it synchronously (execSync) blocks the entire Node event loop,
// which is why whisper appeared to hang right after "Whisper START".
// Solution: poll async every 30s and expose a synchronous cache getter.

let _onBattery = false; // default: assume plugged in

function _poll() {
  execFile(
    "WMIC",
    ["Path", "Win32_Battery", "Get", "BatteryStatus"],
    { timeout: 5000 },
    (err, stdout) => {
      if (err) {
        _onBattery = false; // no battery info → assume plugged in (desktop)
        return;
      }
      // BatteryStatus 1 = Discharging (on battery)
      // 2 = AC Charging, 6 = Charging → plugged in
      _onBattery = /\b1\b/.test(stdout);
    }
  );
}

// Fire immediately on startup, then every 30 seconds
_poll();
setInterval(_poll, 30_000).unref(); // .unref() so this never keeps process alive

/**
 * Synchronous getter — returns cached value, never blocks event loop.
 */
function isOnBattery() {
  return _onBattery;
}

module.exports = { isOnBattery };
