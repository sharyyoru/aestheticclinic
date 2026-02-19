const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const {
  getUserSession,
  upsertUserSession,
  updateSessionStatus,
  updateSessionQR,
  clearSessionQR,
  logEvent
} = require('./db');

// Store active WhatsApp clients per user
const clients = new Map();

// Track init watchdog timers per user
const initWatchdogs = new Map();

// WebSocket clients per user for real-time updates
const wsClientsByUser = new Map();

/**
 * Get or create WhatsApp client for a specific user
 */
function getWhatsAppClient(userId) {
  if (clients.has(userId)) {
    return clients.get(userId);
  }

  console.log(`Creating new WhatsApp client for user: ${userId}`);
  
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: path.join(__dirname, 'whatsapp-sessions')
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  // Helpful diagnostics (Railway debugging)
  client.on('loading_screen', (percent, message) => {
    console.log(`WhatsApp loading for user ${userId}: ${percent}% - ${message}`);
  });

  client.on('change_state', (state) => {
    console.log(`WhatsApp state changed for user ${userId}: ${state}`);
  });

  // QR Code event
  client.on('qr', async (qr) => {
    console.log(`QR Code received for user: ${userId}`);

    // QR means init succeeded; stop watchdog
    const watchdog = initWatchdogs.get(userId);
    if (watchdog) {
      clearTimeout(watchdog);
      initWatchdogs.delete(userId);
    }
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
      updateSessionQR(userId, qrDataUrl);
      logEvent(userId, 'qr_generated');
      
      // Broadcast to user's WebSocket clients
      broadcastToUser(userId, 'qr', { qrDataUrl });
      broadcastToUser(userId, 'status', { status: 'qr_pending', qrCode: qrDataUrl });
    } catch (err) {
      console.error(`QR generation error for user ${userId}:`, err);
      logEvent(userId, 'qr_error', { error: err.message });
    }
  });

  // Authenticated event
  client.on('authenticated', () => {
    console.log(`WhatsApp authenticated for user: ${userId}`);

    // Authenticated means init succeeded; stop watchdog
    const watchdog = initWatchdogs.get(userId);
    if (watchdog) {
      clearTimeout(watchdog);
      initWatchdogs.delete(userId);
    }
    clearSessionQR(userId);
    updateSessionStatus(userId, 'authenticated');
    logEvent(userId, 'authenticated');
    
    broadcastToUser(userId, 'status', { status: 'authenticated' });
  });

  // Ready event
  client.on('ready', async () => {
    console.log(`WhatsApp ready for user: ${userId}`);

    // Ready means init succeeded; stop watchdog
    const watchdog = initWatchdogs.get(userId);
    if (watchdog) {
      clearTimeout(watchdog);
      initWatchdogs.delete(userId);
    }
    
    try {
      const info = client.info;
      const phoneNumber = info?.wid?.user || 'Unknown';
      const displayName = info?.pushname || 'WhatsApp User';
      
      upsertUserSession(userId, {
        phoneNumber,
        displayName,
        status: 'ready',
        connectedAt: new Date().toISOString()
      });
      
      logEvent(userId, 'ready', { phoneNumber, displayName });
      
      console.log(`User ${userId} connected as: ${displayName} (${phoneNumber})`);
      
      broadcastToUser(userId, 'status', { 
        status: 'ready', 
        phoneNumber, 
        displayName,
        connectedAt: new Date().toISOString()
      });
      broadcastToUser(userId, 'ready', { message: 'WhatsApp is ready' });
    } catch (err) {
      console.error(`Error getting info for user ${userId}:`, err);
      updateSessionStatus(userId, 'ready');
      logEvent(userId, 'ready');
      
      broadcastToUser(userId, 'status', { status: 'ready' });
    }
  });

  // Message event
  client.on('message_create', async (message) => {
    try {
      // Skip status messages
      if (message.isStatus) return;
      
      logEvent(userId, 'message', {
        from: message.from,
        to: message.to,
        fromMe: message.fromMe,
        hasMedia: message.hasMedia
      });
      
      broadcastToUser(userId, 'message', {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        fromMe: message.fromMe,
        timestamp: message.timestamp
      });
    } catch (err) {
      console.error(`Error processing message for user ${userId}:`, err);
    }
  });

  // Disconnected event
  client.on('disconnected', (reason) => {
    console.log(`WhatsApp disconnected for user ${userId}:`, reason);

    const watchdog = initWatchdogs.get(userId);
    if (watchdog) {
      clearTimeout(watchdog);
      initWatchdogs.delete(userId);
    }
    updateSessionStatus(userId, 'disconnected');
    logEvent(userId, 'disconnected', { reason });
    
    broadcastToUser(userId, 'status', { status: 'disconnected', reason });
    broadcastToUser(userId, 'disconnected', { reason });
    
    // Clean up client
    clients.delete(userId);
  });

  // Auth failure
  client.on('auth_failure', (msg) => {
    console.error(`WhatsApp auth failure for user ${userId}:`, msg);

    const watchdog = initWatchdogs.get(userId);
    if (watchdog) {
      clearTimeout(watchdog);
      initWatchdogs.delete(userId);
    }
    updateSessionStatus(userId, 'disconnected');
    logEvent(userId, 'auth_failure', { message: msg });
    
    broadcastToUser(userId, 'status', { status: 'disconnected', error: 'Authentication failed' });
    broadcastToUser(userId, 'error', { message: 'Authentication failed' });
  });

  clients.set(userId, client);
  return client;
}

