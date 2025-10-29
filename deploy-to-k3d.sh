#!/bin/bash
set -e

# Deploy Obot to k3d cluster for local testing
# This simulates a production Kubernetes deployment

echo "🚀 Deploying Obot to k3d cluster..."

# Check if k3d cluster is running
if ! kubectl cluster-info &>/dev/null; then
    echo "❌ k3d cluster not running. Start it first."
    exit 1
fi

echo ""
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
echo "📋 Deploying via Helm..."
# Create obot namespace if it doesn't exist
kubectl create namespace obot --dry-run=client -o yaml | kubectl apply -f -

# Install or upgrade Obot via Helm
helm upgrade --install obot ./chart \
    --namespace obot \
    --values dev-k8s-values.yaml \
    --wait \
    --timeout=5m

echo ""
echo "✅ Obot deployed successfully!"
echo ""

# Get the service name (it might be named differently)
SERVICE_NAME=$(kubectl get svc -n obot -l app.kubernetes.io/name=obot -o jsonpath='{.items[0].metadata.name}')

if [ -z "$SERVICE_NAME" ]; then
    echo "⚠️  Service not found yet, waiting..."
    sleep 5
    SERVICE_NAME=$(kubectl get svc -n obot -l app.kubernetes.io/name=obot -o jsonpath='{.items[0].metadata.name}')
fi

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

echo "📝 Useful Commands:"
echo ""
echo "   View logs:"
echo "     kubectl logs -n obot -l app.kubernetes.io/name=obot -f"
echo ""
echo "   Access Obot shell:"
echo "     kubectl exec -it -n obot deployment/obot-obot -- /bin/sh"
echo ""
echo "   Restart port-forward if it stops:"
echo "     kubectl port-forward -n obot svc/${SERVICE_NAME} 8080:80"
echo ""
echo "   Delete deployment:"
echo "     helm uninstall obot -n obot"
echo "     kubectl delete namespace obot obot-mcp"
echo ""
echo "💡 Port-forward is running in the background (PID: ${PORT_FORWARD_PID})"
echo "   If connection fails, restart it with the command above"
echo ""
echo "🎨 IMPORTANT: Hard refresh your browser to see UI changes!"
echo "   Mac: Cmd+Shift+R  |  Windows/Linux: Ctrl+Shift+F5"

