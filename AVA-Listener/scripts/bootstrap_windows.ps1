# AVAListener Bootstrap Script for Windows PowerShell
# This script sets up a clean virtual environment and installs all dependencies

param(
    [switch]$Force
)

Write-Host "AVAListener Environment Bootstrap" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>$null
    Write-Host "Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.10+ from https://python.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Creating virtual environment..."

# Remove existing venv if it exists
if (Test-Path "venv") {
    if ($Force) {
        Write-Host "Removing existing venv (forced)..."
        Remove-Item -Recurse -Force venv
    } else {
        $response = Read-Host "Virtual environment already exists. Remove it? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            Remove-Item -Recurse -Force venv
        } else {
            Write-Host "Bootstrap cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
}

# Create new venv
python -m venv venv
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create virtual environment" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Virtual environment created successfully." -ForegroundColor Green

# Activate venv and install dependencies
Write-Host "Activating venv and installing dependencies..."
& ".\venv\Scripts\Activate.ps1"

# Upgrade pip first
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.lock.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Bootstrap complete! AVAListener is ready." -ForegroundColor Green
Write-Host ""
Write-Host "To run AVAListener:" -ForegroundColor Cyan
Write-Host "  .\venv\Scripts\Activate.ps1"
Write-Host "  python main.py"
Write-Host ""
Read-Host "Press Enter to exit"