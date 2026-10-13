# Deploying Beacon to a Single EC2 Instance

This document outlines the process for deploying the Beacon marketing site to a single AWS EC2 instance. This setup is designed for simplicity and cost-effectiveness for a pre-launch page.

## 1. Instance Setup

### Instance Type

- **Type**: `t4g.micro` (2 vCPU, 1 GB, ARM64 Graviton)
- **AMI**: Latest Amazon Linux 2023 ARM64
- **Storage**: 8 GB gp3
- **Region**: `ap-south-1`

### Security Group Configuration

Create a security group with the following inbound rules:

- **HTTP (Port 80)**: `0.0.0.0/0` (Allows public access to the website)
- **SSH (Port 22)**: Your administrative IP address (Restricts SSH access to your IP only)

### Elastic IP

Attach an Elastic IP to your EC2 instance. This ensures the public IP address remains constant even if the instance is stopped and started.

### User Data Script

When launching the EC2 instance, provide the following script as user data. This script will run once at first boot as root to install necessary software.

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

## 2. Container Configuration

### `deploy/Dockerfile`

The Dockerfile defines the application container.

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
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=5s CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
```

### `.dockerignore`

Ensure `.dockerignore` excludes unnecessary files from the build context:

```
node_modules
data
.git
docs
deploy
*.md
```

### `deploy/docker-compose.yaml`

This file defines the Docker Compose setup.

```yaml
services:
  web:
    build:
      context: ..
      dockerfile: ./deploy/Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - waitlist_data:/app/data
    environment:
      NODE_ENV: production
      PORT: 3000

volumes:
  waitlist_data:
```

## 3. Nginx Configuration

### `deploy/nginx.conf`

This Nginx configuration acts as a reverse proxy, serving static files and forwarding requests to the Node.js container.

```nginx
listen 80 default_server;
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
client_max_body_size 8k;
gzip on;
gzip_types text/html text/css application/javascript image/svg+xml;
```

This file will be copied to `/etc/nginx/conf.d/beacon.conf` on the EC2 instance.

## 4. Deployment Process

### `deploy/deploy.sh`

Use the `deploy/deploy.sh` script from your local machine to deploy the application. Replace `<EC2_INSTANCE_IP>` with your instance's public IP and `<SSH_KEY_PATH>` with the path to your SSH private key.

```bash
bash deploy/deploy.sh <EC2_INSTANCE_IP> <SSH_KEY_PATH>
```

**Steps performed by the script:**

1.  `rsync` the repository to `ec2-user@$IP:~/beacon`, excluding `node_modules`, `.git`, and `data`.
2.  `ssh` into the instance and run `docker compose -f deploy/docker-compose.yaml up -d --build`.
3.  Copy `deploy/nginx.conf` into `/etc/nginx/conf.d/` and `systemctl reload nginx`.
4.  Poll `http://$IP/healthz` for up to 60 seconds and fail if the application does not become healthy.

### First Deployment

The initial deployment will take approximately three minutes, primarily due to the `npm ci` layer in the Docker build.

## 5. Operations

Connect to your EC2 instance via SSH to perform operations:

```bash
# View application logs
docker compose -f deploy/docker-compose.yaml logs -f web

# Restart the application container
docker compose -f deploy/docker-compose.yaml restart web

# Read the waitlist data
docker run --rm -v beacon_waitlist_data:/d alpine cat /d/waitlist.json
```

### Rollback

To roll back to a previous version, checkout the desired commit on your local machine and re-run the `deploy/deploy.sh` script:

```bash
git checkout <previous-sha>
bash deploy/deploy.sh <EC2_INSTANCE_IP> <SSH_KEY_PATH>
```

**Note**: This deployment strategy does not include blue/green deployments or zero-downtime updates. A redeploy will result in two to three seconds of downtime, which is acceptable for a pre-launch page.
