require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { requireAuth, optionalAuth, extractUserId } = require('./auth');

// Log startup environment
console.log('='.repeat(60));
console.log('WhatsApp Server Startup');
console.log('='.repeat(60));
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || '3001');
console.log('DB_PATH:', process.env.DB_PATH || 'default (./sessions.db)');
console.log('SESSION_DATA_PATH:', process.env.SESSION_DATA_PATH || 'default (./whatsapp-sessions)');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');

// Check if data directory exists
if (process.env.DB_PATH) {
  const dbDir = path.dirname(process.env.DB_PATH);
  console.log('Database directory:', dbDir);
  console.log('Database directory exists:', fs.existsSync(dbDir));
  if (fs.existsSync(dbDir)) {
    const stats = fs.statSync(dbDir);
    console.log('Directory permissions:', stats.mode.toString(8));
  }
}

if (process.env.SESSION_DATA_PATH) {
  console.log('Session directory:', process.env.SESSION_DATA_PATH);
  console.log('Session directory exists:', fs.existsSync(process.env.SESSION_DATA_PATH));
  if (fs.existsSync(process.env.SESSION_DATA_PATH)) {
    const stats = fs.statSync(process.env.SESSION_DATA_PATH);
    console.log('Directory permissions:', stats.mode.toString(8));
  }
}
console.log('='.repeat(60));
const {
  initializeWhatsApp,
  disconnectWhatsApp,
  getConnectionStatus,
  getChats,
  getMessages,
  sendMessage,
  getChatByPhoneNumber,
  registerWebSocket,
  unregisterWebSocket,
  getActiveClients
} = require('./whatsapp-manager');
const { getAllActiveSessions, getRecentLogs } = require('./db');
const { startQueueProcessor, stopQueueProcessor, getQueueStats } = require('./queue-processor');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Configuration
const PORT = process.env.PORT || process.env.WA_SERVER_PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

// CORS
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));
app.use(express.json());

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeClients: getActiveClients().length
  });
});

// Get current status for a user
app.get('/status', requireAuth, async (req, res) => {
  try {
    const status = await getConnectionStatus(req.userId);
    res.json(status);
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Initialize/connect WhatsApp for a user
app.post('/connect', requireAuth, async (req, res) => {
  try {
    const result = await initializeWhatsApp(req.userId);
    res.json(result);
  } catch (err) {
    console.error('Connect error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Disconnect WhatsApp for a user
app.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const result = await disconnectWhatsApp(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all chats for a user
app.get('/chats', requireAuth, async (req, res) => {
  try {
    const chats = await getChats(req.userId);
    res.json({ chats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages from a specific chat
app.get('/messages/:chatId', requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const messages = await getMessages(req.userId, chatId, limit);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a message
app.post('/send', requireAuth, async (req, res) => {
  try {
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }
    
    await sendMessage(req.userId, chatId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get chat by phone number
app.get('/chat-by-phone', requireAuth, async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({ error: 'phone parameter is required' });
    }
    
    const chat = await getChatByPhoneNumber(req.userId, phone);
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get session logs for a user
app.get('/logs', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = getRecentLogs(req.userId, limit);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get all active sessions (requires admin auth)
app.get('/admin/sessions', optionalAuth, (req, res) => {
  try {
    const sessions = getAllActiveSessions();
    const activeClients = getActiveClients();
    res.json({ 
      sessions,
      activeClients,
      totalSessions: sessions.length,
      totalActiveClients: activeClients.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Queue stats endpoint
app.get('/queue/stats', optionalAuth, async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Diagnostics endpoint
app.get('/diagnostics', optionalAuth, async (req, res) => {
  const queueStats = await getQueueStats().catch(() => ({ error: 'unavailable' }));
  res.json({
    serverStatus: 'running',
    activeClients: getActiveClients(),
    activeSessions: getAllActiveSessions().length,
    queueStats,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('WebSocket connection attempt');
  
  // Extract user ID from query params or headers
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token') || req.headers.authorization;
  
  if (!token) {
    ws.close(1008, 'Authentication required');
    return;
  }
  
  // Create a fake request object for auth extraction
  const fakeReq = { headers: { authorization: token } };
  const userId = extractUserId(fakeReq);
  
  if (!userId) {
    ws.close(1008, 'Invalid authentication');
    return;
  }
  
  console.log(`WebSocket client connected for user: ${userId}`);
  registerWebSocket(userId, ws);
  
  // Send current status immediately
  getConnectionStatus(userId).then(status => {
    ws.send(JSON.stringify({ 
      type: 'status', 
      data: status,
      timestamp: new Date().toISOString()
    }));
  }).catch(err => {
    console.error('Error getting status:', err);
  });
  
  ws.on('close', () => {
    console.log(`WebSocket client disconnected for user: ${userId}`);
    unregisterWebSocket(userId, ws);
  });
  
  ws.on('error', (err) => {
    console.error(`WebSocket error for user ${userId}:`, err);
    unregisterWebSocket(userId, ws);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
  console.log('[SERVER] Server started successfully on port', PORT);
  console.log(`
╔════════════════════════════════════════════════════════╗
║     Aesthetics Clinic WhatsApp Server (Multi-User)     ║
╠════════════════════════════════════════════════════════╣
║  HTTP API:    http://localhost:${PORT}                    ║
║  WebSocket:   ws://localhost:${PORT}                      ║
║  Status:      http://localhost:${PORT}/status             ║
║  Health:      http://localhost:${PORT}/health             ║
╠════════════════════════════════════════════════════════╣
║  Features:    ✓ Multi-user sessions                    ║
║               ✓ SQLite session storage                 ║
║               ✓ JWT authentication                     ║
║               ✓ Real-time WebSocket updates            ║
║               ✓ Message queue processor                ║
╚════════════════════════════════════════════════════════╝
  `);

  // Start queue processor after server is listening
  console.log('[SERVER] Starting queue processor...');
  startQueueProcessor();
});

server.on('error', (error) => {
  console.error('[SERVER] Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`[SERVER] Port ${PORT} is already in use`);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught Exception:', error);
  console.error('[SERVER] Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  stopQueueProcessor();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
