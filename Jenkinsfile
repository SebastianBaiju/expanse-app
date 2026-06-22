pipeline {
    agent {
        label 'base'
    }
    environment {
        REGISTRY = 'sebu5683'
        BACKEND_IMAGE = 'expense-manager-backend'
        FRONTEND_IMAGE = 'expense-manager-frontend'
    }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Build Images') {
            steps {
                container('base') {
                    sh 'podman --cgroup-manager=cgroupfs build --security-opt seccomp=unconfined -t ${REGISTRY}/${BACKEND_IMAGE}:latest ./backend'
                    sh 'podman --cgroup-manager=cgroupfs build --security-opt seccomp=unconfined -t ${REGISTRY}/${FRONTEND_IMAGE}:latest ./frontend'
                }
            }
        }
        stage('Push Images') {
            steps {
                container('base') {
                    withCredentials([usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        passwordVariable: 'DOCKER_PASSWORD',
                        usernameVariable: 'DOCKER_USERNAME'
                    )]) {
                        sh 'echo "$DOCKER_PASSWORD" | podman --cgroup-manager=cgroupfs login -u "$DOCKER_USERNAME" --password-stdin docker.io'
                        sh 'podman --cgroup-manager=cgroupfs push ${REGISTRY}/${BACKEND_IMAGE}:latest'
                        sh 'podman --cgroup-manager=cgroupfs push ${REGISTRY}/${FRONTEND_IMAGE}:latest'
                    }
                }
            }
        }
        stage('Deploy to Kubernetes') {
            steps {
                container('base') {
                    sh 'kubectl apply -f kubernetes/namespace.yaml'
                    sh 'kubectl apply -f kubernetes/secrets.yaml'
                    sh 'kubectl apply -f kubernetes/postgres.yaml'
                    sh 'kubectl apply -f kubernetes/model.yaml'
                    sh 'kubectl apply -f kubernetes/backend.yaml'
                    sh 'kubectl apply -f kubernetes/frontend.yaml'
                    
                    sh 'kubectl rollout restart deployment/backend -n exp-management'
                    sh 'kubectl rollout restart deployment/frontend -n exp-management'
                }
            }
        }
    }
}
