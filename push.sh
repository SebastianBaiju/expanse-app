#!/bin/bash
set -e

echo "============================================="
echo "   WalletFlow Docker Hub Push Utility"
echo "============================================="

# 1. Detect Docker Context
if docker context ls | grep -q "colima"; then
    echo "[*] Colima context detected. Using 'docker --context colima'."
    DOCKER_CMD="docker --context colima"
else
    echo "[*] Standard docker context detected. Using 'docker'."
    DOCKER_CMD="docker"
fi

# 2. Get Docker Hub Username
read -p "Enter your Docker Hub username [default: sebastianbaiju]: " USERNAME
USERNAME=${USERNAME:-sebastianbaiju}

echo "[*] Using Docker Hub username: $USERNAME"
echo "[*] Checking registry login status..."

# 3. Prompt for login
if ! $DOCKER_CMD login; then
    echo "[-] Login failed. Please run 'docker login' manually and try again."
    exit 1
fi

# 4. Tag Images
echo "[*] Tagging images..."
$DOCKER_CMD tag expense-manager-backend:latest "$USERNAME/expense-manager-backend:latest"
$DOCKER_CMD tag expense-manager-frontend:latest "$USERNAME/expense-manager-frontend:latest"

# 5. Push Images
echo "[*] Pushing backend image..."
$DOCKER_CMD push "$USERNAME/expense-manager-backend:latest"

echo "[*] Pushing frontend image..."
$DOCKER_CMD push "$USERNAME/expense-manager-frontend:latest"

echo "============================================="
echo "[+] SUCCESS: Images successfully pushed to Docker Hub!"
echo "    - $USERNAME/expense-manager-backend:latest"
echo "    - $USERNAME/expense-manager-frontend:latest"
echo "============================================="
