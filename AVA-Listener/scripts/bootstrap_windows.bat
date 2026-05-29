@echo off
REM AVAListener Bootstrap Script for Windows
REM This script sets up a clean virtual environment and installs all dependencies

echo AVAListener Environment Bootstrap
echo =================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

echo Python found. Creating virtual environment...

REM Remove existing venv if it exists
if exist venv (
    echo Removing existing venv...
    rmdir /s /q venv
)

REM Create new venv
python -m venv venv
if %errorlevel% neq 0 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

echo Virtual environment created successfully.

REM Activate venv and install dependencies
echo Activating venv and installing dependencies...
call venv\Scripts\activate.bat

REM Upgrade pip first
python -m pip install --upgrade pip

REM Install dependencies
pip install -r requirements.lock.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Bootstrap complete! AVAListener is ready.
echo.
echo To run AVAListener:
echo   venv\Scripts\activate.bat
echo   python main.py
echo.
pause