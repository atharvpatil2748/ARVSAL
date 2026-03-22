import pyaudio
import wave
import os

# Settings
SECONDS = 2
RATE = 16000
CHANNELS = 1
FORMAT = pyaudio.paInt16
OUTPUT_DIR = "my_voice_samples"

os.makedirs(OUTPUT_DIR, exist_ok=True)
audio = pyaudio.PyAudio()

print(f"Sir, we are going to record 100 samples. Get ready!")

for i in range(1, 101):
    input(f"Press Enter and say 'Arvsal' (Sample {i}/100)...")
    
    stream = audio.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=1024)
    frames = []

    for _ in range(0, int(RATE / 1024 * SECONDS)):
        data = stream.read(1024)
        frames.append(data)

    stream.stop_stream()
    stream.close()

    file_path = os.path.join(OUTPUT_DIR, f"arvsal_{i}.wav")
    with wave.open(file_path, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(audio.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))
    print(f"Saved: {file_path}")

audio.terminate()
print("\nDone! Now upload the 'my_voice_samples' folder to your Google Colab.")