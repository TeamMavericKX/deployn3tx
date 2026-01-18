# DeployNet Deployment Guide

## Overview

This guide covers deploying DeployNet for production use, including both the signaling infrastructure and client integration.

## Prerequisites

Before deploying DeployNet, ensure you have:

- Domain name for your signaling server
- SSL certificate (required for WebRTC)
- Server with public IP address
- Go 1.21+ installed
- Firewall configured to allow WebSocket connections

## Signaling Server Deployment

### Option 1: Standalone Server

1. **Prepare the server**
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade -y
   
   # Install Go
   wget https://golang.org/dl/go1.21.linux-amd64.tar.gz
   sudo tar -C /usr/local -xzf go1.21.linux-amd64.tar.gz
   
   # Add to PATH
   echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
   source ~/.bashrc
   ```

2. **Deploy the signaling server**
   ```bash
   # Clone the repository
   git clone https://github.com/princetheprogrammerbtw/deploy-net.git
   cd deploy-net
   
   # Build the signaling server
   cd cmd/signaling-server
   go build -o deploynet-signaling .
   
   # Create systemd service
   sudo tee /etc/systemd/system/deploynet.service << EOF
   [Unit]
   Description=DeployNet Signaling Server
   After=network.target

   [Service]
   Type=simple
   User=deploynet
   WorkingDirectory=/home/deploynet/deploy-net/cmd/signaling-server
   ExecStart=/home/deploynet/deploy-net/cmd/signaling-server/deploynet-signaling -addr=:8080
   Restart=always

   [Install]
   WantedBy=multi-user.target
   EOF
   
   # Create dedicated user
   sudo useradd -r -s /bin/false deploynet
   sudo chown -R deploynet:deploynet /home/deploynet/
   
   # Start the service
   sudo systemctl daemon-reload
   sudo systemctl enable deploynet
   sudo systemctl start deploynet
   ```

3. **Configure reverse proxy with Nginx**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name signaling.yourdomain.com;
       
       ssl_certificate /path/to/certificate.crt;
       ssl_certificate_key /path/to/private.key;
       
       location /ws {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           
           # WebSocket timeout
           proxy_read_timeout 86400;
       }
   }
   
   # Redirect HTTP to HTTPS
   server {
       listen 80;
       server_name signaling.yourdomain.com;
       return 301 https://$server_name$request_uri;
   }
   ```

