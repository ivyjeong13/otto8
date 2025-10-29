#!/bin/bash
set -e

# Rebuild Obot with UI changes and redeploy to k3d
# Use this when you've made UI changes and want to test them in Kubernetes

echo "🔨 Building UI (production build)..."
cd ui/user
pnpm install
pnpm run build
cd ../..

echo ""
echo "🐳 Building Docker image..."
docker build -t obot:local .

echo ""
echo "📦 Loading image into k3d cluster..."
k3d image import obot:local -c local

echo ""
echo "🚀 Updating Helm deployment..."
# Update the values to use local image
cat > /tmp/obot-local-values.yaml << 'EOF'
# Local development values using locally built image
dev:
  useEmbeddedDb: true

image:
  repository: obot
  tag: local
  pullPolicy: Never  # Don't try to pull, use local image

service:
  type: NodePort
  port: 80

config:
  OBOT_SERVER_MCPRUNTIME_BACKEND: "kubernetes"
  OBOT_SERVER_MCPBASE_IMAGE: "ghcr.io/obot-platform/mcp-images/phat:main"
  OBOT_SERVER_MCPNAMESPACE: "obot-mcp"
  OBOT_SERVER_MCPCLUSTER_DOMAIN: "cluster.local"
  OBOT_DEV_MODE: false

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi

replicaCount: 1
EOF

helm upgrade obot ./chart \
    --namespace obot \
    --values /tmp/obot-local-values.yaml \
    --wait \
    --timeout=5m

echo ""
echo "♻️  Restarting pods to use new image..."
kubectl rollout restart deployment/obot-obot -n obot
kubectl rollout status deployment/obot-obot -n obot --timeout=60s

echo ""
echo "✅ Deployment updated with new image!"
echo ""

# Get the service name
SERVICE_NAME=$(kubectl get svc -n obot -l app.kubernetes.io/name=obot -o jsonpath='{.items[0].metadata.name}')

echo "🔌 Setting up port-forward..."
# Kill any existing port-forward on 8080
pkill -f "port-forward.*obot.*8080" 2>/dev/null || true

# Start port-forward in background
kubectl port-forward -n obot svc/${SERVICE_NAME} 8080:80 > /dev/null 2>&1 &
PORT_FORWARD_PID=$!

sleep 2

echo "🌐 Obot is accessible at: http://localhost:8080"
echo "   Admin UI: http://localhost:8080/admin/"
echo "   User UI:  http://localhost:8080/"
echo ""

# Show pod status
echo "📦 Pod status:"
kubectl get pods -n obot

echo ""
echo "💡 Port-forward is running in the background (PID: ${PORT_FORWARD_PID})"
echo ""
echo "🎨 IMPORTANT: Hard refresh your browser to see UI changes!"
echo "   Mac: Cmd+Shift+R  |  Windows/Linux: Ctrl+Shift+F5"
echo ""
echo "📝 To view logs:"
echo "   kubectl logs -n obot -l app.kubernetes.io/name=obot -f"

