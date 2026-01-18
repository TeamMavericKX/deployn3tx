# DeployNet - Low Level Design (LLD)

## Document Version: 1.0
## Date: January 2026

## 1. Introduction

This document provides detailed technical specifications for DeployNet's implementation. It covers the internal architecture, data structures, algorithms, interfaces, and implementation details for each component.

## 2. System Components

### 2.1 Signaling Server (Go)

#### 2.1.1 Core Structure

```go
package signaling

type Server struct {
    clients    map[string]*Client
    rooms      map[string]*Room
    mutex      sync.RWMutex
    wsUpgrader websocket.Upgrader
    logger     *log.Logger
}

type Client struct {
    id       string
    conn     *websocket.Conn
    roomID   string
    metadata ClientMetadata
    send     chan []byte
}

type Room struct {
    id      string
    clients map[string]*Client
    mutex   sync.RWMutex
}
```

#### 2.1.2 Message Types

```go
type MessageType int

const (
    Offer MessageType = iota
    Answer
    IceCandidate
    PeerDiscovery
    Heartbeat
)

type SignalMessage struct {
    Type      MessageType     `json:"type"`
    Payload   json.RawMessage `json:"payload"`
    SenderID  string         `json:"sender_id"`
    Timestamp time.Time      `json:"timestamp"`
}
```

#### 2.1.3 Core Functions

**HandleWebSocketConnection**
- Accepts WebSocket connection
- Registers client in the server
- Starts read/write goroutines
- Handles client lifecycle

**BroadcastToRoom**
- Sends message to all clients in a room
- Thread-safe operations
- Error handling for disconnected clients

**PeerDiscoveryAlgorithm**
- Implements consistent hashing for peer selection
- Considers geographic proximity
- Evaluates connection quality metrics

### 2.2 Client Library (JavaScript)

#### 2.2.1 Core Classes

```javascript
class DeployNetClient {
    constructor(config) {
        this.config = {
            signalingServer: config.signalingServer,
            siteId: config.siteId,
            maxPeers: config.maxPeers || 5,
            cacheSize: config.cacheSize || 100 * 1024 * 1024, // 100MB
            ...config
        };
        this.peers = new Map();
        this.cache = new ContentCache(this.config.cacheSize);
        this.signalingChannel = null;
        this.webRTCManager = null;
    }

    async initialize() {
        await this.setupSignalingConnection();
        await this.setupWebRTC();
        await this.registerWithNetwork();
    }
}

class WebRTCManager {
    constructor(client) {
        this.client = client;
        this.peerConnections = new Map();
        this.dataChannels = new Map();
    }

    async createPeerConnection(peerId) {
        const pc = new RTCPeerConnection(this.getRTCOpts());
        this.setupDataChannel(pc, peerId);
        this.setupICEHandling(pc);
        return pc;
    }

    setupDataChannel(pc, peerId) {
        const channel = pc.createDataChannel(`deploy-${peerId}`, {
            ordered: false,
            maxRetransmits: 0
        });
        this.handleChannelEvents(channel, peerId);
    }
}

class ContentCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.currentSize = 0;
        this.entries = new Map(); // URL -> CacheEntry
        this.accessTime = new Map(); // URL -> timestamp
    }

    async store(url, content) {
        const size = new Blob([content]).size;
        if (this.currentSize + size > this.maxSize) {
            await this.evictLRU(size);
        }
        
        this.entries.set(url, content);
        this.accessTime.set(url, Date.now());
        this.currentSize += size;
    }

    get(url) {
        const entry = this.entries.get(url);
        if (entry) {
            this.accessTime.set(url, Date.now()); // Update access time
            return entry;
        }
        return null;
    }

    evictLRU(requiredSpace) {
        // Implementation of LRU eviction
        const sortedEntries = [...this.accessTime.entries()]
            .sort((a, b) => a[1] - b[1]);
        
        let freedSpace = 0;
        for (const [url, _] of sortedEntries) {
            const content = this.entries.get(url);
            if (content) {
                const size = new Blob([content]).size;
                this.entries.delete(url);
                this.accessTime.delete(url);
                this.currentSize -= size;
                freedSpace += size;
                
                if (freedSpace >= requiredSpace) break;
            }
        }
    }
}
```

#### 2.2.2 Content Interception

