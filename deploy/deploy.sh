#!/bin/sh
set -eu

IP="$1"
KEY_PATH="$2"

if [ -z "$IP" ] || [ -z "$KEY_PATH" ]; then
  echo "Usage: $0 <EC2_INSTANCE_IP> <SSH_KEY_PATH>"
  exit 1
fi

echo "Deploying to $IP..."

# 1. rsync the repository to ec2-user@$IP:~/beacon
echo "Syncing files..."
rsync -avz -e "ssh -i $KEY_PATH" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='data' \
  . "ec2-user@$IP:~/beacon"

# 2. ssh in and run docker compose
echo "Building and running Docker containers..."
ssh -i "$KEY_PATH" "ec2-user@$IP" \
  "cd ~/beacon && docker compose -f deploy/docker-compose.yaml up -d --build"

# 3. Copy deploy/nginx.conf into /etc/nginx/conf.d/ and systemctl reload nginx
echo "Updating nginx configuration..."
ssh -i "$KEY_PATH" "ec2-user@$IP" \
  "sudo cp ~/beacon/deploy/nginx.conf /etc/nginx/conf.d/beacon.conf && sudo systemctl reload nginx"

# 4. Poll http://$IP/healthz for up to 60 seconds and fail loudly if it never returns 200
echo "Waiting for health check (up to 60 seconds)..."
for i in $(seq 1 12);
do
  HEALTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://$IP/healthz" || true)
  if [ "$HEALTH_STATUS" = "200" ]; then
    echo "Application is healthy."
    exit 0
  fi
  echo "Health check failed (status: $HEALTH_STATUS). Retrying in 5 seconds..."
  sleep 5
done

echo "Application did not become healthy within 60 seconds. Deployment failed."
exit 1
