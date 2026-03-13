const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

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

  console.log(`[WA] Creating new WhatsApp client for user: ${userId}`);
  
  const sessionPath = process.env.SESSION_DATA_PATH || path.join(__dirname, 'whatsapp-sessions');
  console.log(`[WA] Session data path: ${sessionPath}`);
  
  // Ensure session directory exists
  if (!fs.existsSync(sessionPath)) {
    console.log(`[WA] Creating session directory: ${sessionPath}`);
    try {
      fs.mkdirSync(sessionPath, { recursive: true });
      console.log(`[WA] Session directory created successfully`);
    } catch (err) {
      console.error(`[WA] Failed to create session directory:`, err);
      throw err;
    }
  } else {
    console.log(`[WA] Session directory already exists`);
    const stats = fs.statSync(sessionPath);
    console.log(`[WA] Session directory permissions:`, stats.mode.toString(8));
    
    // Clean up Chromium lock files that might prevent startup
    try {
      // WhatsApp Web.js stores sessions in user-specific subdirectories
      const userSessionPath = path.join(sessionPath, `session-${userId}`);
      
      // Clean lock files in both main session dir and user session dir
      const dirsToClean = [sessionPath, userSessionPath];
      
      for (const dir of dirsToClean) {
        if (fs.existsSync(dir)) {
          const lockFiles = ['SingletonLock', 'SingletonSocket'];
          for (const file of lockFiles) {
            const lockPath = path.join(dir, file);
            if (fs.existsSync(lockPath)) {
              console.log(`[WA] Removing Chromium lock file: ${path.relative(sessionPath, lockPath)}`);
              fs.unlinkSync(lockPath);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[WA] Warning: Could not clean lock files:`, err.message);
    }
  }
  
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: sessionPath
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
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--enable-features=UseOzonePlatform',
        '--ozone-platform=headless'
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
      const qrCodeDataUrl = await QRCode.toDataURL(qr);
      broadcastToUser(userId, 'qr', { qrCode: qrCodeDataUrl });
      
      // Broadcast to user's WebSocket clients
      broadcastToUser(userId, 'qr', { qrDataUrl });
      broadcastToUser(userId, 'status', { status: 'qr_pending', qrCode: qrDataUrl });
    } catch (err) {
      console.error(`QR generation error for user ${userId}:`, err);
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
  const initClient = async (sessionPath) => {
    try {
      await client.initialize();
      console.log(`WhatsApp client initialized for user: ${userId}`);
      initializingUsers.delete(userId);
    } catch (err) {
      console.error(`Initialization error for user ${userId}:`, err);
      
      // If it's a profile lock error, try cleaning up and retry once
      if (err.message.includes('profile appears to be in use')) {
        console.log(`[WA] Profile lock detected, cleaning up and retrying...`);
        
        // Clean up all possible lock files
        const dirsToClean = [
          sessionPath,
          path.join(sessionPath, `session-${userId}`),
          path.join(sessionPath, 'Default'),
          path.join(sessionPath, 'Profile 1')
        ];
        
        for (const dir of dirsToClean) {
          if (fs.existsSync(dir)) {
            const lockFiles = ['SingletonLock', 'SingletonSocket', 'lockfile'];
            for (const file of lockFiles) {
              const lockPath = path.join(dir, file);
              if (fs.existsSync(lockPath)) {
                console.log(`[WA] Removing lock file: ${path.relative(sessionPath, lockPath)}`);
                try {
                  fs.unlinkSync(lockPath);
                } catch (e) {
                  // Ignore errors during cleanup
                }
              }
            }
          }
        }
        
        // Wait a bit and retry
        setTimeout(async () => {
          try {
            await client.initialize();
            console.log(`WhatsApp client initialized for user: ${userId} (retry)`);
            initializingUsers.delete(userId);
          } catch (retryErr) {
            console.error(`Retry failed for user ${userId}:`, retryErr);
            cleanup();
          }
        }, 2000);
      } else {
        cleanup();
      }
      
      function cleanup() {
        initializingUsers.delete(userId);
        const watchdog = initWatchdogs.get(userId);
        if (watchdog) {
          clearTimeout(watchdog);
          initWatchdogs.delete(userId);
        }
        clients.delete(userId);
      }
    }
  };
  
  initClient(sessionPath);
  
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
    
        
    broadcastToUser(userId, 'status', { status: 'disconnected' });
    
    return { success: true, message: 'Disconnected successfully' };
  } catch (err) {
    console.error(`Disconnect error for user ${userId}:`, err);
    // Force cleanup even on error
    clients.delete(userId);
    throw err;
  }
}

/**
 * Get connection status for a user
 */
async function getConnectionStatus(userId) {
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
  
  // Determine status based on client state and initialization
  let status = 'disconnected';
  if (initializingUsers.has(userId)) {
    status = 'launching';
  } else if (isReady) {
    status = 'ready';
  }
  
  return {
    status,
    qrCode: null,
    phoneNumber: null,
    displayName: null,
    connectedAt: null,
    lastActivity: null,
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
async function getMessages(userId, chatId, limit = 100) {
  const client = clients.get(userId);
  
  if (!client) {
    throw new Error('WhatsApp not connected');
  }
  
  const chat = await client.getChatById(chatId);
  const messages = await chat.fetchMessages({ limit });

  // Build a contact-name cache so we don't re-fetch the same contact
  const nameCache = new Map();

  // For group chats, pre-populate cache from participant list
  // This resolves @lid IDs that getContactById cannot handle
  if (chat.isGroup && chat.participants) {
    for (const p of chat.participants) {
      try {
        const pid = p.id?._serialized || p.id;
        if (pid) {
          const contact = await client.getContactById(pid);
          const name = contact.pushname || contact.name || contact.shortName || contact.number || null;
          if (name) {
            nameCache.set(pid, name);
          }
        }
      } catch { /* skip */ }
    }
  }

  // Also try to build a @lid -> name mapping from participants
  // whatsapp-web.js group participants have id in @c.us format
  // but msg.author in groups can be @lid format
  // We build a reverse lookup by phone-number suffix
  const lidLookup = new Map();
  for (const [key, name] of nameCache.entries()) {
    // Extract digits from the @c.us key
    const digits = key.replace(/@.*$/, '');
    if (digits) {
      lidLookup.set(digits, name);
      // Also store last 10 digits for fuzzy match
      if (digits.length > 10) {
        lidLookup.set(digits.slice(-10), name);
      }
    }
  }

  const resolveName = async (contactId) => {
    if (!contactId) return null;
    if (nameCache.has(contactId)) return nameCache.get(contactId);

    // Try @lid -> phone-digit matching
    if (contactId.includes('@lid') || contactId.includes('@g.us')) {
      const digits = contactId.replace(/@.*$/, '');
      const found = lidLookup.get(digits) || lidLookup.get(digits.slice(-10));
      if (found) {
        nameCache.set(contactId, found);
        return found;
      }
    }

    // Direct contact lookup (works for @c.us IDs)
    try {
      const contact = await client.getContactById(contactId);
      const name = contact.pushname || contact.name || contact.shortName || null;
      nameCache.set(contactId, name);
      return name;
    } catch {
      nameCache.set(contactId, null);
      return null;
    }
  };

  const result = await Promise.all(messages.map(async (msg) => {
    const authorId = msg.author || msg.from;
    const authorName = msg.fromMe ? null : await resolveName(authorId);

    // Try to download media
    let mediaData = null;
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media) {
          const isVisual = media.mimetype?.startsWith('image/') || media.mimetype?.startsWith('video/');
          mediaData = {
            mimetype: media.mimetype,
            filename: media.filename || null,
            // Inline base64 for images/videos under ~1MB
            data: isVisual && media.data && media.data.length < 1_400_000
              ? media.data : null,
          };
        }
      } catch {
        // Media download can fail for old messages
        mediaData = { mimetype: null, filename: null, data: null };
      }
    }

    return {
      id: msg.id._serialized,
      body: msg.body,
      fromMe: msg.fromMe,
      timestamp: msg.timestamp,
      author: authorId,
      authorName,
      hasMedia: msg.hasMedia,
      type: msg.type,
      media: mediaData,
    };
  }));

  return result;
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
