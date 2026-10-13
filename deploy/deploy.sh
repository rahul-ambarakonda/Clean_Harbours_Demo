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