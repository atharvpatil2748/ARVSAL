#!/bin/bash
# AVAListener Bootstrap Script for Linux/macOS
# This script sets up a clean virtual environment and installs all dependencies

set -e  # Exit on any error

echo "AVAListener Environment Bootstrap"
echo "=================================="
echo

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 is not installed or not in PATH"
    echo "Please install Python 3.10+"
    echo "  Ubuntu/Debian: sudo apt install python3 python3-venv"
    echo "  macOS: brew install python3"
    echo "  Or download from https://python.org"
    exit 1
fi

PYTHON_CMD="python3"
if ! $PYTHON_CMD --version &> /dev/null; then
    PYTHON_CMD="python"
    if ! $PYTHON_CMD --version &> /dev/null; then
        echo "ERROR: No suitable Python found"
        exit 1
    fi
fi

echo "Python found: $($PYTHON_CMD --version)"

# Check Python version
PYTHON_VERSION=$($PYTHON_CMD -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
if [[ "$(printf '%s\n' "$PYTHON_VERSION" "3.10" | sort -V | head -n1)" != "3.10" ]]; then
    echo "ERROR: Python 3.10+ required, found $PYTHON_VERSION"
    exit 1
fi

echo "Creating virtual environment..."

# Remove existing venv if it exists
if [ -d "venv" ]; then
    echo "Removing existing venv..."
    rm -rf venv
fi

# Create new venv
$PYTHON_CMD -m venv venv
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create virtual environment"
    exit 1
fi

echo "Virtual environment created successfully."

# Activate venv and install dependencies
echo "Activating venv and installing dependencies..."
source venv/bin/activate

# Upgrade pip first
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.lock.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi

echo
echo "Bootstrap complete! AVAListener is ready."
echo
echo "To run AVAListener:"
echo "  source venv/bin/activate"
echo "  python main.py"
echo