// Track which users are currently initializing to prevent duplicate calls
const initializingUsers = new Set();

/**
 * Initialize WhatsApp for a user
 */
async function initializeWhatsApp(userId) {
  // Prevent duplicate initialization
  if (initializingUsers.has(userId)) {
    console.log(`WhatsApp already initializing for user: ${userId}`);
    return { success: true, message: 'Already initializing' };
  }

  const client = getWhatsAppClient(userId);
  
  // Check if already initialized
  const state = await client.getState().catch(() => null);
  if (state === 'CONNECTED') {
    console.log(`WhatsApp already connected for user: ${userId}`);
    return { success: true, message: 'Already connected' };
  }
  
  console.log(`Initializing WhatsApp for user: ${userId}`);
  initializingUsers.add(userId);
  updateSessionStatus(userId, 'launching');
  logEvent(userId, 'initialize_start');

  // If initialization hangs (Chromium stuck), cleanup so the user can retry.
  // This is common on low-memory instances.
  const existingWatchdog = initWatchdogs.get(userId);
  if (existingWatchdog) {
    clearTimeout(existingWatchdog);
  }
  initWatchdogs.set(userId, setTimeout(async () => {
    console.error(`Initialization timeout for user ${userId} (no QR/auth/ready)`);
    initializingUsers.delete(userId);
    initWatchdogs.delete(userId);
    logEvent(userId, 'initialize_timeout');
    updateSessionStatus(userId, 'disconnected');

    const clientToDestroy = clients.get(userId);
    clients.delete(userId);
    try {
      if (clientToDestroy) {
        await clientToDestroy.destroy();
      }
    } catch (e) {
      console.error(`Error destroying timed-out client for user ${userId}:`, e);
    }
  }, 90000));
  
  // Start initialization in background (don't block the HTTP response)
  client.initialize().then(() => {
    console.log(`WhatsApp client initialized for user: ${userId}`);
    initializingUsers.delete(userId);
  }).catch(err => {
    console.error(`Initialization error for user ${userId}:`, err);
    initializingUsers.delete(userId);
    const watchdog = initWatchdogs.get(userId);
    if (watchdog) {
      clearTimeout(watchdog);
      initWatchdogs.delete(userId);
    }
    clients.delete(userId);
    updateSessionStatus(userId, 'disconnected');
    logEvent(userId, 'initialize_error', { error: err.message });
  });
  
  return { success: true, message: 'Initialization started' };
}

/**
 * Disconnect WhatsApp for a user
 */
async function disconnectWhatsApp(userId) {
  const client = clients.get(userId);
  
  if (!client) {
    return { success: true, message: 'Not connected' };
  }
  
  console.log(`Disconnecting WhatsApp for user: ${userId}`);
  
  try {
    await client.logout();
    await client.destroy();
    clients.delete(userId);
    
    updateSessionStatus(userId, 'disconnected');
    logEvent(userId, 'disconnect');
    
    broadcastToUser(userId, 'status', { status: 'disconnected' });
    
    return { success: true, message: 'Disconnected successfully' };
  } catch (err) {
    console.error(`Disconnect error for user ${userId}:`, err);
    // Force cleanup even on error
    clients.delete(userId);
    updateSessionStatus(userId, 'disconnected');
    throw err;
  }
}

/**
 * Get connection status for a user
 */
