import subprocess, time, sys, os

python_exe = r"C:\Users\athar\AppData\Local\Programs\Python\Python312\python.exe"
cwd = r'c:\Users\athar\Desktop\AVA-Listener\ava-listener'

print("Starting main.py...")
proc = subprocess.Popen(
    [python_exe, "-u", 'main.py'],
    cwd=cwd,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1
)

print('=== main.py started (PID:', proc.pid, ') ===')
print('Waiting 10 seconds for startup...')
time.sleep(10)

proc.terminate()
stdout, stderr = proc.communicate(timeout=5)

print()
print('=== STDOUT (JSON events) ===')
for line in stdout.strip().splitlines():
    print(' ', line)

print()
print('=== STDERR (last 25 lines) ===')
lines = stderr.strip().splitlines()
for line in lines[-25:]:
    print(' ', line)

print()
model_loaded   = 'Model loaded' in stderr
mic_open       = 'Mic open' in stderr
ready_found    = '"ready"' in stdout
heartbeat_found = '"heartbeat"' in stdout
engine_started = 'AVAListener engine started' in stderr

print('=== STARTUP CHECKS ===')
print('  Sherpa model loaded :', 'PASS' if model_loaded else 'FAIL')
print('  Mic open            :', 'PASS' if mic_open else 'FAIL')
print('  Engine started      :', 'PASS' if engine_started else 'FAIL')
print('  status=ready emit   :', 'PASS' if ready_found else 'FAIL')
print('  Heartbeat emit      :', 'PASS' if heartbeat_found else 'FAIL')

all_pass = all([model_loaded, mic_open, engine_started, ready_found, heartbeat_found])
print()
print('BASELINE STATUS:', 'RESTORED AND VERIFIED' if all_pass else 'ISSUES REMAIN')