```javascript
class ContentInterceptor {
    constructor(client) {
        this.client = client;
        this.originalFetch = window.fetch;
        this.setupInterceptors();
    }

    setupInterceptors() {
        // Override fetch to intercept requests
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input.url;
            
            // Check if this is a request we should handle
            if (this.shouldIntercept(url)) {
                return this.interceptRequest(url, init);
            }
            
            // Pass through to original fetch
            return this.originalFetch(input, init);
        };

        // Override XMLHttpRequest for broader compatibility
        this.overrideXHR();
    }

    async interceptRequest(url, init) {
        // First check local cache
        const cached = this.client.cache.get(url);
        if (cached) {
            return this.createResponseFromCache(cached, url);
        }

        // Try to get from peers
        const peerResponse = await this.requestFromPeers(url);
        if (peerResponse) {
            this.client.cache.store(url, peerResponse.content);
            return this.createResponseFromPeer(peerResponse, url);
        }

        // Fallback to origin server
        return this.originalFetch(url, init);
    }
}
```

### 2.3 Consistent Hashing Algorithm

#### 2.3.1 Ring Structure

```go
package hashring

import (
    "crypto/sha256"
    "fmt"
    "sort"
    "strconv"
)

type Node struct {
    ID       string
    Address  string
    Load     int
    Capacity int
}

type HashRing struct {
    nodes    map[string]*Node
    ring     []uint64
    nodeMap  map<uint64]string
    replicas int
}

func NewHashRing(replicas int) *HashRing {
    return &HashRing{
        nodes:    make(map[string]*Node),
        ring:     make([]uint64, 0),
        nodeMap:  make(map<uint64]string),
        replicas: replicas,
    }
}

func (h *HashRing) AddNode(node *Node) {
    h.nodes[node.ID] = node
    
    for i := 0; i < h.replicas; i++ {
        key := h.hash(fmt.Sprintf("%s%d", node.ID, i))
        h.ring = append(h.ring, key)
        h.nodeMap[key] = node.ID
    }
    
    sort.Slice(h.ring, func(i, j int) bool {
        return h.ring[i] < h.ring[j]
    })
}

func (h *HashRing) GetNode(key string) *Node {
    if len(h.ring) == 0 {
        return nil
    }
    
    hash := h.hash(key)
    idx := sort.Search(len(h.ring), func(i int) bool {
        return h.ring[i] >= hash
    })
    
    if idx == len(h.ring) {
        idx = 0 // Wrap around
    }
    
    nodeID := h.nodeMap[h.ring[idx]]
    return h.nodes[nodeID]
}

func (h *HashRing) hash(key string) uint64 {
    hasher := sha256.New()
    hasher.Write([]byte(key))
    sum := hasher.Sum(nil)
    
    // Convert first 8 bytes to uint64
    var result uint64
    for i := 0; i < 8; i++ {
        result = (result << 8) | uint64(sum[i])
    }
    return result
}
```

## 3. Data Structures

### 3.1 Peer Metadata

```javascript
class PeerMetadata {
    constructor() {
        this.id = this.generateID();
        this.connectionQuality = {
            ping: 0,
            bandwidth: 0,
            reliability: 0
        };
        this.capabilities = {
            uploadSpeed: 0,
            availableStorage: 0,
            geoLocation: null
        };
        this.stats = {
            requestsServed: 0,
            bytesTransferred: 0,
            uptime: 0
        };
    }

    generateID() {
        return crypto.randomUUID();
    }
}
```

### 3.2 Content Manifest

```javascript
class ContentManifest {
    constructor(siteId) {
        this.siteId = siteId;
        this.version = 1;
        this.assets = new Map(); // URL -> AssetInfo
        this.checksums = new Map(); // URL -> SHA256
        this.dependencies = new Map(); // URL -> [dependencies]
        this.timestamp = Date.now();
    }

    addAsset(url, fileInfo) {
        this.assets.set(url, {
            size: fileInfo.size,
            contentType: fileInfo.contentType,
            etag: fileInfo.etag,
            lastModified: fileInfo.lastModified,
            dependencies: fileInfo.dependencies || []
        });

        // Generate checksum
        this.checksums.set(url, this.calculateChecksum(fileInfo.content));
    }

    calculateChecksum(content) {
        // Implementation for calculating SHA256 checksum
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    }
}
```

## 4. Algorithms

### 4.1 Peer Selection Algorithm

