# Quick Start: Testing Kubernetes Backend Locally

This is the **recommended way** to test Obot with the Kubernetes backend locally.

## The Right Way: Deploy Obot to Kubernetes

To properly test the Kubernetes backend, deploy Obot **into** your k3d cluster:

### 1. Start k3d Cluster

```bash
# If you don't have one running yet
k3d cluster create local

# Verify it's running
kubectl cluster-info
```

### 2. Deploy Obot via Helm

```bash
# One command deployment!
./deploy-to-k3d.sh
```

This script will:
- Build your UI (production build)
- Build Docker image with your code
- Import it into k3d
- Deploy Obot as a pod inside Kubernetes

Takes ~2-5 minutes depending on your machine.

### 3. Access Obot

The script sets up port-forwarding and shows you:
```
🌐 Obot is accessible at: http://localhost:8080
   Admin UI: http://localhost:8080/admin/
   User UI:  http://localhost:8080/
```

Open http://localhost:8080/admin/ in your browser!

**Note:** The script automatically sets up port-forwarding. If the connection drops, restart it with:
```bash
kubectl port-forward -n obot svc/obot-obot 8080:80
```

### 4. Test It!

- ✅ Launch MCP servers - they'll run as K8s pods
- ✅ Check K8s settings status - no 400 errors!
- ✅ View deployment details, logs, restart servers
- ✅ Everything works like production

## Why Not `make dev` with K8s Backend?

❌ **`make dev` + Kubernetes backend = doesn't work**

When you run `make dev`:
- Obot runs on your host machine
- MCP servers use internal cluster DNS (`service.namespace.svc.cluster.local`)
- Your host can't resolve cluster DNS names
- Result: timeouts and errors

✅ **Helm deployment + Kubernetes backend = works perfectly**

When you deploy via Helm:
- Obot runs as a pod inside the cluster
- Can resolve all cluster DNS names
- MCP servers accessible via internal services
- Result: everything works!

## Files Created

- **`dev-k8s-values.yaml`** - Helm values for local K8s deployment
- **`deploy-to-k3d.sh`** - One-command deployment script
- **`KUBERNETES_LOCAL_TESTING.md`** - Complete guide with troubleshooting

## When to Use Each Approach

| Scenario | Use This |
|----------|----------|
| **General development** | `make dev` with Docker backend |
| **Testing K8s features** | Helm deployment to k3d |
| **Testing K8s settings API** | Helm deployment to k3d |
| **Debugging production issues** | Helm deployment to k3d |
| **Fast iteration on code** | `make dev` with Docker backend |

## Common Tasks

### View Logs
```bash
kubectl logs -n obot -l app.kubernetes.io/name=obot -f
```

### Check MCP Servers
```bash
kubectl get pods -n obot-mcp
kubectl logs -n obot-mcp <pod-name>
```

### Restart Obot
```bash
kubectl rollout restart deployment/obot -n obot
```

### Cleanup
```bash
helm uninstall obot -n obot
kubectl delete namespace obot obot-mcp
```

## Next Steps

See **`KUBERNETES_LOCAL_TESTING.md`** for:
- Advanced configuration
- Enabling authentication  
- Custom resource limits
- Production deployment tips
- Troubleshooting guide

