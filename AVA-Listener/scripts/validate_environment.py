#!/usr/bin/env python3
"""
AVAListener Environment Validation Script
=========================================

This script validates that the environment is properly configured
for running AVAListener with all required dependencies and models.
"""

import sys
import os
import importlib
import subprocess
import platform
from pathlib import Path

def check_python_version():
    """Check Python version compatibility."""
    print("🔍 Checking Python version...")
    version = sys.version_info
    version_str = f"{version.major}.{version.minor}.{version.micro}"

    if version.major < 3 or (version.major == 3 and version.minor < 10):
        print(f"❌ Python {version_str} - AVAListener requires Python 3.10+")
        return False

    print(f"✅ Python {version_str}")
    return True

def check_dependencies():
    """Check that all required packages are installed."""
    print("\n🔍 Checking dependencies...")

    required_packages = [
        'numpy',
        'sounddevice',
        'webrtcvad',
        'sherpa_onnx',
        'onnxruntime',
        'rapidfuzz',
        'jellyfish'
    ]

    missing = []
    for package in required_packages:
        try:
            importlib.import_module(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - NOT FOUND")
            missing.append(package)

    if missing:
        print(f"\n❌ Missing packages: {', '.join(missing)}")
        print("Run: pip install -r requirements.lock.txt")
        return False

    return True

def check_models():
    """Check that required model files exist."""
    print("\n🔍 Checking models...")

    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    models_dir = script_dir.parent / "ava-listener" / "models"

    if not models_dir.exists():
        print(f"❌ Models directory not found: {models_dir}")
        return False

    required_files = [
        "decoder.onnx",
        "encoder.onnx",
        "joiner.onnx",
        "silero_vad.onnx",
        "tokens.txt"
    ]

    missing = []
    for filename in required_files:
        filepath = models_dir / filename
        if filepath.exists():
            print(f"✅ {filename}")
        else:
            print(f"❌ {filename} - NOT FOUND")
            missing.append(filename)

    if missing:
        print(f"\n❌ Missing model files: {', '.join(missing)}")
        print("Please ensure all model files are in the models/ directory")
        return False

    return True

def check_audio():
    """Check audio device availability."""
    print("\n🔍 Checking audio devices...")

    try:
        import sounddevice as sd
        devices = sd.query_devices()
        input_devices = [d for d in devices if d['max_input_channels'] > 0]

        if not input_devices:
            print("❌ No input audio devices found")
            return False

        print(f"✅ Found {len(input_devices)} input device(s)")
        return True

    except Exception as e:
        print(f"❌ Audio check failed: {e}")
        return False

def check_onnx_runtime():
    """Check ONNX Runtime configuration."""
    print("\n🔍 Checking ONNX Runtime...")

    try:
        import onnxruntime as ort

        # Check available providers
        providers = ort.get_available_providers()
        print(f"✅ Available providers: {', '.join(providers)}")

        # Check if CPU provider is available
        if 'CPUExecutionProvider' not in providers:
            print("❌ CPUExecutionProvider not available")
            return False

        return True

    except Exception as e:
        print(f"❌ ONNX Runtime check failed: {e}")
        return False

def check_sherpa():
    """Check Sherpa ONNX basic functionality."""
    print("\n🔍 Checking Sherpa ONNX...")

    try:
        import sherpa_onnx
        print("✅ Sherpa ONNX imported successfully")
        return True
    except Exception as e:
        print(f"❌ Sherpa ONNX check failed: {e}")
        return False

def main():
    """Run all validation checks."""
    print("AVAListener Environment Validation")
    print("=" * 40)

    checks = [
        check_python_version,
        check_dependencies,
        check_models,
        check_audio,
        check_onnx_runtime,
        check_sherpa
    ]

    results = []
    for check in checks:
        results.append(check())

    print("\n" + "=" * 40)

    if all(results):
        print("🎉 ENVIRONMENT HEALTH: OK")
        print("AVAListener is ready to run!")
        return 0
    else:
        print("❌ ENVIRONMENT HEALTH: ISSUES FOUND")
        print("Please fix the issues above before running AVAListener.")
        return 1

if __name__ == "__main__":
    sys.exit(main())