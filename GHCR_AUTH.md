# Authenticating with GitHub Container Registry (GHCR)

The Docker build needs to pull private images from `ghcr.io/obot-platform/*`. You need to authenticate Docker with GitHub.

## Steps to Fix the 403 Error

### 1. Create a GitHub Personal Access Token (PAT)

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name like `docker-ghcr-access`
4. Select scopes:
   - ✅ `read:packages` (required)
   - ✅ `write:packages` (if you need to push)
5. Click **"Generate token"**
6. **Copy the token** - you won't see it again!

### 2. Login to GitHub Container Registry

```bash
# Login with your GitHub username and PAT
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

**Example:**
```bash
echo "ghp_abc123..." | docker login ghcr.io -u ijeong --password-stdin
```

You should see:
```
Login Succeeded
```

### 3. Verify Access

Test that you can pull the images:

```bash
# Test pulling the tools image
docker pull ghcr.io/obot-platform/tools:latest

# Test pulling the providers image
docker pull ghcr.io/obot-platform/tools/providers:latest
```

If these succeed, you have proper access!

### 4. Run the Rebuild Script Again

```bash
./rebuild-and-deploy.sh
```

The Docker build should now succeed.

## Troubleshooting

### "403 Forbidden" Error

This means either:
1. **Not logged in**: Run the `docker login` command above
2. **No access to repo**: You need to be granted access to the `obot-platform` organization's packages

### "unauthorized: authentication required"

Your token expired or doesn't have the right permissions. Create a new token with `read:packages` scope.

### Check if You're Logged In

```bash
# View your Docker credentials
cat ~/.docker/config.json | grep ghcr.io
```

If you see `"ghcr.io"` with credentials, you're logged in.

### Logout and Re-login

```bash
# Logout
docker logout ghcr.io

# Login again with fresh token
echo "YOUR_NEW_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

## Security Notes

- ✅ **DO use** `echo "TOKEN" | docker login --password-stdin` (token not in shell history)
- ❌ **DON'T use** `docker login -p TOKEN` (appears in shell history)
- ❌ **DON'T commit** tokens to git
- ❌ **DON'T hardcode** tokens in Dockerfile or scripts

## Alternative: Use Environment Variable

```bash
# Store token in env var (add to your shell profile)
export GITHUB_TOKEN="ghp_your_token_here"

# Login using the env var
echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

## For CI/CD

If you're setting this up for CI/CD:

```yaml
# GitHub Actions example
- name: Login to GitHub Container Registry
  uses: docker/login-action@v2
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

## After Authentication

Once logged in, the credentials are stored in `~/.docker/config.json` and Docker will automatically use them for:
- `docker pull ghcr.io/...`
- `docker build` (when Dockerfile pulls from ghcr.io)
- `docker push ghcr.io/...`

The login persists across terminal sessions until you logout.

