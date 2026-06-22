#!/bin/bash
set -e

echo "============================================="
echo "   Expense Manager Docker Run Script"
echo "============================================="

# 1. Check if docker and docker-compose/docker compose are available
if ! command -v docker &> /dev/null; then
    echo "[-] Docker is not found in PATH."
    if command -v brew &> /dev/null; then
        echo "[*] Installing colima, docker, and docker-compose via Homebrew..."
        brew install colima docker docker-compose
        
        # Configure Docker Compose CLI Plugin config
        mkdir -p ~/.docker
        echo '{"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]}' > ~/.docker/config.json
    else
        echo "[!] Error: Homebrew is not installed. Please install Homebrew or Docker manually."
        exit 1
    fi
fi

# 2. Check if Docker daemon is running
if ! docker ps &> /dev/null; then
    echo "[*] Docker daemon is not running. Starting Colima container runtime..."
    if ! command -v colima &> /dev/null; then
        if command -v brew &> /dev/null; then
            echo "[*] Installing Colima via Homebrew..."
            brew install colima
        else
            echo "[!] Error: Colima is not installed. Please install Colima or start Docker Desktop."
            exit 1
        fi
    fi
    colima start
fi

# 3. Build and run containers
echo "[*] Building and launching containers in the background..."
docker compose up --build -d

# 4. Show success status and URL
echo "============================================="
echo "[+] SUCCESS: Expense Manager is running!"
echo "---------------------------------------------"
echo "Frontend App: http://localhost"
echo "Backend API Health: http://localhost/api/health"
echo "============================================="
