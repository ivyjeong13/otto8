# Kubernetes MCP Server Troubleshooting

## Common Issues When Running Obot with Kubernetes Backend

### Issue: MCP Server Hangs on "Pending" Status

#### Symptoms:
- Calling `/api/mcp-servers/{server_id}/launch` hangs
- Pods stuck in "Pending" state
- Server never becomes ready

#### Common Causes & Solutions:

### 1. Disk Pressure (Most Common)

**Symptoms:**
```bash
kubectl describe pod -n obot-mcp <pod-name>
# Shows: "node(s) had untolerated taint {node.kubernetes.io/disk-pressure: }"
```

**Solution:**

1. **Check Docker disk usage:**
```bash
docker system df
```

2. **Clean up unused Docker resources:**
```bash
# Remove unused images, containers, volumes, and build cache
docker system prune -a --volumes --force

# This can free 20-60GB typically
```

3. **Check disk space:**
```bash
df -h /
```

4. **Remove disk pressure taint (temporary fix):**
```bash
kubectl get nodes -o name | xargs -I {} kubectl taint nodes {} node.kubernetes.io/disk-pressure:NoSchedule-
```

**Prevention:**
- Regularly clean up Docker resources: `docker system prune -a --volumes`
- Monitor disk space: `df -h /`
- Consider increasing Docker Desktop's disk allocation in Settings → Resources

---

### 2. Image Pull Failures

**Symptoms:**
```bash
kubectl describe pod -n obot-mcp <pod-name>
# Shows: "ImagePullBackOff" or "ErrImagePull"
```

**Solution:**

1. **Check if image exists:**
```bash
# The default image is
ghcr.io/obot-platform/mcp-images/phat:main
```

2. **Check image pull secrets:**
```bash
kubectl get secrets -n obot-mcp
```

3. **Manually pull image to test:**
```bash
docker pull ghcr.io/obot-platform/mcp-images/phat:main
```

---

### 3. Insufficient Resources

**Symptoms:**
```bash
kubectl describe pod -n obot-mcp <pod-name>
# Shows: "Insufficient memory" or "Insufficient cpu"
```

**Solution:**

1. **Check node resources:**
```bash
kubectl describe nodes
```

2. **Reduce MCP server resource requests** (if needed):
   - Default request: 400Mi memory
   - Edit K8s settings to lower resource requirements

---

### 4. Node Scheduling Issues

**Symptoms:**
- Pod pending with no node assigned
- Node selector mismatches
- Taint/toleration issues

**Solution:**

1. **Check node status:**
```bash
kubectl get nodes -o wide
kubectl describe nodes
```

2. **Check node taints:**
```bash
kubectl get nodes -o jsonpath='{.items[*].spec.taints}'
```

3. **Remove problematic taints:**
```bash
kubectl taint nodes <node-name> <taint-key>:NoSchedule-
```

---

## Debugging Commands

### Check MCP Server Pods
```bash
# List all MCP server pods
kubectl get pods -n obot-mcp -o wide

# Describe a specific pod
kubectl describe pod -n obot-mcp <pod-name>

# Get pod events
kubectl get events -n obot-mcp --sort-by='.lastTimestamp'
```

### Check MCP Server Logs
```bash
# View pod logs
kubectl logs -n obot-mcp <pod-name> --tail=100 -f

# View previous pod logs (if crashed)
kubectl logs -n obot-mcp <pod-name> --previous
```

### Check Deployments
```bash
# List MCP server deployments
kubectl get deployments -n obot-mcp

# Describe a deployment
kubectl describe deployment -n obot-mcp <deployment-name>
```

### Check Node Health
```bash
# Get node conditions
kubectl get nodes -o jsonpath='{.items[*].status.conditions}' | jq

# Check disk pressure specifically
kubectl get nodes -o jsonpath='{.items[0].status.conditions[?(@.type=="DiskPressure")]}'

# Check memory pressure
kubectl get nodes -o jsonpath='{.items[0].status.conditions[?(@.type=="MemoryPressure")]}'
```

### Check Kubernetes Events
```bash
# All events in obot-mcp namespace
kubectl get events -n obot-mcp

# Watch events in real-time
kubectl get events -n obot-mcp --watch
```

---

## Quick Health Check

Run this script to check if your Kubernetes environment is healthy for MCP servers:

```bash
#!/bin/bash

echo "=== Kubernetes Cluster Status ==="
kubectl cluster-info

echo -e "\n=== Node Status ==="
kubectl get nodes

echo -e "\n=== Disk Space ==="
df -h /

echo -e "\n=== Docker Disk Usage ==="
docker system df

echo -e "\n=== Node Conditions (Disk/Memory Pressure) ==="
kubectl get nodes -o jsonpath='{.items[*].status.conditions[?(@.type=="DiskPressure" || @.type=="MemoryPressure")]}' | jq

echo -e "\n=== MCP Namespace ==="
kubectl get all -n obot-mcp

echo -e "\n=== Recent MCP Events ==="
kubectl get events -n obot-mcp --sort-by='.lastTimestamp' | tail -10
```

Save as `check-k8s-health.sh`, make executable with `chmod +x check-k8s-health.sh`, and run before debugging issues.

---

## When to Clean Up

**Regular Maintenance (Recommended Weekly):**
```bash
# Clean up stopped containers and unused images
docker system prune -a --volumes --force

# Or more conservatively (keeps build cache):
docker system prune --force
```

**When you notice:**
- Pods stuck in "Pending"
- Disk usage > 80%
- Docker taking up > 50GB

**Emergency Cleanup:**
```bash
# Remove ALL unused Docker data
docker system prune -a --volumes --force

# Remove specific MCP server deployments
kubectl delete deployment -n obot-mcp <deployment-name>

# Nuclear option: Delete entire MCP namespace
kubectl delete namespace obot-mcp
# Note: Obot will recreate it automatically
```

---

## Getting Help

If you're still having issues:

1. **Collect diagnostic info:**
```bash
# Save all MCP pod details
kubectl get pods -n obot-mcp -o yaml > mcp-pods.yaml

# Save events
kubectl get events -n obot-mcp > mcp-events.txt

# Save node status
kubectl describe nodes > nodes.txt
```

2. **Check Obot server logs:**
```bash
# If running with make dev:
# Check the server output in your terminal

# If running standalone:
./bin/obot server --dev-mode
# Look for MCP-related errors
```

3. **Report with details:**
   - Kubernetes distribution (k3d, Docker Desktop, kind, etc.)
   - Node specs (CPU, memory, disk)
   - Output of diagnostic commands above