```javascript
class PeerSelectionStrategy {
    constructor(peers) {
        this.peers = peers;
    }

    selectOptimalPeers(targetUrl, count = 3) {
        // Calculate scores for each peer
        const scoredPeers = this.peers.map(peer => ({
            peer,
            score: this.calculatePeerScore(peer, targetUrl)
        }));

        // Sort by score (highest first) and return top N
        scoredPeers.sort((a, b) => b.score - a.score);
        return scoredPeers.slice(0, count).map(item => item.peer);
    }

    calculatePeerScore(peer, url) {
        let score = 0;

        // Geographic proximity (higher score for closer peers)
        score += this.calculateGeographicScore(peer);

        // Connection quality
        score += peer.metadata.connectionQuality.reliability * 0.3;
        score += Math.min(peer.metadata.connectionQuality.bandwidth / 1000000, 1) * 0.2;

        // Content availability
        if (peer.hasContent(url)) {
            score += 0.3;
        }

        // Current load (lower score for overloaded peers)
        const loadFactor = peer.metadata.stats.requestsServed / 
                          Math.max(peer.metadata.capabilities.availableStorage, 1);
        score -= Math.min(loadFactor, 0.2);

        return Math.max(score, 0);
    }
}
```

### 4.2 Cache Eviction Policy

```javascript
class LRUCacheEviction {
    constructor(cache) {
        this.cache = cache;
    }

    async evictIfNecessary(additionalSize = 0) {
        const requiredSpace = this.cache.currentSize + additionalSize - this.cache.maxSize;
        
        if (requiredSpace <= 0) return;

        // Get entries sorted by access time (oldest first)
        const sortedEntries = [...this.cache.accessTime.entries()]
            .sort((a, b) => a[1] - b[1]);

        let freedSpace = 0;
        for (const [url, accessTime] of sortedEntries) {
            const content = this.cache.entries.get(url);
            if (content) {
                const size = new Blob([content]).size;
                this.cache.entries.delete(url);
                this.cache.accessTime.delete(url);
                freedSpace += size;

                if (freedSpace >= requiredSpace) break;
            }
        }
    }
}
```

## 5. Error Handling

### 5.1 Retry Mechanisms

```javascript
class RetryMechanism {
    static async withRetry(fn, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                
                // Exponential backoff
                await this.sleep(delay * Math.pow(2, i));
            }
        }
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### 5.2 Fallback Strategies

```javascript
class FallbackStrategy {
    constructor(client) {
        this.client = client;
    }

    async getContentWithFallback(url) {
        // Strategy 1: Try from cache
        const cached = this.client.cache.get(url);
        if (cached) return { source: 'cache', content: cached };

        // Strategy 2: Try from peers
        try {
            const peerResponse = await this.requestFromPeers(url);
            if (peerResponse) {
                this.client.cache.store(url, peerResponse.content);
                return { source: 'peer', content: peerResponse.content };
            }
        } catch (error) {
            console.warn('Peer request failed, falling back to origin:', error);
        }

        // Strategy 3: Fallback to origin server
        try {
            const response = await fetch(url);
            const content = await response.text();
            this.client.cache.store(url, content);
            return { source: 'origin', content };
        } catch (error) {
            throw new Error(`All fallback strategies failed for ${url}: ${error.message}`);
        }
    }
}
```

## 6. Security Implementation

### 6.1 Content Integrity Verification

```javascript
class ContentIntegrity {
    static async verify(content, expectedChecksum) {
        const calculatedChecksum = await this.calculateChecksum(content);
        return calculatedChecksum === expectedChecksum;
    }

    static async calculateChecksum(content) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
```

### 6.2 Rate Limiting

```go
package rate

import (
    "sync"
    "time"
)

type Limiter struct {
    mu        sync.Mutex
    requests  map[string][]time.Time
    limit     int
    window    time.Duration
}

func NewLimiter(limit int, window time.Duration) *Limiter {
    return &Limiter{
        requests: make(map[string][]time.Time),
        limit:    limit,
        window:   window,
    }
}

func (l *Limiter) Allow(id string) bool {
    l.mu.Lock()
    defer l.mu.Unlock()

    now := time.Now()
    requests := l.requests[id]

    // Remove old requests outside the window
    for len(requests) > 0 && now.Sub(requests[0]) > l.window {
        requests = requests[1:]
    }

    if len(requests) >= l.limit {
        return false
    }

    l.requests[id] = append(requests, now)
    return true
}
```

## 7. Performance Optimizations

### 7.1 Connection Pooling

```javascript
class ConnectionPool {
    constructor(maxConnections = 10) {
        this.maxConnections = maxConnections;
        this.connections = new Map(); // peerId -> RTCPeerConnection
        this.usageCount = new Map(); // peerId -> count
    }