async function getConnectionStatus(userId) {
  const session = getUserSession(userId);
  const client = clients.get(userId);
  
  let isReady = false;
  let clientState = null;
  
  if (client) {
    try {
      clientState = await client.getState();
      isReady = clientState === 'CONNECTED';
    } catch (err) {
      // Client exists but Chromium is still starting — not an error if we're initializing
      clientState = initializingUsers.has(userId) ? 'LAUNCHING' : 'ERROR';
    }
  }
  
  // Use DB status, but if we know we're initializing, override
  let status = session?.status || 'disconnected';
  if (initializingUsers.has(userId) && status === 'disconnected') {
    status = 'launching';
  }
  
  return {
    status,
    qrCode: session?.qr_code || null,
    phoneNumber: session?.phone_number || null,
    displayName: session?.display_name || null,
    connectedAt: session?.connected_at || null,
    lastActivity: session?.last_activity || null,
    isReady,
    clientState
  };
}

/**
 * Get all chats for a user
 */
async function getChats(userId) {
  const client = clients.get(userId);
  
  if (!client) {
    throw new Error('WhatsApp not connected');
  }
  
  const state = await client.getState();
  if (state !== 'CONNECTED') {
    throw new Error('WhatsApp not ready');
  }
  
  const chats = await client.getChats();
  return chats.map(chat => ({
    id: chat.id._serialized,
    name: chat.name,
    isGroup: chat.isGroup,
    unreadCount: chat.unreadCount,
    lastMessage: chat.lastMessage?.body || '',
    timestamp: chat.timestamp
  }));
}

/**
 * Get messages from a chat
 */
async function getMessages(userId, chatId, limit = 50) {
  const client = clients.get(userId);
  
  if (!client) {
    throw new Error('WhatsApp not connected');
  }
  
  const chat = await client.getChatById(chatId);
  const messages = await chat.fetchMessages({ limit });
  
  return messages.map(msg => ({
    id: msg.id._serialized,
    body: msg.body,
    fromMe: msg.fromMe,
    timestamp: msg.timestamp,
    author: msg.author || msg.from,
    hasMedia: msg.hasMedia,
    type: msg.type
  }));
}

/**
 * Send a message
 */
async function sendMessage(userId, chatId, message) {
  const client = clients.get(userId);
  
  if (!client) {
    throw new Error('WhatsApp not connected');
  }
  
  const state = await client.getState();
  if (state !== 'CONNECTED') {
    throw new Error('WhatsApp not ready');
  }
  
  await client.sendMessage(chatId, message);
  logEvent(userId, 'message_sent', { chatId, messageLength: message.length });
}

/**
 * Get chat by phone number
 */
async function getChatByPhoneNumber(userId, phoneNumber) {
  const client = clients.get(userId);
  
  if (!client) {
    throw new Error('WhatsApp not connected');
  }
  
  const formattedNumber = phoneNumber.replace(/\D/g, '');
  const chatId = `${formattedNumber}@c.us`;
  
  try {
    const chat = await client.getChatById(chatId);
    return {
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      unreadCount: chat.unreadCount,
      lastMessage: chat.lastMessage?.body || '',
      timestamp: chat.timestamp
    };
  } catch (err) {
    return null;
  }
}

/**
 * Register WebSocket client for a user
 */
function registerWebSocket(userId, ws) {
  if (!wsClientsByUser.has(userId)) {
    wsClientsByUser.set(userId, new Set());
  }
  wsClientsByUser.get(userId).add(ws);
  
  console.log(`WebSocket registered for user: ${userId}`);
}

/**
 * Unregister WebSocket client
 */
function unregisterWebSocket(userId, ws) {
  const userClients = wsClientsByUser.get(userId);
  if (userClients) {
    userClients.delete(ws);
    if (userClients.size === 0) {
      wsClientsByUser.delete(userId);
    }
  }
}

/**
 * Broadcast message to all WebSocket clients of a user
 */
function broadcastToUser(userId, type, data) {
  const userClients = wsClientsByUser.get(userId);
  if (!userClients) return;
  
  const message = JSON.stringify({ 
    type, 
    data, 
    timestamp: new Date().toISOString() 
  });
  
  userClients.forEach(ws => {
    if (ws.readyState === 1) { // OPEN
      ws.send(message);
    }
  });
}

/**
 * Get all active clients (for diagnostics)
 */
function getActiveClients() {
  return Array.from(clients.keys());
}

module.exports = {
  getWhatsAppClient,
  initializeWhatsApp,
  disconnectWhatsApp,
  getConnectionStatus,
  getChats,
  getMessages,
  sendMessage,
  getChatByPhoneNumber,
  registerWebSocket,
  unregisterWebSocket,
  broadcastToUser,
  getActiveClients
};
