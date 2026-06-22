#!/bin/bash
set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=============================================${NC}"
echo -e "${MAGENTA}   Expense Manager Kubernetes Setup Script   ${NC}"
echo -e "${BLUE}=============================================${NC}"

# 1. Verify if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}[!] kubectl not found. Attempting to install via Homebrew...${NC}"
    if command -v brew &> /dev/null; then
        brew install kubernetes-cli
        echo -e "${GREEN}[+] kubectl successfully installed!${NC}"
    else
        echo -e "${RED}[-] Error: Homebrew is not installed. Please install Homebrew or kubectl manually.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}[+] kubectl is installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
fi

# 2. Check cluster connection
echo -e "${CYAN}[*] Verifying cluster connection...${NC}"
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${YELLOW}[!] Cannot connect to Kubernetes cluster.${NC}"
    
    # Check if colima is running
    if command -v colima &> /dev/null; then
        echo -e "${YELLOW}[!] Colima context detected. Attempting to start/enable Kubernetes in Colima...${NC}"
        echo -e "${CYAN}[*] Running: colima start --kubernetes${NC}"
        colima start --kubernetes
    else
        echo -e "${RED}[-] Error: No active cluster found and Colima is not installed. Please configure your cluster.${NC}"
        exit 1
    fi
fi

# Double check connection after potential colima start
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}[-] Error: Unable to communicate with Kubernetes cluster. Ensure your cluster is running.${NC}"
    exit 1
fi
echo -e "${GREEN}[+] Kubernetes cluster is active and reachable!${NC}"

# 3. Apply manifests in sequence
echo -e "${CYAN}[*] Deploying manifests...${NC}"

# Define files in order of deployment
MANIFESTS=(
    "kubernetes/namespace.yaml"
    "kubernetes/secrets.yaml"
    "kubernetes/postgres.yaml"
    "kubernetes/model.yaml"
    "kubernetes/backend.yaml"
    "kubernetes/frontend.yaml"
    "kubernetes/nginx-proxy.yaml"
    "kubernetes/ingress.yaml"
)

for manifest in "${MANIFESTS[@]}"; do
    if [ -f "$manifest" ]; then
        echo -e "${CYAN}[*] Applying $manifest...${NC}"
        kubectl apply -f "$manifest"
    else
        echo -e "${YELLOW}[!] Warning: Manifest $manifest not found, skipping.${NC}"
    fi
done

# 4. Force a rollout restart of app deployments to pull latest images
echo -e "${CYAN}[*] Restarting deployments to pull latest images...${NC}"
kubectl rollout restart deployment/backend -n exp-management
kubectl rollout restart deployment/frontend -n exp-management
kubectl rollout restart deployment/nginx-proxy -n exp-management

# 5. Wait for deployments to become ready
echo -e "${CYAN}[*] Waiting for deployments to become ready in namespace 'exp-management'...${NC}"
echo -e "${YELLOW}(This might take a minute as images are pulled and services start)${NC}"

# We wait for deployments/statefulsets if they exist
kubectl rollout status statefulset/db -n exp-management --timeout=120s || true
kubectl rollout status deployment/model -n exp-management --timeout=120s || true
kubectl rollout status deployment/backend -n exp-management --timeout=120s || true
kubectl rollout status deployment/frontend -n exp-management --timeout=120s || true
kubectl rollout status deployment/nginx-proxy -n exp-management --timeout=120s || true

# 5. Display Pod status
echo -e "\n${BLUE}=============================================${NC}"
echo -e "${GREEN}[+] Current Pods Status in 'exp-management':${NC}"
echo -e "${BLUE}=============================================${NC}"
kubectl get pods -n exp-management
echo -e "${BLUE}=============================================${NC}"

# 6. Success message
echo -e "${GREEN}[+] SUCCESS: Application components applied!${NC}"
echo -e "Access the separate Nginx Proxy: http://localhost:30080"
echo -e "Access the frontend directly: http://localhost:30081"
echo -e "Or via Ingress Host: http://expense-manager.local"
echo -e "${BLUE}=============================================${NC}"
