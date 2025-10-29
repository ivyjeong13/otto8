# Testing UI Changes in Kubernetes Deployment

When running Obot in Kubernetes (not `make dev`), the UI is **baked into the Docker image**. To see your UI changes, you need to rebuild and redeploy.

## Quick Method: Use the Script

```bash
./rebuild-and-deploy.sh
```

This script will:
1. ✅ Build the production UI (`pnpm run build` in `ui/user`)
2. ✅ Build a new Docker image with your changes
3. ✅ Load the image into your k3d cluster
4. ✅ Update the Helm deployment with the new image
5. ✅ Restart port-forwarding

**Time:** ~2-5 minutes depending on your machine

## Manual Steps (if you prefer)

### 1. Build the Production UI

```bash
cd ui/user
pnpm install
pnpm run build
cd ../..
```

This creates the production-optimized UI in `ui/user/build/`.

### 2. Build the Docker Image

```bash
docker build -t obot:local .
```

This bakes the built UI into the Docker image.

### 3. Load Image into k3d

```bash
k3d image import obot:local -c local
```

This makes the image available inside your k3d cluster.

### 4. Update Helm Deployment

```bash
# Update dev-k8s-values.yaml to use local image
# Change:
image:
  repository: obot
  tag: local
  pullPolicy: Never

# Then upgrade
helm upgrade obot ./chart \
    --namespace obot \
    --values dev-k8s-values.yaml \
    --wait
```

### 5. Restart Port-Forward

```bash
kubectl port-forward -n obot svc/obot-obot 8080:80
```

## Development Workflow

### For Rapid UI Development

**Use `make dev` with Docker backend:**
```bash
# In .envrc.dev, comment out K8s backend
# export OBOT_SERVER_MCPRUNTIME_BACKEND=docker

source .envrc.dev
make dev
```

Benefits:
- ✅ **Hot reload** - UI changes show immediately
- ✅ **Fast iteration** - no rebuilds needed
- ✅ **Quick startup** - seconds instead of minutes
- ❌ Can't test K8s-specific features

### For Testing K8s Features with UI Changes

**Use the rebuild script:**
```bash
# Make your UI changes
vim ui/user/src/...

# Rebuild and redeploy
./rebuild-and-deploy.sh

# Test at http://localhost:8080/admin/
```

Use this when you need to test:
- K8s settings API
- MCP server deployment details
- Pod logs and events
- K8s-specific functionality

## Comparison: make dev vs K8s Deployment

| Aspect | `make dev` | K8s Deployment |
|--------|-----------|----------------|
| **UI Changes** | Instant (hot reload) | Requires rebuild (2-5 min) |
| **Backend Changes** | Restart server | Rebuild + redeploy |
| **Startup Time** | Fast (~30s) | Slower (~2-3 min) |
| **MCP Backend** | Docker | Kubernetes |
| **K8s Features** | ❌ Not available | ✅ Fully functional |
| **Use Case** | General development | K8s feature testing |

## Tips for Efficient Development

### 1. Develop UI with `make dev`

Do most UI development with `make dev` for fast iteration:
```bash
# Set Docker backend in .envrc.dev
export OBOT_SERVER_MCPRUNTIME_BACKEND=docker

make dev
```

### 2. Test K8s Features Periodically

Once you're happy with UI changes, test in K8s:
```bash
./rebuild-and-deploy.sh
```

### 3. Watch Build Logs

If the rebuild fails, check the logs:
```bash
# UI build logs
cd ui/user && pnpm run build

# Docker build logs
docker build -t obot:local . 2>&1 | tee build.log

# Pod logs after deployment
kubectl logs -n obot -l app.kubernetes.io/name=obot -f
```

### 4. Skip UI Rebuild if Unchanged

If you only changed backend code:
```bash
# Just rebuild Docker image (skips UI build)
docker build -t obot:local .
k3d image import obot:local -c local
helm upgrade obot ./chart --namespace obot --values dev-k8s-values.yaml --wait
```

## Troubleshooting

### UI Changes Not Showing

1. **Clear browser cache:** Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
2. **Verify image was rebuilt:**
   ```bash
   docker images | grep obot
   # Should show recent timestamp
   ```
3. **Check if pod restarted:**
   ```bash
   kubectl get pods -n obot
   # AGE should be recent
   ```
4. **Check pod is using new image:**
   ```bash
   kubectl describe pod -n obot -l app.kubernetes.io/name=obot | grep Image:
   # Should show: obot:local
   ```

### Build Failures

**UI build fails:**
```bash
cd ui/user
rm -rf node_modules .svelte-kit build
pnpm install
pnpm run build
```

**Docker build fails:**
- Check if you have enough disk space
- Try: `docker system prune -a` to free space
- Check Dockerfile for errors

**k3d import fails:**
```bash
# Check cluster is running
k3d cluster list

# Restart cluster if needed
k3d cluster stop local
k3d cluster start local
```

### Port-Forward Issues

If you can't access http://localhost:8080:

```bash
# Check if port-forward is running
ps aux | grep port-forward

# Kill old ones
pkill -f "port-forward.*obot"

# Restart
kubectl port-forward -n obot svc/obot-obot 8080:80
```

## Best Practice Workflow

### Daily Development

1. **Morning:** Start `make dev` for UI/backend work
2. **During day:** Make changes, test with hot reload
3. **Afternoon:** Rebuild and deploy to K8s once to verify
4. **Before commit:** Final K8s test with `./rebuild-and-deploy.sh`

### Feature Branches

- Work in `make dev` for development
- Test in K8s before PR
- Document any K8s-specific behavior

### CI/CD

The rebuild script is mainly for local testing. In CI/CD:
- Build image with proper tags
- Push to container registry
- Deploy to staging/production clusters

