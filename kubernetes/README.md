# KubeSphere / Kubernetes Deployment Guide

This directory contains the production-ready Kubernetes manifests needed to deploy the Expense Manager application (Frontend, Backend API, PostgreSQL Database, and local Ollama Vision service) on KubeSphere or any Kubernetes cluster.

## Architecture Mapping

- **db**: StatefulSet running `postgres:alpine` with persistent storage in the `exp-management` namespace.
- **model**: Deployment running `ollama/ollama:latest` with a Persistent Volume Claim (`model-pvc`) for caching models offline, renamed from `ollama`.
- **backend**: Deployment running the compiled Go backend API service.
- **frontend**: Deployment running Nginx with compiled Angular assets, exposed via `NodePort` (port `30081`).

---

## Deployment Steps

### Step 1: Build & Push Images to Registry
Before deploying, build and tag your Docker images, then push them to a registry (Docker Hub or private registry).

1. Execute the push script:
   ```bash
   ./push.sh
   ```
2. Enter your registry/Docker Hub username (e.g. `sebastianbaiju`). This will compile, tag, and push:
   - `<username>/expense-manager-backend:latest`
   - `<username>/expense-manager-frontend:latest`

*Note: If you are using a custom username, edit the `image` field in `backend.yaml` and `frontend.yaml` to match your repository tag.*

### Step 2: Create Namespace
Create the `exp-management` namespace in your cluster:
```bash
kubectl apply -f namespace.yaml
```

### Step 3: Apply Secrets and Configuration
Create secrets in your `exp-management` namespace:
```bash
kubectl apply -f secrets.yaml
```

### Step 4: Deploy Databases & Services
Apply database storage and the Model (Ollama) vision container:
```bash
kubectl apply -f postgres.yaml
kubectl apply -f model.yaml
```

### Step 5: Deploy App Services
Apply backend and frontend deployments:
```bash
kubectl apply -f backend.yaml
kubectl apply -f frontend.yaml
```

---

## Accessing the Application

Once all pods are running (`kubectl get pods -n exp-management`), you can access the frontend web interface:
- **URL**: `http://<Node-IP>:30081` (where `<Node-IP>` is any node IP of your Kubernetes cluster).
- In KubeSphere Console, go to the **exp-management** project -> **Application Workloads** -> **Services** to view external NodePort mappings or configure an **Ingress Route** (reverse proxy URL) to expose the app over HTTP/HTTPS on port 80/443.
