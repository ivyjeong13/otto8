# Reset Kubernetes Deployment

How to completely delete and restart your Obot deployment with fresh database and clean state.

## Quick Method: Use the Script

```bash
./reset-k8s-deployment.sh
```

This will:
1. ✅ Kill port-forward
2. ✅ Uninstall Helm release
3. ✅ Delete `obot` namespace (Obot server + database)
4. ✅ Delete `obot-mcp` namespace (all MCP servers)
5. ✅ Wait for cleanup to complete
6. ✅ Deploy fresh instance

**Time:** ~30-60 seconds

---

## Manual Method

### 1. Kill Port-Forward
```bash
pkill -f "port-forward.*obot.*8080"
```

### 2. Uninstall Helm Release
```bash
helm uninstall obot -n obot
```

### 3. Delete Namespaces
```bash
# Delete Obot namespace (includes database)
kubectl delete namespace obot

# Delete MCP servers namespace
kubectl delete namespace obot-mcp
```

**Note:** This deletes **everything**:
- Pods
- Services
- ConfigMaps
- Secrets
- **PersistentVolumeClaims (database data)**

### 4. Wait for Cleanup
```bash
# Wait for namespaces to be fully deleted
kubectl get namespaces -w
```

Wait until both `obot` and `obot-mcp` disappear from the list.

### 5. Deploy Fresh Instance
```bash
./deploy-to-k3d.sh
```

---

## What Gets Deleted?

### Obot Namespace (`obot`)
- ❌ Obot server pod
- ❌ Embedded PostgreSQL database
- ❌ All user data (agents, threads, etc.)
- ❌ All configuration
- ❌ All credentials

### MCP Namespace (`obot-mcp`)
- ❌ All MCP server pods
- ❌ All MCP services
- ❌ All MCP deployments

### What's Preserved
- ✅ Docker images (in k3d cache)
- ✅ Helm chart files
- ✅ Your code changes
- ✅ k3d cluster itself

---

## Common Scenarios

### Fresh Start for Testing
```bash
./reset-k8s-deployment.sh
```

### Keep Cluster, Just Reset Data
```bash
helm uninstall obot -n obot
kubectl delete namespace obot obot-mcp --wait
./deploy-to-k3d.sh
```

### Only Delete MCP Servers (Keep Obot)
```bash
kubectl delete namespace obot-mcp
# MCP namespace will be recreated automatically when you launch a server
```

### Only Restart Obot (Keep Database)
```bash
kubectl rollout restart deployment/obot-obot -n obot
```

### Force Database Reset Only
```bash
# Delete the database pod (it will restart with empty DB)
kubectl delete pod -n obot -l app.kubernetes.io/name=obot
```

---

## Troubleshooting

### Namespace Stuck in "Terminating"

If a namespace won't delete:

```bash
# Check what's blocking it
kubectl get namespace obot -o yaml

# Force delete finalizers (use with caution)
kubectl get namespace obot -o json | \
  jq '.spec.finalizers = []' | \
  kubectl replace --raw "/api/v1/namespaces/obot/finalize" -f -
```

### PVC Won't Delete

```bash
# List PVCs
kubectl get pvc -n obot

# Force delete
kubectl delete pvc --all -n obot --force --grace-period=0
```

### Resources in Other Namespaces

Check if Obot created resources elsewhere:

```bash
# Check all namespaces
kubectl get all --all-namespaces | grep obot

# Delete specific resource
kubectl delete <resource-type> <resource-name> -n <namespace>
```

---

## After Reset

Once reset is complete:

1. **Access Obot:** http://localhost:8080/admin/
2. **Fresh database** - no agents, threads, or configuration
3. **Clean MCP namespace** - no servers deployed
4. **New admin user** - first login creates new user

---

## Reset vs. Restart

| Action | Database | MCP Servers | Config | Use Case |
|--------|----------|-------------|--------|----------|
| **Reset** (this guide) | ❌ Deleted | ❌ Deleted | ❌ Deleted | Fresh start, testing |
| **Restart Pod** | ✅ Kept | ✅ Kept | ✅ Kept | Apply code changes |
| **Rollout Restart** | ✅ Kept | ✅ Kept | ✅ Kept | Refresh deployment |
| **Helm Upgrade** | ✅ Kept | ✅ Kept | 🔄 Updated | Change config |

---

## Complete Cluster Reset

If you want to delete the entire k3d cluster:

```bash
# Delete everything including the cluster
k3d cluster delete local

# Start fresh cluster
k3d cluster create local

# Deploy Obot
./deploy-to-k3d.sh
```

This takes longer but gives you a completely clean Kubernetes environment.

---

## Quick Reference

```bash
# Fresh deployment (recommended)
./reset-k8s-deployment.sh

# Manual cleanup
helm uninstall obot -n obot
kubectl delete namespace obot obot-mcp --wait

# Redeploy
./deploy-to-k3d.sh

# Full cluster reset
k3d cluster delete local && k3d cluster create local
./deploy-to-k3d.sh
```