    async getConnection(peerId) {
        if (this.connections.has(peerId)) {
            const conn = this.connections.get(peerId);
            this.usageCount.set(peerId, (this.usageCount.get(peerId) || 0) + 1);
            return conn;
        }

        if (this.connections.size >= this.maxConnections) {
            // Close least used connection
            await this.closeLeastUsedConnection();
        }

        const newConn = await this.createConnection(peerId);
        this.connections.set(peerId, newConn);
        this.usageCount.set(peerId, 1);
        return newConn;
    }

    closeLeastUsedConnection() {
        let minCount = Infinity;
        let leastUsedPeer = null;

        for (const [peerId, count] of this.usageCount.entries()) {
            if (count < minCount) {
                minCount = count;
                leastUsedPeer = peerId;
            }
        }

        if (leastUsedPeer) {
            const conn = this.connections.get(leastUsedPeer);
            if (conn) {
                conn.close();
            }
            this.connections.delete(leastUsedPeer);
            this.usageCount.delete(leastUsedPeer);
        }
    }
}
```

## 8. Testing Strategy

### 8.1 Unit Tests Structure

```
internal/
├── signaling/
│   ├── server_test.go
│   ├── client_test.go
│   └── message_handler_test.go
├── hashring/
│   ├── ring_test.go
│   └── node_test.go
└── p2p/
    ├── connection_test.go
    └── manager_test.go

pkg/
├── client/
│   ├── client_test.js
│   ├── cache_test.js
│   └── interceptor_test.js
└── utils/
    └── crypto_test.js
```

### 8.2 Integration Tests

```javascript
// integration/content_distribution.test.js
describe('Content Distribution Integration', () => {
    let clientA, clientB, signalingServer;

    beforeEach(async () => {
        signalingServer = new MockSignalingServer();
        await signalingServer.start();
        
        clientA = new DeployNetClient({
            signalingServer: signalingServer.url,
            siteId: 'test-site'
        });
        
        clientB = new DeployNetClient({
            signalingServer: signalingServer.url,
            siteId: 'test-site'
        });
        
        await clientA.initialize();
        await clientB.initialize();
    });

    test('should distribute content peer-to-peer', async () => {
        // Client A caches content
        await clientA.cache.store('/test-content', 'Hello World');
        
        // Client B requests same content
        const response = await clientB.interceptor.interceptRequest('/test-content');
        
        expect(response.source).toBe('peer');
        expect(response.content).toBe('Hello World');
    });

    afterEach(async () => {
        await clientA.destroy();
        await clientB.destroy();
        await signalingServer.stop();
    });
});
```

## 9. Monitoring and Logging

### 9.1 Metrics Collection

```go
package metrics

import (
    "sync"
    "time"
)

type MetricsCollector struct {
    mu              sync.RWMutex
    connectionStats map[string]int64
    bandwidthStats  struct {
        upload   int64
        download int64
    }
    startTime time.Time
}

func (mc *MetricsCollector) RecordConnection(peerID string) {
    mc.mu.Lock()
    defer mc.mu.Unlock()
    mc.connectionStats[peerID]++
}

func (mc *MetricsCollector) RecordBandwidth(upload, download int64) {
    mc.mu.Lock()
    defer mc.mu.Unlock()
    mc.bandwidthStats.upload += upload
    mc.bandwidthStats.download += download
}

func (mc *MetricsCollector) GetMetrics() map[string]interface{} {
    mc.mu.RLock()
    defer mc.mu.RUnlock()
    
    return map[string]interface{}{
        "uptime":           time.Since(mc.startTime),
        "total_connections": len(mc.connectionStats),
        "bandwidth_upload":  mc.bandwidthStats.upload,
        "bandwidth_download": mc.bandwidthStats.download,
    }
}
```

## 10. Configuration Management

### 10.1 Configuration Schema

```javascript
const ConfigSchema = {
    signalingServer: {
        type: 'string',
        required: true,
        format: 'uri'
    },
    siteId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 64
    },
    maxPeers: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 5
    },
    cacheSize: {
        type: 'integer',
        minimum: 1024 * 1024, // 1MB
        maximum: 1024 * 1024 * 1024, // 1GB
        default: 100 * 1024 * 1024 // 100MB
    },
    enableEncryption: {
        type: 'boolean',
        default: true
    },
    retryAttempts: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 3
    }
};
```

This low-level design provides comprehensive implementation details for all DeployNet components, ensuring a robust, scalable, and secure peer-to-peer content delivery network.