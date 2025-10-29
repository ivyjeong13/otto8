# Switching Obot MCP Runtime to Kubernetes

This guide explains how to configure Obot to use Kubernetes instead of Docker for running MCP servers.

## ⚠️ Important Limitation for Local Development

**The Kubernetes backend is designed for production deployments where Obot runs inside the cluster.**

When running Obot locally (via `make dev`), the Obot server process runs on your host machine and **cannot reach internal Kubernetes service DNS** names like `http://service.namespace.svc.cluster.local`.

**For local development, use the Docker backend instead (default).**

### Why This Happens

- MCP servers in Kubernetes use ClusterIP services with internal DNS names
- Your local Obot process can't resolve these internal cluster addresses
- This causes timeouts when trying to reach MCP servers

### When to Use Each Backend

| Backend | Use Case | Obot Location | MCP Server Location |
|---------|----------|---------------|---------------------|
| **docker** (recommended for dev) | Local development | Host machine | Docker containers on host |
| **kubernetes** (for production) | Production deployment | Inside K8s cluster | K8s pods in same cluster |
| **local** | Testing only | Host machine | Host machine processes |

## Prerequisites

You need a running Kubernetes cluster. Choose one option:

### Option 1: Docker Desktop (Recommended for Mac)
1. Open Docker Desktop
2. Go to Settings → Kubernetes
3. Enable "Enable Kubernetes"
4. Wait for the cluster to start (green indicator)

### Option 2: Kind (Kubernetes in Docker)
```bash
# Install kind
brew install kind

# Create a cluster
kind create cluster --name obot-dev

# Verify it's running
kubectl cluster-info
```

### Option 3: Minikube
```bash
# Install minikube
brew install minikube

# Start cluster
minikube start

# Verify it's running
kubectl cluster-info
```

## Configuration

The `.envrc.dev` file has been updated with:
```bash
export OBOT_SERVER_MCPRUNTIME_BACKEND=kubernetes
```

By default, it will use your `~/.kube/config` file (which Docker Desktop, kind, and minikube all configure automatically).

## Running Obot with Kubernetes Backend

1. **Source the environment variables:**
   ```bash
   source .envrc.dev
   ```

2. **Start Obot in dev mode:**
   ```bash
   make dev
   ```

3. **Verify the MCP namespace is created:**
   ```bash
   kubectl get namespace obot-mcp
   ```

## What Happens

When you use Kubernetes backend:

1. **MCP servers run as Kubernetes deployments** in the `obot-mcp` namespace
2. **K8s settings API endpoints work** - you can check deployment status, restart servers, etc.
3. **Server details include**:
   - Kubernetes deployment name
   - Namespace
   - Pod status
   - Recent events
   - Container logs

## Troubleshooting

### Error: "failed to build local Kubernetes config"
- Make sure your Kubernetes cluster is running: `kubectl cluster-info`
- Verify your kubeconfig is valid: `kubectl config view`

### Error: "failed to create MCP namespace"
- Check if you have permissions: `kubectl auth can-i create namespace`
- The namespace will be created automatically if permissions allow

### MCP servers not starting
- Check the namespace: `kubectl get pods -n obot-mcp`
- View logs: `kubectl logs -n obot-mcp <pod-name>`
- Check events: `kubectl get events -n obot-mcp`

## Switching Back to Docker

If you want to switch back to Docker backend:

1. Edit `.envrc.dev` and change:
   ```bash
   export OBOT_SERVER_MCPRUNTIME_BACKEND=docker
   ```

2. Or remove the line entirely (docker is the default)

## Viewing MCP Deployments

```bash
# List all MCP server deployments
kubectl get deployments -n obot-mcp

# List all MCP server pods
kubectl get pods -n obot-mcp

# View logs for a specific MCP server
kubectl logs -n obot-mcp -l app=<server-name> --tail=100 -f

# Delete all MCP servers (clean slate)
kubectl delete namespace obot-mcp
```

## Benefits of Kubernetes Backend

✅ **Better resource isolation** - Each MCP server runs in its own pod
✅ **Kubernetes native** - Use kubectl, monitoring tools, etc.
✅ **K8s settings API works** - Check deployment status, view logs, restart servers
✅ **Affinity & tolerations** - Configure pod scheduling
✅ **Resource limits** - Set CPU/memory limits per server

## Next Steps

After starting Obot with Kubernetes backend:

1. Go to the Admin UI: `http://localhost:8080/admin/`
2. Navigate to MCP Servers
3. The K8s settings status should now work without errors
4. You can view deployment details, logs, and restart servers

