#!/bin/bash
set -e

# Completely reset Obot deployment in k3d
# This deletes everything: pods, database, MCP servers, etc.

echo "🗑️  Deleting Obot deployment..."

# Kill port-forward if running
pkill -f "port-forward.*obot.*8080" 2>/dev/null || true

# Uninstall Helm release
helm uninstall obot -n obot 2>/dev/null || echo "No Helm release found"

# Delete namespaces (this deletes all resources including PVCs/data)
echo "🗑️  Deleting namespaces (this will delete all data)..."
kubectl delete namespace obot --wait=false 2>/dev/null || true
kubectl delete namespace obot-mcp --wait=false 2>/dev/null || true

echo "⏳ Waiting for resources to be cleaned up..."
# Wait for namespaces to be fully deleted
while kubectl get namespace obot 2>/dev/null || kubectl get namespace obot-mcp 2>/dev/null; do
    echo -n "."
    sleep 2
done

echo ""
echo "✅ Everything deleted! Starting fresh deployment..."
echo ""

# Redeploy
./deploy-to-k3d.sh

