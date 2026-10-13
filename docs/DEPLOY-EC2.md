# Deployment to a Single EC2 Instance

This document outlines the process for deploying the Beacon application to a single AWS EC2 instance. The architecture involves a Docker container running the Node.js application, with Nginx acting as a reverse proxy.

## Instance Setup

### Instance Type

*   `t4g.micro` (2 vCPU, 1 GB, ARM64 Graviton) - The Docker image will be built for `linux/arm64`.

### AMI

*   Latest Amazon Linux 2023 ARM64.

### Storage

*   8 GB gp3. The application is small; this disk size primarily accommodates Docker's image layers.

### Region

*   `ap-south-1`.

### Security Group

*   Inbound `80` from `0.0.0.0/0` (HTTP access).
*   Inbound `22` from the administrator's IP only (SSH access).
*   No other inbound rules. Outbound traffic is all allowed.

### Elastic IP

*   An Elastic IP address must be attached to the instance so that its public IP remains constant across stop/start events.

## Container Configuration

### `deploy/Dockerfile`

```dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ src/
COPY public/ public/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "src/server.js"]

HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=5s \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

### `.dockerignore`

Excludes `node_modules`, `data`, `.git`, `docs`, `deploy`, and `*.md` to optimize build context.

### `deploy/docker-compose.yaml`

```yaml
services:
  web:
    build:
      context: .
      dockerfile: deploy/Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000" # Bound to loopback only; Nginx is the only external entrypoint.
    volumes:
      - waitlist_data:/app/data
    environment:
      NODE_ENV: production
      PORT: 3000

volumes:
  waitlist_data:
```

## Nginx Configuration

### `deploy/nginx.conf`

This file is installed to `/etc/nginx/conf.d/beacon.conf` on the EC2 instance.

```nginx
listen 80 default_server;

location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 8k;
}

gzip on;
gzip_types text/html text/css application/javascript image/svg+xml;
```

## Instance Bootstrap Script

### `deploy/ec2-user-data.sh`

This script runs once at first boot as the root user. It is idempotent.

```sh
#!/bin/sh
set -eu
dnf -y update
dnf -y install docker nginx git
systemctl enable --now docker
systemctl enable --now nginx
usermod -aG docker ec2-user
DOCKER_CFG=/usr/local/lib/docker/cli-plugins
mkdir -p "$DOCKER_CFG"
curl -sSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
  -o "$DOCKER_CFG/docker-compose"
chmod +x "$DOCKER_CFG/docker-compose"
```

## Deployment Process

### `deploy/deploy.sh`

This script is run from a developer machine with the instance's public IP as the first argument (`$1`) and the SSH key path as the second argument (`$2`).

```bash
#!/bin/bash
set -eu

IP=$1
KEY=$2

echo "🚀 Deploying to $IP with key $KEY"

# 1. rsync the repository
echo "📦 Syncing repository..."
rsync -avz --exclude 'node_modules/' \
             --exclude 'data/' \
             --exclude '.git/' \
             --exclude 'docs/' \
             -e "ssh -i $KEY" . "ec2-user@$IP:~/beacon"

# 2. ssh in and run docker compose
echo "🐳 Building and running Docker Compose..."
ssh -i "$KEY" "ec2-user@$IP" << EOF
  cd ~/beacon
  docker compose -f deploy/docker-compose.yaml up -d --build
EOF

# 3. Copy nginx.conf and reload nginx
echo "⚙️ Configuring nginx..."
ssh -i "$KEY" "ec2-user@$IP" << EOF
  sudo cp ~/beacon/deploy/nginx.conf /etc/nginx/conf.d/beacon.conf
  sudo systemctl reload nginx
EOF

# 4. Poll /healthz
echo "🩺 Waiting for health check..."
for i in $(seq 1 60);
do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://$IP/healthz")
  if [ "$STATUS" -eq 200 ]; then
    echo "✅ Application is healthy!"
    exit 0
  fi
  echo "⏳ Still waiting... (attempt $i/60)"
  sleep 1
done

echo "❌ Health check failed after 60 seconds."
exit 1
```

### Operations

*   **View application logs:**
    ```sh
    docker compose -f deploy/docker-compose.yaml logs -f web
    ```
*   **Restart the application container:**
    ```sh
    docker compose -f deploy/docker-compose.yaml restart web
    ```
*   **Read the waitlist data:**
    ```sh
    docker run --rm -v beacon_waitlist_data:/d alpine cat /d/waitlist.json
    ```

### Rollback

To rollback to a previous version, checkout the desired commit and re-run the `deploy.sh` script:

```sh
git checkout <previous-sha> && bash deploy/deploy.sh $IP $KEY
```

Note: There is no blue/green deployment or zero-downtime story for v1; a redeploy will result in a brief period of downtime (2-3 seconds), which is acceptable for a pre-launch page.