require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const { requireAuth, optionalAuth, extractUserId } = require('./auth');
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
  getActiveClients,
  destroyAllClients
} = require('./whatsapp-manager');
const { getAllActiveSessions, getRecentLogs, getReconnectableSessions, updateSessionStatus, logEvent } = require('./db');
const fs = require('fs');
const path = require('path');
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

  // Diagnose volume mounts so we can tell from logs whether persistence is working
  const waSessionPath = process.env.WA_SESSION_PATH || path.join(__dirname, 'whatsapp-sessions');
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'sessions.db');
  try {
    const waStats = fs.statSync(waSessionPath);
    const sessionFiles = fs.readdirSync(waSessionPath);
    console.log(`[Volume] WA_SESSION_PATH: ${waSessionPath} (exists, ${sessionFiles.length} session(s) found)`);
    sessionFiles.forEach(f => console.log(`[Volume]   - ${f}`));
  } catch {
    console.warn(`[Volume] WA_SESSION_PATH: ${waSessionPath} — MISSING (sessions will NOT persist across restarts!)`);
    console.warn(`[Volume]   Make sure your Railway volume is mounted at: ${path.dirname(waSessionPath)}`);
  }
  try {
    fs.statSync(dbPath);
    console.log(`[Volume] DB_PATH: ${dbPath} (exists — SQLite state will persist)`);
  } catch {
    console.warn(`[Volume] DB_PATH: ${dbPath} — will be created fresh (no prior session state)`);
  }

  // Start queue processor after server is listening
  startQueueProcessor();

  // Auto-reconnect sessions that were active before redeploy
  autoReconnectSessions();
});

/**
 * Auto-reconnect WhatsApp sessions that were active before a redeploy.
 *
 * Two sources of truth are combined:
 *  1. SQLite DB — users whose status was 'ready'/'authenticated' last run
 *  2. Disk scan  — session-{uuid} directories on the volume that have no DB
 *                  record yet (e.g. after a DB path migration / first boot with
 *                  a fresh DB but existing volume data)
 *
 * Any user with session files on disk is attempted — LocalAuth will use the
 * saved credentials and skip the QR scan if the phone is still connected.
 */
async function autoReconnectSessions() {
  try {
    const sessionBasePath = process.env.WA_SESSION_PATH || '/data/whatsapp-sessions';

    // Source 1: DB records
    const dbSessions = getReconnectableSessions() || [];
    const dbUserIds = new Set(dbSessions.map(s => s.user_id));

    // Source 2: Disk scan — find all session-<uuid> directories on the volume
    let diskUserIds = [];
    try {
      const entries = fs.readdirSync(sessionBasePath);
      diskUserIds = entries
        .filter(e => e.startsWith('session-'))
        .map(e => e.replace('session-', ''))
        .filter(id => !dbUserIds.has(id)); // only ones not already in DB list
      if (diskUserIds.length > 0) {
        console.log(`[AutoReconnect] Found ${diskUserIds.length} session(s) on disk not in DB (DB migration?) — will attempt reconnect`);
      }
    } catch (err) {
      console.warn('[AutoReconnect] Could not scan session directory:', err.message);
    }

    // Merge both sources
    const allToReconnect = [
      ...dbSessions.map(s => ({ userId: s.user_id, displayName: s.display_name || 'unknown', source: 'db' })),
      ...diskUserIds.map(id => ({ userId: id, displayName: 'unknown (disk only)', source: 'disk' })),
    ];

    if (allToReconnect.length === 0) {
      console.log('[AutoReconnect] No previously-active sessions to restore');
      return;
    }

    console.log(`[AutoReconnect] Restoring ${allToReconnect.length} session(s) (1 at a time, 15s apart to protect memory)...`);

    for (const { userId, displayName, source } of allToReconnect) {
      const sessionDir = path.join(sessionBasePath, `session-${userId}`);
      if (!fs.existsSync(sessionDir)) {
        console.log(`[AutoReconnect] No session files for user ${userId} — skipping (will need QR re-scan)`);
        updateSessionStatus(userId, 'disconnected');
        continue;
      }

      console.log(`[AutoReconnect] Restoring session for user ${userId} (${displayName}) [source: ${source}]`);
      logEvent(userId, 'auto_reconnect_start');

      try {
        await initializeWhatsApp(userId);
        // Stagger reconnects — each Chromium instance needs ~15s to fully load
        // before launching the next one, otherwise the container runs out of memory
        await new Promise(resolve => setTimeout(resolve, 15000));
      } catch (err) {
        console.error(`[AutoReconnect] Failed to restore session for user ${userId}:`, err.message);
        logEvent(userId, 'auto_reconnect_error', { error: err.message });
      }
    }
  } catch (err) {
    console.error('[AutoReconnect] Error during auto-reconnect:', err);
  }
}

// Graceful shutdown — destroy all WA clients so session data is flushed to disk
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  stopQueueProcessor();

  // Destroy all active WhatsApp clients (flushes LocalAuth session to disk)
  await destroyAllClients();

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit after 15s if graceful shutdown stalls
  setTimeout(() => {
    console.error('Forced exit after timeout');
    process.exit(1);
  }, 15000);
});
