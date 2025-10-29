# Obot K8s Deployment Scripts Reference

Quick reference for deploying Obot to Kubernetes locally.

## Scripts Overview

### ✅ `deploy-to-k3d.sh` - Initial Deployment

**Use for:** First-time setup or complete rebuild

```bash
./deploy-to-k3d.sh
```

**What it does:**
1. ✅ Builds UI (production build with your changes)
2. ✅ Builds Docker image (`obot:local`)
3. ✅ Imports image into k3d cluster
4. ✅ Deploys via Helm with `dev-k8s-values.yaml`
5. ✅ Sets up port-forwarding to localhost:8080

**Time:** ~2-5 minutes

---

### ✅ `rebuild-and-deploy.sh` - Update Deployment

**Use for:** Rebuilding with code/UI changes

```bash
./rebuild-and-deploy.sh
```

**What it does:**
1. ✅ Builds UI (production build)
2. ✅ Builds Docker image (`obot:local`)
3. ✅ Imports image into k3d cluster
4. ✅ Updates Helm deployment
5. ✅ Restarts pods to use new image
6. ✅ Sets up port-forwarding

**Time:** ~2-5 minutes

---

### 🔄 `reset-k8s-deployment.sh` - Complete Reset

**Use for:** Fresh start with clean database

```bash
./reset-k8s-deployment.sh
```

**What it does:**
1. ❌ Deletes Helm release
2. ❌ Deletes `obot` namespace (database wiped)
3. ❌ Deletes `obot-mcp` namespace (all MCP servers)
4. ✅ Redeploys fresh via `deploy-to-k3d.sh`

**Time:** ~30-60 seconds + deployment time

---

## Which Script to Use?

| Scenario | Use This Script |
|----------|----------------|
| **First time deploying** | `./deploy-to-k3d.sh` |
| **Made UI changes** | Either script (both rebuild) |
| **Made backend changes** | Either script (both rebuild) |
| **Want fresh database** | `./reset-k8s-deployment.sh` |
| **Deployment broken** | `./reset-k8s-deployment.sh` |

---

## Both Scripts Are Now Identical!

✨ **Good news:** Both `deploy-to-k3d.sh` and `rebuild-and-deploy.sh` now:
- Build your local UI changes
- Build Docker image with your code
- Import into k3d
- Deploy/update Helm

**You can use either one!** They both ensure your local changes are deployed.

---

## For Fast UI Development

If you're rapidly iterating on UI changes, use `make dev` instead:

```bash
# In .envrc.dev, use Docker backend
export OBOT_SERVER_MCPRUNTIME_BACKEND=docker

# Start dev server with hot reload
make dev
```

**Benefits:**
- ✅ Hot reload (changes show instantly)
- ✅ No rebuilds needed
- ✅ Fast iteration
- ❌ Can't test K8s-specific features

---

## Common Tasks

### Initial Setup
```bash
# Start k3d cluster
k3d cluster create local

# Deploy Obot
./deploy-to-k3d.sh

# Access at http://localhost:8080/admin/
```

### Update After Code Changes
```bash
# Rebuild and redeploy
./rebuild-and-deploy.sh

# Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+F5
```

### Complete Fresh Start
```bash
# Delete everything and redeploy
./reset-k8s-deployment.sh
```

### View Logs
```bash
kubectl logs -n obot -l app.kubernetes.io/name=obot -f
```

### Check MCP Servers
```bash
kubectl get pods -n obot-mcp
```

### Restart Port-Forward
```bash
kubectl port-forward -n obot svc/obot-obot 8080:80
```

---

## Configuration Files

### `dev-k8s-values.yaml`
Helm values for local K8s deployment:
- Uses `obot:local` image (built locally)
- Embedded PostgreSQL database
- NodePort service for access
- Kubernetes MCP backend

### `.envrc.dev`
Environment variables for `make dev`:
- Docker MCP backend (for fast iteration)
- Dev mode settings

---

## Troubleshooting

### UI Changes Not Showing
1. Hard refresh browser: `Cmd+Shift+R`
2. Verify new image was built: `docker images obot:local`
3. Verify pod restarted: `kubectl get pods -n obot`

### Disk Space Issues
```bash
# Clean up Docker
docker system prune -a --volumes --force

# Free up space: 20-30GB usually
```

### Build Failures
```bash
# UI build fails
cd ui/user && pnpm install && pnpm run build

# Docker build fails (GHCR auth)
# See GHCR_AUTH.md for authentication steps
```

### Deployment Stuck
```bash
# Check pod status
kubectl describe pod -n obot -l app.kubernetes.io/name=obot

# Check events
kubectl get events -n obot --sort-by='.lastTimestamp'

# Force restart
kubectl rollout restart deployment/obot-obot -n obot
```

---

## Quick Reference

```bash
# 📦 Deploy/Update
./deploy-to-k3d.sh                    # Deploy with local build
./rebuild-and-deploy.sh               # Same thing

# 🔄 Reset
./reset-k8s-deployment.sh             # Fresh start

# 👀 Monitor
kubectl get pods -n obot              # Obot status
kubectl get pods -n obot-mcp          # MCP servers
kubectl logs -n obot -l app.kubernetes.io/name=obot -f  # Logs

# 🔧 Debug
kubectl describe pod -n obot <pod>    # Pod details
kubectl get events -n obot            # Events
kubectl port-forward -n obot svc/obot-obot 8080:80  # Port-forward

# 🧹 Cleanup
helm uninstall obot -n obot           # Remove deployment
kubectl delete namespace obot obot-mcp  # Delete everything
k3d cluster delete local              # Delete cluster
```

---

## Summary

**For Local K8s Testing:**
- Use `./deploy-to-k3d.sh` or `./rebuild-and-deploy.sh` (same thing)
- Both scripts build your local UI and code
- Access at http://localhost:8080/admin/
- Takes ~2-5 minutes per build

**For Fast Development:**
- Use `make dev` with Docker backend
- Hot reload, instant changes
- Can't test K8s features

**For Fresh Start:**
- Use `./reset-k8s-deployment.sh`
- Wipes database and MCP servers
- Redeploys from scratch