### Option 2: Docker Deployment

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY . .
RUN cd cmd/signaling-server && go build -o deploynet-signaling .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/cmd/signaling-server/deploynet-signaling .
EXPOSE 8080
CMD ["./deploynet-signaling"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  signaling:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
    environment:
      - ADDR=:8080
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Client Integration

### Method 1: CDN Integration

Add the DeployNet client to your website:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Site</title>
    <!-- DeployNet Client -->
    <script src="https://cdn.deploynet.io/v0.1.0/client.js"></script>
    <script>
        // Initialize DeployNet
        const deployNet = new DeployNetClient({
            signalingServer: 'wss://signaling.yourdomain.com',
            siteId: 'your-site-identifier',
            maxPeers: 5,
            cacheSize: 100 * 1024 * 1024  // 100MB
        });
        
        // Enable P2P CDN
        deployNet.initialize()
            .then(success => {
                if (success) {
                    console.log('DeployNet enabled successfully');
                } else {
                    console.log('DeployNet initialization failed, falling back to traditional CDN');
                }
            });
    </script>
</head>
<body>
    <!-- Your website content -->
</body>
</html>
```

### Method 2: NPM Package

```bash
npm install deploynet
```

```javascript
import { DeployNetClient } from 'deploynet';

const deployNet = new DeployNetClient({
    signalingServer: 'wss://signaling.yourdomain.com',
    siteId: 'your-site-identifier'
});

await deployNet.initialize();
```

### Method 3: CLI Deployment

```bash
# Initialize a new DeployNet project
npx deploynet init my-website

# Navigate to project directory
cd my-website

# Place your static files in the public/ directory
cp -r /path/to/your/site/* public/

# Deploy to DeployNet
npx deploynet deploy
```

## Configuration Options

### Signaling Server Configuration

```bash
# Environment variables
ADDR=:8080                 # Bind address
MAX_CONNECTIONS=10000      # Maximum concurrent connections
ROOM_CAPACITY=100          # Max peers per room
HEARTBEAT_INTERVAL=30s     # Peer heartbeat interval
MESSAGE_TIMEOUT=60s        # Message timeout
LOG_LEVEL=info            # Log level (debug, info, warn, error)
```

### Client Configuration

```javascript
const config = {
    // Required
    signalingServer: 'wss://signaling.yourdomain.com',
    siteId: 'unique-site-identifier',
    
    // Optional
    maxPeers: 5,                    // Max concurrent peers (1-10)
    cacheSize: 100 * 1024 * 1024,   // Cache size in bytes (100MB)
    enableEncryption: true,         // Enable content encryption
    retryAttempts: 3,               // Number of retry attempts
    timeout: 10000,                 // Request timeout in ms
    bandwidthThreshold: 1000000,    // Min bandwidth for P2P (1MB/s)
    
    // Advanced
    peerDiscoveryTimeout: 5000,     // Time to discover peers
    contentValidation: true,        // Validate content integrity
    privacyMode: false              // Anonymize peer information
};
```

## Monitoring and Analytics

### Server Monitoring

DeployNet includes built-in metrics endpoints:

```bash
# Health check
curl https://signaling.yourdomain.com/health

# Metrics endpoint
curl https://signaling.yourdomain.com/metrics

# Peer statistics
curl https://signaling.yourdomain.com/stats
```

### Client Analytics

```javascript
// Get client statistics
const stats = deployNet.getStats();
console.log('Active peers:', stats.activePeers);
console.log('Cache hit rate:', stats.cacheHitRate);
console.log('P2P bandwidth saved:', stats.bandwidthSaved);
console.log('Content served via P2P:', stats.p2pRatio);
```

## Scaling Considerations

### Horizontal Scaling

For high-traffic deployments, scale the signaling server:

```yaml
# Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploynet-signaling
spec:
  replicas: 3
  selector:
    matchLabels:
      app: deploynet-signaling
  template:
    metadata:
      labels:
        app: deploynet-signaling
    spec:
      containers:
      - name: signaling
        image: deploynet/signaling:latest
        ports:
        - containerPort: 8080
        env:
        - name: ADDR
          value: ":8080"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: deploynet-service
spec:
  selector:
    app: deploynet-signaling
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: LoadBalancer
```

### Load Balancer Configuration

Configure your load balancer for sticky sessions:

```nginx
# Nginx with sticky sessions
upstream deploynet_signaling {
    ip_hash;  # Sticky sessions based on IP
    server backend1:8080;
    server backend2:8080;
    server backend3:8080;
}
```

## Security Hardening

### SSL/TLS Configuration

Use strong SSL configuration:

```nginx
server {
    # Use modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

### Rate Limiting

Implement rate limiting at multiple levels:

```javascript
// Application-level rate limiting
const rateLimit = {
    maxConnections: 100,      // Per IP
    maxMessages: 1000,        // Per minute
    maxBandwidth: 10000000    // 10MB/s per peer
};
```

## Troubleshooting

### Common Issues

1. **Peers not connecting**
   - Check firewall settings for WebSocket connections
   - Verify SSL certificate validity
   - Ensure STUN servers are accessible

2. **Poor P2P performance**
   - Verify client bandwidth meets minimum thresholds
   - Check for NAT traversal issues
   - Monitor cache hit rates

3. **High server resource usage**
   - Implement connection limits
   - Monitor concurrent peer connections
   - Scale horizontally if needed

### Debugging Commands

```bash
# Check signaling server status
systemctl status deploynet

# View server logs
journalctl -u deploynet -f

# Monitor connections
netstat -an | grep :8080 | wc -l

# Check WebSocket connections
wscat -c wss://signaling.yourdomain.com/ws
```

## Backup and Recovery

### Configuration Backup

Regularly backup your configuration:

```bash
# Backup configuration
tar -czf deploynet-backup-$(date +%Y%m%d).tar.gz \
    /etc/systemd/system/deploynet.service \
    /path/to/config/files

# Store securely
aws s3 cp deploynet-backup-*.tar.gz s3://your-backup-bucket/
```

### Disaster Recovery

In case of server failure:

1. Restore from backup
2. Reconfigure DNS if needed
3. Verify SSL certificates
4. Test peer connectivity

## Maintenance

### Regular Tasks

- Update to latest stable releases monthly
- Monitor resource usage weekly
- Review logs daily
- Perform security audits quarterly

### Upgrading

```bash
# Stop current service
sudo systemctl stop deploynet

# Download new version
cd /tmp
wget https://github.com/princetheprogrammerbtw/deploy-net/releases/latest/download/deploynet-signaling

# Replace binary
sudo cp deploynet-signaling /home/deploynet/deploy-net/cmd/signaling-server/
sudo chown deploynet:deploynet /home/deploynet/deploy-net/cmd/signaling-server/deploynet-signaling

# Start service
sudo systemctl start deploynet
```

---

For more information, visit the [DeployNet Documentation](../README.md) or join our [community forums](https://community.deploynet.io).