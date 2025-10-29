#!/usr/bin/env bash
set -euo pipefail

# Local Claude Environments stack. See DEVELOPMENT.md before using another cluster.
cd "$(dirname "${BASH_SOURCE[0]}")"
CLUSTER_NAME="${CLUSTER_NAME:-obot-substrate}"
K3S_IMAGE="${K3S_IMAGE:-rancher/k3s:v1.36.4-k3s1}"
KUBE_CONTEXT="k3d-${CLUSTER_NAME}"

for tool in docker k3d kubectl helm openssl python3; do
    command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool" >&2; exit 1; }
done
if ! docker info >/dev/null 2>&1; then
    echo "Start Docker, then retry." >&2
    exit 1
fi

# Every Kubernetes/Helm operation uses this context, regardless of current-context.
kube() { kubectl --context "$KUBE_CONTEXT" "$@"; }
if k3d cluster list --no-headers | awk '{print $1}' | grep -Fxq "$CLUSTER_NAME"; then
    k3d cluster start "$CLUSTER_NAME"
    k3d kubeconfig merge "$CLUSTER_NAME" --kubeconfig-merge-default --kubeconfig-switch-context=false
else
    k3d cluster create "$CLUSTER_NAME" \
        --image "$K3S_IMAGE" --servers 1 --agents 0 \
        --k3s-arg '--kube-apiserver-arg=runtime-config=certificates.k8s.io/v1beta1=true@server:*' \
        --k3s-arg '--kube-apiserver-arg=feature-gates=ClusterTrustBundle=true,PodCertificateRequest=true@server:*' \
        --k3s-arg '--kubelet-arg=feature-gates=ClusterTrustBundle=true,ClusterTrustBundleProjection=true,PodCertificateRequest=true@server:*' \
        --kubeconfig-switch-context=false --wait
fi
kube cluster-info
kube wait --for=condition=Ready nodes --all --timeout=120s

# Discovery cannot verify kubelet projection support; inspect every node too.
certificate_apis=$(kube api-resources --api-group=certificates.k8s.io -o name)
for resource in clustertrustbundles podcertificaterequests; do
    if ! grep -Fxq "${resource}.certificates.k8s.io" <<< "$certificate_apis"; then
        echo "Cluster '$CLUSTER_NAME' lacks $resource. Use a new cluster with the documented feature gates." >&2
        exit 1
    fi
done
nodes=$(kube get nodes -o name)
[[ -n "$nodes" ]] || { echo "No Kubernetes nodes found." >&2; exit 1; }
while IFS= read -r node; do
    if ! kube get --raw "/api/v1/nodes/${node#node/}/proxy/configz" | python3 -c '
import json, sys
config = json.load(sys.stdin)["kubeletconfig"]
gates = config.get("featureGates", {})
required = ("ClusterTrustBundle", "ClusterTrustBundleProjection", "PodCertificateRequest")
sys.exit(0 if all(gates.get(gate) is True for gate in required) else 1)
'; then
        echo "$node lacks verified kubelet certificate gates. Use a new cluster; existing clusters are never deleted automatically." >&2
        exit 1
    fi
done <<< "$nodes"
kube get storageclass local-path >/dev/null

# The chart owns ate-system. Refuse to adopt another Substrate installation.
if kube get namespace ate-system >/dev/null 2>&1; then
    owner=$(kube get namespace ate-system -o 'jsonpath={.metadata.annotations.meta\.helm\.sh/release-name}:{.metadata.annotations.meta\.helm\.sh/release-namespace}')
    if [[ "$owner" != "obot:obot" ]]; then
        echo "ate-system is not owned by Helm release obot in namespace obot. Use a dedicated cluster." >&2
        exit 1
    fi
else
    kube create namespace ate-system
    kube label namespace ate-system app.kubernetes.io/managed-by=Helm
    kube annotate namespace ate-system meta.helm.sh/release-name=obot meta.helm.sh/release-namespace=obot helm.sh/resource-policy=keep
fi
kube create namespace obot --dry-run=client -o yaml | kube apply -f -

# Persist credentials across reruns. This Secret is private infrastructure config,
# deliberately not labeled for MCP secret binding and not stored in Helm values.
if ! kube get secret dev-substrate-storage -n ate-system >/dev/null 2>&1; then
    secret_dir=$(mktemp -d)
    trap 'rm -rf "$secret_dir"' EXIT
    chmod 700 "$secret_dir"
    openssl rand -hex 16 | tr -d '\n' > "$secret_dir/AWS_ACCESS_KEY_ID"
    openssl rand -hex 32 | tr -d '\n' > "$secret_dir/AWS_SECRET_ACCESS_KEY"
    kube create secret generic dev-substrate-storage -n ate-system --from-file="$secret_dir"
    rm -rf "$secret_dir"
    trap - EXIT
fi

kube apply -f dev-k8s-rustfs.yaml
kube rollout status deployment/dev-rustfs -n ate-system --timeout=5m
# Jobs are immutable; recreate the completed storage check on each deployment.
kube delete job dev-rustfs-bucket -n ate-system --ignore-not-found --wait=true
kube apply -f dev-k8s-rustfs-bucket.yaml
if ! kube wait --for=condition=complete job/dev-rustfs-bucket -n ate-system --timeout=5m; then
    kube logs job/dev-rustfs-bucket -n ate-system
    exit 1
fi

# Dockerfile runs make all, including the UI build.
echo "Building and importing Obot..."
docker build -t obot:local .
IMAGE_ID=$(docker image inspect obot:local --format '{{.Id}}')
IMAGE_TAG="local-${IMAGE_ID#sha256:}"
docker tag obot:local "obot:${IMAGE_TAG}"
k3d image import "obot:${IMAGE_TAG}" --cluster "$CLUSTER_NAME"

helm upgrade --install obot ./chart \
    --kube-context "$KUBE_CONTEXT" --namespace obot \
    --values dev-k8s-values.yaml --set-string "image.tag=${IMAGE_TAG}" \
    --wait --wait-for-jobs --timeout=10m

# Apply sample MCP credentials only when explicitly requested; applying the template
# on every deployment would overwrite manually configured testing credentials.
if [[ "${APPLY_BINDABLE_SECRETS:-false}" == "true" ]]; then
    kube apply -f dev-k8s-bindable-secrets.yaml
fi

kube get pods -n obot
kube get pods -n ate-system
kube get pods -n podcertificate-controller-system
cat <<INFO
Obot and Substrate are deployed to $KUBE_CONTEXT.
Open http://localhost:8080 after starting the port-forward below.
Create a Claude Environment with a Team/Enterprise environment key in Obot.
Workers appear when an environment is configured (default: 2 CPUs, 4 GiB each).
Run the suspend/resume acceptance checks in docs/docs/claude-environments/operations.md.

Restart the port-forward:
  kubectl --context $KUBE_CONTEXT port-forward -n obot service/obot-obot 8080:80
RustFS console (credentials are in ate-system/dev-substrate-storage):
  kubectl --context $KUBE_CONTEXT port-forward -n ate-system service/dev-rustfs 9001:9001
INFO
# Foreground forwarding reports errors and stops cleanly with Ctrl+C.
exec kubectl --context "$KUBE_CONTEXT" port-forward -n obot service/obot-obot 8080:80
