# Running Obot with Kubernetes Backend Locally

This guide explains how to run Obot with the Kubernetes backend in a **production-like** configuration on your local machine.

## Why Deploy Obot to Kubernetes?

When testing the Kubernetes backend, Obot needs to run **inside** the Kubernetes cluster (not on your host machine). This is because:

1. MCP servers use internal Kubernetes DNS (e.g., `http://service.namespace.svc.cluster.local`)
2. Only pods inside the cluster can resolve these DNS names
3. This matches how Obot runs in production

## Quick Start

### 1. Prerequisites

- **k3d** cluster running:
  ```bash
  k3d cluster create local
  ```
  
- **Helm** installed:
  ```bash
  brew install helm  # macOS
  ```

### 2. Deploy Obot to Kubernetes

```bash
./deploy-to-k3d.sh
```

This script will:
- Build the UI (production build with your changes)
- Build a Docker image with your code
- Import the image into k3d cluster
- Deploy Obot via Helm to your k3d cluster
- Configure it to use the Kubernetes backend for MCP servers
- Set up port-forwarding for local access
- Show you the access URL

**Time:** ~2-5 minutes

### 3. Access Obot

After deployment, you'll see output like:
```
🌐 Obot is accessible at: http://localhost:30123
```

Open that URL in your browser!

## What's Different from `make dev`?

| Aspect | `make dev` (Local) | Kubernetes Deployment |
|--------|-------------------|----------------------|
| **Obot Location** | Host machine | Inside cluster (pod) |
| **MCP Backend** | Docker (recommended) | Kubernetes |
| **MCP Access** | Direct to Docker containers | Via Kubernetes services |
| **DNS Resolution** | ❌ Can't resolve cluster DNS | ✅ Full cluster DNS access |
| **Database** | SQLite on host | Embedded PostgreSQL in pod |
| **Hot Reload** | ✅ Code changes instant | ❌ Requires rebuild |
| **Use Case** | Development | Testing K8s features |

## Configuration

The deployment uses `dev-k8s-values.yaml` which includes:

```yaml
# Use embedded DB (for testing only)
dev:
  useEmbeddedDb: true

# Kubernetes backend for MCP
config:
  OBOT_SERVER_MCPRUNTIME_BACKEND: "kubernetes"
  OBOT_SERVER_MCPNAMESPACE: "obot-mcp"
  
# Expose via NodePort
service:
  type: NodePort
```

### Customize the Deployment

Edit `dev-k8s-values.yaml` to:
- Change resource limits
- Enable authentication
- Configure encryption
- Add ingress rules
- Set custom MCP settings

## Testing K8s Features

Once deployed, you can test:

### 1. MCP Servers with K8s Settings

```bash
# Set K8s settings via API
curl -X PUT http://localhost:30123/api/k8s-settings \
  -H "Content-Type: application/json" \
  -d '{
    "resources": {
      "requests": {"memory": "500Mi", "cpu": "250m"},
      "limits": {"memory": "1Gi", "cpu": "1000m"}
    }
  }'
```

### 2. Check MCP Server Status

Navigate to: `http://localhost:30123/admin/` → MCP Servers → Details

You should see:
- ✅ Kubernetes deployment info
- ✅ K8s settings status (no 400 error!)
- ✅ Pod events and logs
- ✅ Restart functionality

### 3. View MCP Deployments

```bash
# List MCP server pods
kubectl get pods -n obot-mcp

# View MCP server logs
kubectl logs -n obot-mcp -l app=<server-name>

# Describe MCP server pod
kubectl describe pod -n obot-mcp <pod-name>
```

## Troubleshooting

### View Obot Logs

```bash
kubectl logs -n obot -l app.kubernetes.io/name=obot -f
```

### Access Obot Shell

```bash
kubectl exec -it -n obot deployment/obot -- /bin/sh
```

### Check All Resources

```bash
# Obot resources
kubectl get all -n obot

# MCP server resources
kubectl get all -n obot-mcp

# Events
kubectl get events -n obot --sort-by='.lastTimestamp'
```

### Restart Obot

```bash
kubectl rollout restart deployment/obot -n obot
```

### Check Service Accessibility

```bash
# From inside the cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://obot.obot.svc.cluster.local
```

## Cleanup

### Uninstall Obot

```bash
helm uninstall obot -n obot
kubectl delete namespace obot
```

### Clean Up MCP Servers

```bash
kubectl delete namespace obot-mcp
```

### Delete k3d Cluster

```bash
k3d cluster delete local
```

## Rebuilding Obot Image

If you make code changes and want to test them:

### Option 1: Build and Load into k3d

```bash
# Build image
docker build -t obot:dev .

# Load into k3d
k3d image import obot:dev -c local

# Update values to use local image
# Edit dev-k8s-values.yaml:
#   image:
#     repository: obot
#     tag: dev
#     pullPolicy: Never

# Redeploy
./deploy-to-k3d.sh
```

### Option 2: Use GitHub Container Registry

```bash
# Tag and push
docker tag obot:dev ghcr.io/your-username/obot:test
docker push ghcr.io/your-username/obot:test

# Update values file with your image
# Redeploy
./deploy-to-k3d.sh
```

## Advanced Configuration

### Enable Authentication

Edit `dev-k8s-values.yaml`:

```yaml
config:
  OBOT_SERVER_ENABLE_AUTHENTICATION: true
  OBOT_SERVER_AUTH_OWNER_EMAILS: "your-email@example.com"
```

### Use External Database

Instead of embedded DB, use a separate PostgreSQL:

```yaml
dev:
  useEmbeddedDb: false

config:
  OBOT_SERVER_DSN: "postgres://user:pass@postgres.default.svc.cluster.local:5432/obot"
```

### Configure Ingress

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - obot.local
```

Then add to `/etc/hosts`:
```
127.0.0.1 obot.local
```

### Set K8s Resource Defaults

```yaml
config:
  OBOT_SERVER_MCPK8S_SETTINGS_RESOURCES: |
    {
      "requests": {"memory": "400Mi", "cpu": "250m"},
      "limits": {"memory": "1Gi", "cpu": "1000m"}
    }
```

## Production Deployment

This local setup mirrors production deployment. For actual production:

1. **Use a real Kubernetes cluster** (EKS, GKE, AKS)
2. **Use external PostgreSQL** (RDS, Cloud SQL, Azure Database)
3. **Configure ingress** with TLS certificates
4. **Enable authentication** with OAuth
5. **Set up encryption** (AWS KMS, Google KMS, Azure Key Vault)
6. **Configure resource limits** based on workload
7. **Set up monitoring** (Prometheus, Grafana)
8. **Configure backups** for database

See the [Obot Helm Chart documentation](./chart/README.md) for full production configuration options.

## Comparison with Docker Backend

### Docker Backend (Local Dev)
✅ Faster iteration (no rebuilds)  
✅ Simpler setup  
✅ Direct container access  
❌ Doesn't test K8s features  
❌ No K8s settings API  
❌ No pod scheduling/affinity  

### Kubernetes Backend (Production-like)
✅ Tests real deployment  
✅ K8s settings work  
✅ Pod scheduling/affinity  
✅ Resource management  
❌ Slower iteration  
❌ More complex setup  
❌ Requires rebuilds for code changes  

## Summary

Use this setup when you need to:
- Test Kubernetes-specific features
- Verify K8s settings API
- Test pod scheduling and affinity
- Debug production-like issues
- Validate Helm chart changes

For regular development, stick with `make dev` and Docker backend.

