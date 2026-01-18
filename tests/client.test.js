const DeployNetClient = require('./web/client.js');

// Basic tests for DeployNet client
describe('DeployNet Client', () => {
  test('should initialize with correct config', () => {
    const client = new DeployNetClient({
      signalingServer: 'ws://localhost:8080',
      siteId: 'test-site'
    });
    
    expect(client.config.signalingServer).toBe('ws://localhost:8080');
    expect(client.config.siteId).toBe('test-site');
  });

  test('should generate valid client ID', () => {
    const client = new DeployNetClient({
      signalingServer: 'ws://localhost:8080',
      siteId: 'test-site'
    });
    
    const clientId = client.generateClientId();
    expect(clientId).toMatch(/^deploy-[a-z0-9]+-\d+$/);
  });

  test('should detect static assets correctly', () => {
    const client = new DeployNetClient({
      signalingServer: 'ws://localhost:8080',
      siteId: 'test-site'
    });
    
    expect(client.isStaticAsset('/style.css')).toBe(true);
    expect(client.isStaticAsset('/script.js')).toBe(true);
    expect(client.isStaticAsset('/image.png')).toBe(true);
    expect(client.isStaticAsset('/api/data')).toBe(false);
  });
});

// Mock WebSocket for testing
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
  }
  
  send(data) {
    // Mock send implementation
  }
  
  close() {
    this.readyState = 3; // CLOSED
  }
};

// Mock RTCPeerConnection for testing
global.RTCPeerConnection = class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.connectionState = 'connected';
  }
  
  createDataChannel(label, options) {
    return {
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      readyState: 'open',
      send: jest.fn()
    };
  }
  
  close() {
    this.connectionState = 'closed';
  }
};

// Mock fetch for testing
global.fetch = jest.fn(() => Promise.resolve({
  text: () => Promise.resolve('mock content'),
  json: () => Promise.resolve({}),
  blob: () => Promise.resolve(new Blob(['mock content'])),
  headers: {
    get: (name) => name === 'content-type' ? 'text/html' : null
  }
}));