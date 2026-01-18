/**
 * DeployNet Client Library
 * Decentralized Content Delivery Network
 */

class DeployNetClient {
    constructor(config) {
        this.config = {
            signalingServer: config.signalingServer,
            siteId: config.siteId,
            maxPeers: config.maxPeers || 5,
            cacheSize: config.cacheSize || 100 * 1024 * 1024, // 100MB
            enableEncryption: config.enableEncryption !== false,
            retryAttempts: config.retryAttempts || 3,
            ...config
        };
        
        this.peers = new Map();
        this.cache = new ContentCache(this.config.cacheSize);
        this.signalingChannel = null;
        this.webRTCManager = null;
        this.peerConnections = new Map();
        this.dataChannels = new Map();
        
        this.isConnected = false;
        this.clientId = this.generateClientId();
    }

    generateClientId() {
        return 'deploy-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    async initialize() {
        try {
            await this.setupSignalingConnection();
            await this.setupWebRTC();
            await this.registerWithNetwork();
            this.setupContentInterception();
            console.log('DeployNet client initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize DeployNet client:', error);
            return false;
        }
    }

    async setupSignalingConnection() {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.config.signalingServer}/ws?id=${this.clientId}&room=${this.config.siteId}`;
            this.signalingChannel = new WebSocket(wsUrl);

            this.signalingChannel.onopen = () => {
                console.log('Connected to signaling server');
                this.isConnected = true;
                resolve();
            };

            this.signalingChannel.onerror = (error) => {
                console.error('Signaling connection error:', error);
                reject(error);
            };

            this.signalingChannel.onmessage = (event) => {
                this.handleSignalingMessage(JSON.parse(event.data));
            };

            this.signalingChannel.onclose = () => {
                console.log('Disconnected from signaling server');
                this.isConnected = false;
                // Attempt to reconnect
                setTimeout(() => this.setupSignalingConnection(), 5000);
            };
        });
    }

    async setupWebRTC() {
        this.webRTCManager = new WebRTCManager(this);
    }

    async registerWithNetwork() {
        const registerMsg = {
            type: 6, // Register message type
            payload: JSON.stringify({
                clientId: this.clientId,
                siteId: this.config.siteId,
                capabilities: {
                    uploadSpeed: navigator.connection?.downlink || 10,
                    availableStorage: this.config.cacheSize,
                    userAgent: navigator.userAgent
                }
            }),
            senderId: this.clientId,
            timestamp: new Date().toISOString(),
            roomId: this.config.siteId
        };

        this.signalingChannel.send(JSON.stringify(registerMsg));
    }

    setupContentInterception() {
        // Override fetch to intercept requests
        const originalFetch = window.fetch;
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : input.url;
            
            // Check if this is a request we should handle
            if (this.shouldIntercept(url)) {
                return this.interceptRequest(url, init, originalFetch);
            }
            
            // Pass through to original fetch
            return originalFetch(input, init);
        };
    }

    shouldIntercept(url) {
        try {
            const parsedUrl = new URL(url, window.location.origin);
            // Only intercept requests for the same origin or known static assets
            return parsedUrl.origin === window.location.origin || 
                   this.isStaticAsset(parsedUrl.pathname);
        } catch {
            return false;
        }
    }

    isStaticAsset(pathname) {
        const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
        return staticExtensions.some(ext => pathname.toLowerCase().endsWith(ext));
    }

    async interceptRequest(url, init, originalFetch) {
        // First check local cache
        const cached = this.cache.get(url);
        if (cached) {
            console.log(`Serving ${url} from cache`);
            return this.createResponseFromCache(cached, url);
        }

        // Try to get from peers
        const peerResponse = await this.requestFromPeers(url);
        if (peerResponse) {
            console.log(`Serving ${url} from peer`);
            this.cache.store(url, peerResponse.content);
            return this.createResponseFromPeer(peerResponse, url);
        }

        // Fallback to origin server
        console.log(`Falling back to origin for ${url}`);
        return originalFetch(url, init);
    }

    async requestFromPeers(url) {
        if (this.peers.size === 0) {
            return null;
        }

        // Select optimal peers
        const optimalPeers = this.selectOptimalPeers(url, 3);
        
        for (const peerId of optimalPeers) {
            try {
                const response = await this.requestContentFromPeer(peerId, url);
                if (response && this.validateContent(response.content, url)) {
                    return response;
                }
            } catch (error) {
                console.warn(`Failed to get content from peer ${peerId}:`, error);
                continue;
            }
        }

        return null;
    }

    selectOptimalPeers(url, count = 3) {
        // Simple selection strategy - return first N peers
        // In production, implement more sophisticated scoring
        return Array.from(this.peers.keys()).slice(0, count);
    }

    async requestContentFromPeer(peerId, url) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Peer request timeout'));
            }, 10000);

            // Set up response handler
            const responseHandler = (data) => {
                clearTimeout(timeout);
                if (data.type === 'contentResponse' && data.url === url) {
                    this.removeListener('peerMessage', responseHandler);
                    resolve({ content: data.content, peerId });
                }
            };

            this.addListener('peerMessage', responseHandler);

            // Send request to peer
            const requestData = {
                type: 'contentRequest',
                url: url,
                requesterId: this.clientId
            };

            this.sendToPeer(peerId, JSON.stringify(requestData));
        });
    }

    validateContent(content, url) {
        // Basic validation - in production, implement cryptographic verification
        return content && typeof content === 'string' && content.length > 0;
    }

    createResponseFromCache(content, url) {
        return new Response(content, {
            status: 200,
            headers: {
                'Content-Type': this.getContentType(url),
                'X-DeployNet-Source': 'cache'
            }
        });
    }

    createResponseFromPeer(response, url) {
        return new Response(response.content, {
            status: 200,
            headers: {
                'Content-Type': this.getContentType(url),
                'X-DeployNet-Source': 'peer',
                'X-DeployNet-Peer': response.peerId
            }
        });
    }

    getContentType(url) {
        const extension = url.split('.').pop().toLowerCase();
        const mimeTypes = {
            'js': 'application/javascript',
            'css': 'text/css',
            'html': 'text/html',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            'woff': 'font/woff',
            'woff2': 'font/woff2',
            'ttf': 'font/ttf',
            'eot': 'application/vnd.ms-fontobject'
        };
        
        return mimeTypes[extension] || 'application/octet-stream';
    }

    async sendToPeer(peerId, data) {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(data);
        } else {
            console.warn(`Cannot send to peer ${peerId}, channel not ready`);
        }
    }

    handleSignalingMessage(message) {
        switch (message.type) {
            case 0: // Offer
                this.handleOffer(message);
                break;
            case 1: // Answer
                this.handleAnswer(message);
                break;
            case 2: // IceCandidate
                this.handleIceCandidate(message);
                break;
            case 3: // PeerDiscovery
                this.handlePeerDiscovery(message);
                break;
            case 6: // Register
                this.handlePeerRegistered(message);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    async handleOffer(message) {
        const offer = JSON.parse(message.payload);
        const peerId = message.senderId;
        
        const pc = new RTCPeerConnection(this.getRTCOpts());
        this.peerConnections.set(peerId, pc);
        
        pc.ondatachannel = (event) => {
            this.setupDataChannelForIncoming(event.channel, peerId);
        };
        
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        const answerMsg = {
            type: 1, // Answer
            payload: JSON.stringify(answer),
            senderId: this.clientId,
            timestamp: new Date().toISOString(),
            roomId: this.config.siteId
        };
        
        this.signalingChannel.send(JSON.stringify(answerMsg));
    }

    async handleAnswer(message) {
        const answer = JSON.parse(message.payload);
        const peerId = message.senderId;
        
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            await pc.setRemoteDescription(answer);
        }
    }

    handleIceCandidate(message) {
        const candidate = JSON.parse(message.payload);
        const peerId = message.senderId;
        
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            pc.addIceCandidate(candidate);
        }
    }

    handlePeerDiscovery(message) {
        const peerInfo = JSON.parse(message.payload);
        this.peers.set(message.senderId, peerInfo);
        console.log(`Discovered peer: ${message.senderId}`);
        
        // Initiate connection if we have capacity
        if (this.peerConnections.size < this.config.maxPeers) {
            this.initiatePeerConnection(message.senderId);
        }
    }

    handlePeerRegistered(message) {
        const peerInfo = JSON.parse(message.payload);
        this.peers.set(message.senderId, peerInfo);
        console.log(`Peer registered: ${message.senderId}`);
        
        // Initiate connection if we have capacity
        if (this.peerConnections.size < this.config.maxPeers) {
            this.initiatePeerConnection(message.senderId);
        }
    }

    async initiatePeerConnection(peerId) {
        if (this.peerConnections.has(peerId)) {
            return; // Already connected
        }

        const pc = new RTCPeerConnection(this.getRTCOpts());
        this.peerConnections.set(peerId, pc);

        const dataChannel = pc.createDataChannel(`deploy-${peerId}`, {
            ordered: false,
            maxRetransmits: 0
        });

        this.setupDataChannelForOutgoing(dataChannel, peerId);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const candidateMsg = {
                    type: 2, // IceCandidate
                    payload: JSON.stringify(event.candidate),
                    senderId: this.clientId,
                    timestamp: new Date().toISOString(),
                    roomId: this.config.siteId
                };
                
                this.signalingChannel.send(JSON.stringify(candidateMsg));
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`Peer connection state for ${peerId}: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.cleanupPeerConnection(peerId);
            }
        };

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            const offerMsg = {
                type: 0, // Offer
                payload: JSON.stringify(offer),
                senderId: this.clientId,
                timestamp: new Date().toISOString(),
                roomId: this.config.siteId
            };
            
            this.signalingChannel.send(JSON.stringify(offerMsg));
        } catch (error) {
            console.error('Error initiating peer connection:', error);
            this.cleanupPeerConnection(peerId);
        }
    }

    setupDataChannelForOutgoing(channel, peerId) {
        channel.onopen = () => {
            console.log(`Data channel opened for peer ${peerId}`);
            this.dataChannels.set(peerId, channel);
        };

        channel.onclose = () => {
            console.log(`Data channel closed for peer ${peerId}`);
            this.dataChannels.delete(peerId);
        };

        channel.onerror = (error) => {
            console.error(`Data channel error for peer ${peerId}:`, error);
        };

        channel.onmessage = (event) => {
            this.handlePeerMessage(peerId, event.data);
        };
    }

    setupDataChannelForIncoming(channel, peerId) {
        channel.onopen = () => {
            console.log(`Incoming data channel opened for peer ${peerId}`);
            this.dataChannels.set(peerId, channel);
        };

        channel.onclose = () => {
            console.log(`Incoming data channel closed for peer ${peerId}`);
            this.dataChannels.delete(peerId);
        };

        channel.onerror = (error) => {
            console.error(`Incoming data channel error for peer ${peerId}:`, error);
        };

        channel.onmessage = (event) => {
            this.handlePeerMessage(peerId, event.data);
        };
    }

    handlePeerMessage(peerId, data) {
        try {
            const message = JSON.parse(data);
            
            // Handle different message types
            switch (message.type) {
                case 'contentRequest':
                    this.handleContentRequest(peerId, message);
                    break;
                case 'contentResponse':
                    // This would be handled by the promise resolver in requestContentFromPeer
                    // Emit an event for the waiting promise
                    this.emit('peerMessage', message);
                    break;
                default:
                    console.log(`Unknown peer message type from ${peerId}:`, message.type);
            }
        } catch (error) {
            console.error('Error parsing peer message:', error);
        }
    }

    async handleContentRequest(peerId, request) {
        const content = this.cache.get(request.url);
        
        if (content) {
            const response = {
                type: 'contentResponse',
                url: request.url,
                content: content,
                responderId: this.clientId
            };
            
            this.sendToPeer(peerId, JSON.stringify(response));
        } else {
            // Could implement forwarding to other peers here
            console.log(`Content not found in cache for request: ${request.url}`);
        }
    }

    getRTCOpts() {
        return {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
    }

    cleanupPeerConnection(peerId) {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(peerId);
        }
        
        const channel = this.dataChannels.get(peerId);
        if (channel) {
            channel.close();
            this.dataChannels.delete(peerId);
        }
        
        this.peers.delete(peerId);
    }

    addListener(event, handler) {
        // Simple event emitter implementation
        if (!this.eventHandlers) {
            this.eventHandlers = new Map();
        }
        
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        
        this.eventHandlers.get(event).push(handler);
    }

    removeListener(event, handler) {
        if (this.eventHandlers && this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventHandlers && this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                handler(data);
            });
        }
    }
}

class ContentCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.currentSize = 0;
        this.entries = new Map(); // URL -> content
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
        const content = this.entries.get(url);
        if (content) {
            this.accessTime.set(url, Date.now()); // Update access time
            return content;
        }
        return null;
    }

    async evictLRU(requiredSpace) {
        const sortedEntries = [...this.accessTime.entries()]
            .sort((a, b) => a[1] - b[1]); // Sort by access time (oldest first)
        
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

class WebRTCManager {
    constructor(client) {
        this.client = client;
    }

    async createPeerConnection(peerId) {
        const pc = new RTCPeerConnection(this.client.getRTCOpts());
        this.client.setupDataChannelForOutgoing(pc, peerId);
        return pc;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeployNetClient;
} else if (typeof window !== 'undefined') {
    window.DeployNetClient = DeployNetClient;
}