// Main Application Logic

const BACKEND_URL = window.APP_CONFIG?.BACKEND_URL || 'http://localhost:3000';
const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL || 'https://ethxvptzasiezviuvfwv.supabase.co';
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHh2cHR6YXNpZXp2aXV2Znd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxOTg3NDIsImV4cCI6MjA4Mjc3NDc0Mn0.XikHP2O24anokFNxPs9Y1CNTbjn4xEnosVMs7KGZOSE';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize Crypto Helper
const cryptoHelper = new CryptoHelper();

// Global state
let currentUser = null;
let socket = null;
let currentChatId = null;
let currentRecipientId = null;

// DOM Elements
const authSection = document.getElementById('authSection');
const chatSection = document.getElementById('chatSection');
const alertContainer = document.getElementById('alertContainer');
const debugLog = document.getElementById('debugLog');
const chatDebugLog = document.getElementById('chatDebugLog');

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        await handleExistingSession(session);
    }

    // Set up event listeners
    document.getElementById('signupBtn').addEventListener('click', handleSignup);
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('startChatBtn').addEventListener('click', handleStartChat);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});

/**
 * Handle existing session
 */
async function handleExistingSession(session) {
    try {
        currentUser = session.user;
        updateDebugLog('🔄 Restoring session...');
        
        // Try to load master key from IndexedDB
        updateDebugLog('🔄 Loading master key from device...');
        const masterKey = await cryptoHelper.loadMasterKeyFromIndexedDB();
        
        if (!masterKey) {
            updateDebugLog('⚠️ Master key not found on this device');
            // Show login form to get password for decryption
            authSection.style.display = 'block';
            chatSection.style.display = 'none';
            showAlert('info', 'Please enter your password to decrypt your data on this device.');
            // Pre-fill email
            document.getElementById('loginEmail').value = session.user.email;
            document.getElementById('loginPassword').focus();
            return;
        }
        
        updateDebugLog('✅ Master key loaded from IndexedDB');
        
        // Get fresh session token
        const { data: { session: freshSession }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !freshSession) {
            updateDebugLog('⚠️ Session expired');
            showAlert('error', 'Session expired. Please login again.');
            await supabaseClient.auth.signOut();
            return;
        }
        
        // Load RSA keys from server
        updateDebugLog('🔄 Downloading encrypted RSA keys from server...');
        const response = await fetch(`${BACKEND_URL}/api/keys/${freshSession.user.id}`, {
            headers: {
                'Authorization': `Bearer ${freshSession.access_token}`,
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                updateDebugLog('⚠️ No encryption keys found. Please complete setup.');
                showAlert('error', 'Account setup incomplete. Please sign up again.');
                await supabaseClient.auth.signOut();
                return;
            }
            throw new Error('Failed to fetch encrypted RSA keys');
        }

        const keys = await response.json();
        updateDebugLog('✅ RSA keys downloaded');
        
        // Decrypt RSA private key with master key
        updateDebugLog('🔄 Decrypting RSA private key...');
        try {
            cryptoHelper.privateKey = await cryptoHelper.decryptRSAPrivateKey(keys.encrypted_rsa_private_key, masterKey);
            cryptoHelper.publicKey = await cryptoHelper.importPublicKey(keys.rsa_public_key);
            updateDebugLog('✅ RSA keys decrypted and ready');
        } catch (decryptError) {
            updateDebugLog('❌ Failed to decrypt keys - master key mismatch');
            showAlert('error', 'Encryption key mismatch. This account may be corrupted. Please delete your account and sign up again.');
            await supabaseClient.auth.signOut();
            // Clear corrupted master key
            await cryptoHelper.clearMasterKey();
            return;
        }
        
        showAlert('info', 'Session restored! Loading your chats...');
        await initializeChat();
    } catch (error) {
        console.error('Session error:', error);
        updateDebugLog(`❌ Error: ${error.message}`);
        showAlert('error', 'Failed to restore session. Please login again.');
        await supabaseClient.auth.signOut();
    }
}

/**
 * Handle signup
 */
async function handleSignup() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAlert('error', 'Please fill in all fields');
        return;
    }

    if (password.length < 6) {
        showAlert('error', 'Password must be at least 6 characters');
        return;
    }

    try {
        updateDebugLog('🔄 Step 1: Generating master encryption key...');
        
        // Generate random master key (independent of password)
        const masterKey = await cryptoHelper.generateMasterKey();
        updateDebugLog('✅ Step 1: Master key generated! (256-bit AES-GCM, random)');

        updateDebugLog('🔄 Step 2: Encrypting master key with password...');
        
        // Encrypt master key with password
        const encryptedMasterKey = await cryptoHelper.encryptMasterKeyWithPassword(masterKey, password, email);
        updateDebugLog('✅ Step 2: Master key encrypted! (PBKDF2 100k iterations)');

        updateDebugLog('🔄 Step 3: Deriving auth password...');
        
        // Derive separate auth password (for Supabase login)
        const authPassword = await cryptoHelper.deriveAuthPassword(password, email);
        updateDebugLog('✅ Step 3: Auth password derived! (SHA-256)');

        updateDebugLog('🔄 Step 4: Creating Supabase account...');
        
        // Sign up with derived auth password
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password: authPassword,
        });

        if (error) throw error;

        if (data.user) {
            currentUser = data.user;
            updateDebugLog('✅ Step 4: Account created!');
            
            // Create user profile in backend
            updateDebugLog('🔄 Step 5: Creating user profile...');
            const profileResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${data.session.access_token}`,
                },
            });
            
            if (!profileResponse.ok) {
                const errorData = await profileResponse.json();
                console.error('Profile creation failed:', errorData);
                throw new Error(`Failed to create user profile: ${errorData.error || profileResponse.statusText}`);
            }
            
            updateDebugLog('✅ Step 5: Profile created!');
            
            // Generate RSA key pair
            updateDebugLog('🔄 Step 6: Generating RSA key pair (2048-bit)...');
            await cryptoHelper.generateUserKeys();
            updateDebugLog('✅ Step 6: RSA keys generated!');

            updateDebugLog('🔄 Step 7: Encrypting RSA private key with master key...');
            
            // Encrypt RSA private key with master key
            const encryptedRSAPrivateKey = await cryptoHelper.encryptRSAPrivateKey(cryptoHelper.privateKey, masterKey);
            updateDebugLog('✅ Step 7: RSA private key encrypted! (Double encryption)');

            updateDebugLog('🔄 Step 8: Storing master key on device (IndexedDB)...');
            
            // Store master key on device
            await cryptoHelper.storeMasterKeyInIndexedDB(masterKey);
            updateDebugLog('✅ Step 8: Master key stored locally! (Fast login next time)');
            
            // Upload all encrypted keys to backend
            updateDebugLog('🔄 Step 9: Uploading encrypted keys to server...');
            const publicKeyBase64 = await cryptoHelper.exportPublicKey();
            
            const response = await fetch(`${BACKEND_URL}/api/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.session.access_token}`,
                },
                body: JSON.stringify({
                    rsa_public_key: publicKeyBase64,
                    encrypted_master_key: encryptedMasterKey,
                    encrypted_rsa_private_key: encryptedRSAPrivateKey
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to upload keys: ${errorData.error || response.statusText}`);
            }

            updateDebugLog('✅ Step 9: All encrypted keys uploaded!');
            
            // Generate recovery key
            updateDebugLog('🔄 Step 10: Generating account recovery key...');
            const recoveryKey = await cryptoHelper.generateRecoveryKey(masterKey);
            updateDebugLog('✅ Step 10: Recovery key generated!');
            
            // Show recovery key to user
            showRecoveryKey(recoveryKey, email);
            
            updateDebugLog('🎉 Zero-Knowledge setup complete!');
            updateDebugLog('📝 What the server sees:');
            updateDebugLog('  - Encrypted master key (cannot decrypt without your password)');
            updateDebugLog('  - Encrypted RSA private key (double encrypted)');
            updateDebugLog('  - RSA public key (safe to share)');
            updateDebugLog('🔒 Your password NEVER leaves this device unencrypted!');
            updateDebugLog('💾 SAVE YOUR RECOVERY KEY - You cannot reset your password without it!');
            
            showAlert('success', 'Account created! IMPORTANT: Save your recovery key before continuing.');
            
            await initializeChat();
        }
    } catch (error) {
        console.error('Signup error:', error);
        showAlert('error', error.message);
        updateDebugLog(`❌ Error: ${error.message}`);
    }
}

/**
 * Handle login
 */
async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAlert('error', 'Please fill in all fields');
        return;
    }

    try {
        updateDebugLog('🔄 Step 1: Checking for master key on device...');
        
        // Try to load master key from IndexedDB (fast path)
        let masterKey = await cryptoHelper.loadMasterKeyFromIndexedDB();
        
        if (masterKey) {
            updateDebugLog('✅ Step 1: Master key found on device! (Fast login)');
        } else {
            updateDebugLog('⚠️ Step 1: Master key not on device (first login on this device)');
        }

        updateDebugLog('🔄 Step 2: Deriving auth password...');
        
        // Derive auth password for Supabase login
        const authPassword = await cryptoHelper.deriveAuthPassword(password, email);
        updateDebugLog('✅ Step 2: Auth password derived!');

        updateDebugLog('🔄 Step 3: Logging into Supabase...');
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password: authPassword,
        });

        if (error) throw error;

        currentUser = data.user;
        updateDebugLog('✅ Step 3: Logged in!');
        
        if (!masterKey) {
            updateDebugLog('🔄 Step 4: Downloading encrypted master key from server...');
            
            // Download encrypted keys from server
            const response = await fetch(`${BACKEND_URL}/api/keys/${data.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${data.session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch encrypted keys from server');
            }

            const keys = await response.json();
            updateDebugLog('✅ Step 4: Encrypted keys downloaded!');

            updateDebugLog('🔄 Step 5: Decrypting master key with password...');
            
            // Decrypt master key with password
            masterKey = await cryptoHelper.decryptMasterKeyWithPassword(keys.encrypted_master_key, password);
            updateDebugLog('✅ Step 5: Master key decrypted!');

            updateDebugLog('🔄 Step 6: Storing master key on device for next time...');
            
            // Store on device for next login
            await cryptoHelper.storeMasterKeyInIndexedDB(masterKey);
            updateDebugLog('✅ Step 6: Master key stored! (Login will be faster next time)');

            updateDebugLog('🔄 Step 7: Decrypting RSA private key...');
            
            // Decrypt RSA private key with master key
            try {
                cryptoHelper.privateKey = await cryptoHelper.decryptRSAPrivateKey(keys.encrypted_rsa_private_key, masterKey);
                updateDebugLog('✅ Step 7: RSA private key decrypted! (Double decryption)');

                // Import public key
                cryptoHelper.publicKey = await cryptoHelper.importPublicKey(keys.rsa_public_key);
                updateDebugLog('✅ RSA public key loaded!');
            } catch (decryptError) {
                updateDebugLog('❌ Master key mismatch - wrong password or corrupted account');
                throw new Error('Wrong password or corrupted account. Please verify your password or sign up again.');
            }
        } else {
            updateDebugLog('🔄 Step 4: Loading RSA keys from server...');
            
            // We have master key, just need to download and decrypt RSA keys
            const response = await fetch(`${BACKEND_URL}/api/keys/${data.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${data.session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch encrypted RSA keys from server');
            }

            const keys = await response.json();
            updateDebugLog('✅ Step 4: RSA keys downloaded!');

            updateDebugLog('🔄 Step 5: Decrypting RSA private key with cached master key...');
            
            try {
                // Decrypt RSA private key with cached master key
                cryptoHelper.privateKey = await cryptoHelper.decryptRSAPrivateKey(keys.encrypted_rsa_private_key, masterKey);
                updateDebugLog('✅ Step 5: RSA private key decrypted!');

                // Import public key
                cryptoHelper.publicKey = await cryptoHelper.importPublicKey(keys.rsa_public_key);
                updateDebugLog('✅ RSA public key loaded!');
            } catch (decryptError) {
                updateDebugLog('⚠️ Cached master key is invalid (wrong account or corrupted)');
                updateDebugLog('🔄 Clearing bad cached key and re-decrypting from server...');
                
                // Clear the wrong master key
                await cryptoHelper.clearMasterKeyFromIndexedDB();
                
                // Decrypt master key from server using password
                updateDebugLog('🔄 Decrypting master key with password...');
                masterKey = await cryptoHelper.decryptMasterKeyWithPassword(keys.encrypted_master_key, password);
                updateDebugLog('✅ Master key decrypted from server!');
                
                // Store the correct master key
                await cryptoHelper.storeMasterKeyInIndexedDB(masterKey);
                updateDebugLog('✅ Correct master key cached!');
                
                // Now decrypt RSA private key with correct master key
                cryptoHelper.privateKey = await cryptoHelper.decryptRSAPrivateKey(keys.encrypted_rsa_private_key, masterKey);
                updateDebugLog('✅ RSA private key decrypted!');
                
                // Import public key
                cryptoHelper.publicKey = await cryptoHelper.importPublicKey(keys.rsa_public_key);
                updateDebugLog('✅ RSA public key loaded!');
            }
        }
        
        updateDebugLog('🎉 Login complete! All encryption keys ready.');
        showAlert('success', 'Login successful! Loading your chats...');

        await initializeChat();
    } catch (error) {
        console.error('Login error:', error);
        showAlert('error', error.message);
        updateDebugLog(`❌ Error: ${error.message}`);
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    if (socket) {
        socket.disconnect();
    }

    await supabaseClient.auth.signOut();
    cryptoHelper.clearKeys();

    currentUser = null;
    socket = null;
    currentChatId = null;
    currentRecipientId = null;

    chatSection.style.display = 'none';
    authSection.style.display = 'block';

    showAlert('info', 'Logged out successfully');
    updateDebugLog('👋 Logged out');
}

/**
 * Initialize chat interface
 */
async function initializeChat() {
    try {
        // Get current session
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            showAlert('error', 'No active session');
            return;
        }

        // Connect to Socket.IO
        socket = io(BACKEND_URL, {
            auth: {
                token: session.access_token,
            },
        });

        socket.on('connect', () => {
            console.log('✅ Connected to Socket.IO server');
            updateChatDebugLog('🟢 Connected to real-time server');
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Socket.IO server');
            updateChatDebugLog('🔴 Disconnected from server');
        });

        // Listen for chat key received
        socket.on('chat:key:received', async (data) => {
            console.log('🔑 Received encrypted chat key:', data);
            updateChatDebugLog(`🔑 Received chat key from ${data.from}`);
            
            try {
                await cryptoHelper.decryptChatKey(data.encrypted_chat_key, data.chatId);
                updateChatDebugLog(`✅ Chat key decrypted for chat ${data.chatId}`);
                showAlert('success', 'Chat key received! You can now send messages.');
            } catch (error) {
                console.error('Failed to decrypt chat key:', error);
                updateChatDebugLog(`❌ Failed to decrypt chat key: ${error.message}`);
            }
        });

        // Listen for messages
        socket.on('message:receive', async (data) => {
            console.log('📨 Message received:', data);
            
            // Don't display if it's our own message (already displayed locally)
            if (data.sender_id === currentUser.id) {
                console.log('⏭️ Skipping own message');
                return;
            }
            
            await displayReceivedMessage(data);
        });

        // Show chat UI
        authSection.style.display = 'none';
        chatSection.style.display = 'block';
        
        document.getElementById('currentUser').textContent = currentUser.email;

        // Load test users
        await loadTestUsers();
        
    } catch (error) {
        console.error('Chat init error:', error);
        showAlert('error', 'Failed to initialize chat');
    }
}

/**
 * Handle starting a new chat
 */
async function handleStartChat() {
    const recipientId = document.getElementById('recipientUserId').value.trim();
    
    if (!recipientId) {
        showAlert('error', 'Please enter a recipient user ID');
        return;
    }

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(recipientId)) {
        showAlert('error', 'Invalid user ID format. Should be a UUID like: 12345678-1234-1234-1234-123456789012');
        return;
    }

    try {
        updateChatDebugLog('🔄 Creating chat with user...');
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        const response = await fetch(`${BACKEND_URL}/api/chats/direct/${recipientId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create chat');
        }

        const { chat } = await response.json();
        currentChatId = chat.id;
        currentRecipientId = recipientId;

        updateChatDebugLog(`✅ Chat created! ID: ${chat.id}`);
        
        // Check if we already have the chat key (existing chat)
        let chatKey = await cryptoHelper.loadChatKey(currentChatId);
        
        if (!chatKey) {
            updateChatDebugLog('🔄 No chat key found locally, checking server...');
            
            // Try to fetch from server first (in case it's an existing chat)
            const keysResponse = await fetch(`${BACKEND_URL}/api/chats/${currentChatId}/keys`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });
            
            if (keysResponse.ok) {
                const { chat_keys } = await keysResponse.json();
                updateChatDebugLog(`📥 Server has ${chat_keys.length} chat keys for this chat`);
                
                const ourKey = chat_keys.find(key => key.recipient_id === currentUser.id);
                
                if (ourKey) {
                    updateChatDebugLog('✅ Found existing chat key on server, decrypting...');
                    try {
                        chatKey = await cryptoHelper.decryptChatKey(ourKey.encrypted_chat_key, currentChatId);
                        if (chatKey) {
                            updateChatDebugLog('✅ Chat key decrypted from server!');
                        } else {
                            updateChatDebugLog('❌ Chat key decryption returned null');
                        }
                    } catch (decryptError) {
                        updateChatDebugLog(`❌ Failed to decrypt chat key: ${decryptError.message}`);
                        console.error('Chat key decryption error:', decryptError);
                    }
                } else {
                    updateChatDebugLog(`⚠️ No chat key found for user ${currentUser.id} on server`);
                }
            } else {
                updateChatDebugLog(`⚠️ Failed to fetch chat keys from server: ${keysResponse.status}`);
            }
            
            // If still no key, generate new one (new chat)
            if (!chatKey) {
                updateChatDebugLog('🔄 Generating new chat encryption key...');
                chatKey = await cryptoHelper.generateChatKey(currentChatId);

                // Step 1: Encrypt and save key for CURRENT user
                updateChatDebugLog('🔐 Encrypting chat key for yourself...');
                const myPublicKey = await cryptoHelper.exportPublicKey();
                const importedMyPublicKey = await cryptoHelper.importPublicKey(myPublicKey);
                const myEncryptedChatKey = await cryptoHelper.encryptChatKey(chatKey, importedMyPublicKey);
                
                await fetch(`${BACKEND_URL}/api/chats/${currentChatId}/share-key`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        recipient_id: currentUser.id,
                        encrypted_chat_key: myEncryptedChatKey,
                    }),
                });
                updateChatDebugLog('✅ Chat key saved for yourself');

                // Step 2: Encrypt and save key for RECIPIENT
                updateChatDebugLog('🔐 Encrypting chat key for recipient...');
                const pubKeyResponse = await fetch(`${BACKEND_URL}/api/users/${recipientId}/public-key`, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                });

                if (!pubKeyResponse.ok) {
                    throw new Error('Recipient public key not found');
                }

                const { public_key } = await pubKeyResponse.json();
                const recipientPublicKey = await cryptoHelper.importPublicKey(public_key);
                const recipientEncryptedChatKey = await cryptoHelper.encryptChatKey(chatKey, recipientPublicKey);

                await fetch(`${BACKEND_URL}/api/chats/${currentChatId}/share-key`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        recipient_id: recipientId,
                        encrypted_chat_key: recipientEncryptedChatKey,
                    }),
                });

                updateChatDebugLog('✅ Chat key shared with recipient! You can now send encrypted messages.');
            } else {
                updateChatDebugLog('✅ Using existing chat key!');
            }
        } else {
            updateChatDebugLog('✅ Chat key loaded from local storage!');
        }

        showAlert('success', 'Chat ready! You can now send messages.');

        // Load message history
        await loadMessageHistory(currentChatId);

        // Clear input
        document.getElementById('recipientUserId').value = '';

    } catch (error) {
        console.error('Start chat error:', error);
        updateChatDebugLog(`❌ Error: ${error.message}`);
        showAlert('error', error.message);
    }
}

/**
 * Load message history for a chat
 */
async function loadMessageHistory(chatId, retryAttempt = 0) {
    try {
        // Prevent infinite recursion
        if (retryAttempt > 1) {
            updateChatDebugLog('⚠️ Already retried once. Old messages encrypted with different key.');
            updateChatDebugLog('💡 These messages cannot be recovered. Start a new conversation.');
            return;
        }
        
        updateChatDebugLog(`📜 Loading message history...${retryAttempt > 0 ? ' (retry attempt ' + retryAttempt + ')' : ''}`);
        
        // Clear existing messages
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = '';
        
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        // First, ensure we have the chat key
        if (!await cryptoHelper.loadChatKey(chatId)) {
            updateChatDebugLog(`🔑 No chat key found locally, fetching from server...`);
            
            // Fetch chat keys from server
            const keysResponse = await fetch(`${BACKEND_URL}/api/chats/${chatId}/keys`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });
            
            if (keysResponse.ok) {
                const { chat_keys } = await keysResponse.json();
                
                // Find our chat key (where we are the recipient)
                const ourKey = chat_keys.find(key => key.recipient_id === currentUser.id);
                if (ourKey) {
                    await cryptoHelper.decryptChatKey(ourKey.encrypted_chat_key, chatId);
                    updateChatDebugLog(`✅ Chat key downloaded and decrypted`);
                } else {
                    updateChatDebugLog(`⚠️ No chat key found for this user`);
                }
            }
        }
        
        const response = await fetch(`${BACKEND_URL}/api/chats/${chatId}/messages?limit=50`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to load message history');
        }

        const { messages } = await response.json();
        updateChatDebugLog(`📜 Loaded ${messages.length} messages`);

        // Decrypt and display each message
        let decryptedCount = 0;
        let failedCount = 0;
        let firstDecryptFailed = false;
        
        for (const message of messages) {
            try {
                const plaintext = await cryptoHelper.decryptMessage(
                    message.encrypted_content,
                    message.metadata?.iv || '',
                    chatId
                );

                // Display based on sender
                const messageDiv = document.createElement('div');
                const isSent = message.sender_id === currentUser.id;
                messageDiv.className = isSent ? 'message message-sent' : 'message message-received';
                messageDiv.innerHTML = `
                    <div>${plaintext}</div>
                    <div class="message-encrypted">Encrypted: ${message.encrypted_content.substring(0, 40)}...</div>
                    <div class="message-time">${new Date(message.created_at).toLocaleTimeString()}</div>
                `;
                messagesDiv.appendChild(messageDiv);
                decryptedCount++;
            } catch (error) {
                console.error('Failed to decrypt message:', error);
                failedCount++;
                
                // If first message fails, likely wrong cached key - fetch from server
                if (!firstDecryptFailed && messages.length > 0) {
                    firstDecryptFailed = true;
                    updateChatDebugLog('⚠️ Decryption failed - wrong cached key detected!');
                    updateChatDebugLog('🔄 Clearing bad key and fetching correct one from server...');
                    
                    // Clear the bad key from localStorage
                    localStorage.removeItem(`chatKeys_${chatId}`);
                    updateChatDebugLog('✅ Cleared bad key from localStorage');
                    
                    try {
                        // Fetch correct key from server
                        updateChatDebugLog(`🌐 Fetching keys from: ${BACKEND_URL}/api/chats/${chatId}/keys`);
                        const keysResponse = await fetch(`${BACKEND_URL}/api/chats/${chatId}/keys`, {
                            headers: {
                                'Authorization': `Bearer ${session.access_token}`,
                            },
                        });
                        
                        updateChatDebugLog(`📡 Server response status: ${keysResponse.status}`);
                        
                        if (keysResponse.ok) {
                            const { chat_keys } = await keysResponse.json();
                            updateChatDebugLog(`📥 Server has ${chat_keys.length} chat keys for this chat`);
                            
                            if (chat_keys.length > 0) {
                                updateChatDebugLog(`🔍 Looking for key for user ID: ${currentUser.id}`);
                                chat_keys.forEach((key, idx) => {
                                    updateChatDebugLog(`   Key ${idx + 1}: recipient_id = ${key.recipient_id}`);
                                });
                            }
                            
                            const ourKey = chat_keys.find(key => key.recipient_id === currentUser.id);
                            
                            if (ourKey) {
                                updateChatDebugLog('✅ Found correct key on server, decrypting...');
                                try {
                                    const correctKey = await cryptoHelper.decryptChatKey(ourKey.encrypted_chat_key, chatId);
                                    
                                    if (correctKey) {
                                        updateChatDebugLog('✅ Correct key loaded! Reloading messages...');
                                        // Recursive call to reload with correct key (with retry counter)
                                        return await loadMessageHistory(chatId, retryAttempt + 1);
                                    } else {
                                        updateChatDebugLog('❌ Key decryption returned null');
                                    }
                                } catch (decryptErr) {
                                    updateChatDebugLog(`❌ Key decryption error: ${decryptErr.message}`);
                                    console.error('Chat key decryption error:', decryptErr);
                                }
                            } else {
                                updateChatDebugLog(`❌ No key found for user ${currentUser.id} on server`);
                            }
                        } else {
                            const errorText = await keysResponse.text();
                            updateChatDebugLog(`❌ Server fetch failed: ${keysResponse.status} - ${errorText}`);
                        }
                    } catch (fetchError) {
                        updateChatDebugLog(`❌ Fetch error: ${fetchError.message}`);
                        console.error('Server fetch error:', fetchError);
                    }
                    
                    updateChatDebugLog('❌ Could not fetch correct key from server');
                }
                
                // Show placeholder for undecryptable message
                const messageDiv = document.createElement('div');
                messageDiv.style.cssText = 'padding: 10px; margin: 10px 0; background: #f5f5f5; border-radius: 8px; color: #999; font-style: italic; text-align: center;';
                messageDiv.innerHTML = `
                    🔒 Message encrypted with old keys (cannot decrypt)<br>
                    <small>${new Date(message.created_at).toLocaleString()}</small>
                `;
                messagesDiv.appendChild(messageDiv);
            }
        }
        
        if (failedCount > 0) {
            updateChatDebugLog(`⚠️ ${failedCount} old messages couldn't be decrypted (keys were regenerated)`);
        }
        updateChatDebugLog(`✅ Loaded ${decryptedCount} messages successfully`);

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
    } catch (error) {
        console.error('Failed to load message history:', error);
        updateChatDebugLog(`❌ Error loading history: ${error.message}`);
    }
}

/**
 * Load test users
 */
async function loadTestUsers() {
    const userList = document.getElementById('userList');
    userList.innerHTML = '<div class="loader"></div>';

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        // In production, you'd fetch users from your backend
        // For testing, create a simple demo user
        userList.innerHTML = `
            <div class="user-item" onclick="startDemoChat()">
                <div>
                    <strong>Test User</strong>
                    <div style="font-size: 12px; color: #666;">Click to start encrypted chat</div>
                </div>
                <span>💬</span>
            </div>
            <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 8px; font-size: 12px;">
                <strong>🧪 Testing Instructions:</strong><br>
                1. Open this page in another browser/incognito window<br>
                2. Sign up with a different email<br>
                3. Both users will appear here<br>
                4. Click to start encrypted chat!
            </div>
        `;
    } catch (error) {
        console.error('Failed to load users:', error);
        userList.innerHTML = '<div style="color: red;">Failed to load users</div>';
    }
}

/**
 * Start demo chat (for testing)
 */
async function startDemoChat() {
    try {
        // For demo purposes, use a test chat ID
        currentChatId = 'demo-chat-123';
        currentRecipientId = 'demo-user';

        // Generate and store a chat key
        await cryptoHelper.generateChatKey(currentChatId);
        
        updateChatDebugLog(`✅ Started demo chat (ID: ${currentChatId})`);
        updateChatDebugLog('✅ Chat key generated locally');
        
        showAlert('success', 'Demo chat started! You can send encrypted messages.');
        
        document.getElementById('messages').innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <p>🔐 End-to-end encrypted chat</p>
                <p style="font-size: 12px;">Messages are encrypted on your device before sending</p>
            </div>
        `;
    } catch (error) {
        console.error('Failed to start chat:', error);
        showAlert('error', 'Failed to start chat');
    }
}

/**
 * Send encrypted message
 */
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message || !currentChatId) {
        return;
    }

    try {
        updateChatDebugLog(`🔄 Encrypting: "${message}"`);
        
        // Encrypt message
        const { encrypted, iv } = await cryptoHelper.encryptMessage(message, currentChatId);
        
        updateChatDebugLog(`✅ Encrypted: ${encrypted.substring(0, 30)}...`);
        updateChatDebugLog(`📤 Sending encrypted blob to server...`);

        // Display locally (encrypted)
        displaySentMessage(message, encrypted);

        // Send via socket (server receives only encrypted blob!)
        socket.emit('message:send', {
            chatId: currentChatId,
            encryptedContent: encrypted,
            iv: iv,  // Include IV for decryption
            messageType: 'text',
        });

        updateChatDebugLog(`✅ Encrypted message sent!`);
        updateChatDebugLog(`⚠️ Server sees: ${encrypted.substring(0, 40)}... (gibberish!)`);

        input.value = '';
    } catch (error) {
        console.error('Failed to send message:', error);
        showAlert('error', 'Failed to send message');
        updateChatDebugLog(`❌ Error: ${error.message}`);
    }
}

/**
 * Display sent message
 */
function displaySentMessage(plaintext, encrypted) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-sent';
    messageDiv.innerHTML = `
        <div>${plaintext}</div>
        <div class="message-encrypted">Encrypted: ${encrypted.substring(0, 40)}...</div>
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/**
 * Display received message
 */
async function displayReceivedMessage(data) {
    try {
        updateChatDebugLog(`📥 Received encrypted blob: ${data.encrypted_content.substring(0, 40)}...`);
        
        // Check if we have the chat key for this chat
        const chatId = data.chat_id;
        
        // Set currentChatId if not set (receiver side)
        if (!currentChatId) {
            currentChatId = chatId;
            updateChatDebugLog(`✅ Chat opened: ${chatId}`);
        }
        
        if (!cryptoHelper.chatKeys.has(chatId)) {
            updateChatDebugLog(`🔑 No chat key found, fetching from server...`);
            
            // Fetch encrypted chat key from server
            const { data: { session } } = await supabaseClient.auth.getSession();
            
            if (!session) {
                throw new Error('Not authenticated - please login again');
            }
            
            updateChatDebugLog(`🔄 Fetching from: ${BACKEND_URL}/api/chats/${chatId}/my-key`);
            const response = await fetch(`${BACKEND_URL}/api/chats/${chatId}/my-key`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            updateChatDebugLog(`📡 Server response: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                updateChatDebugLog(`❌ Server error: ${response.status} - ${errorText}`);
                throw new Error(`Chat key fetch failed: ${response.status} ${errorText}`);
            }

            const { encrypted_chat_key } = await response.json();
            
            if (!encrypted_chat_key) {
                throw new Error('No chat key returned from server');
            }
            
            updateChatDebugLog(`📥 Encrypted key received (${encrypted_chat_key.length} chars)`);
            
            // Decrypt the chat key with our private key
            updateChatDebugLog(`🔓 Decrypting chat key with private key...`);
            await cryptoHelper.decryptChatKey(encrypted_chat_key, chatId);
            updateChatDebugLog(`✅ Chat key decrypted and stored!`);
        }
        
        updateChatDebugLog(`🔄 Decrypting message...`);
        
        const plaintext = await cryptoHelper.decryptMessage(
            data.encrypted_content,
            data.iv,  // Use the actual IV from the message
            chatId
        );

        updateChatDebugLog(`✅ Decrypted: "${plaintext}"`);

        const messagesDiv = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-received';
        messageDiv.innerHTML = `
            <div>${plaintext}</div>
            <div class="message-encrypted">Encrypted: ${data.encrypted_content.substring(0, 40)}...</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (error) {
        console.error('Failed to decrypt message:', error);
        updateChatDebugLog(`❌ Decryption failed: ${error.message}`);
        
        // Show error in chat
        const messagesDiv = document.getElementById('messages');
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'padding: 15px; background: #fee; border: 1px solid #fcc; border-radius: 8px; margin: 10px 0; color: #c33;';
        errorDiv.innerHTML = `
            <strong>⚠️ Cannot decrypt message</strong><br>
            <small>${error.message}</small>
        `;
        messagesDiv.appendChild(errorDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

/**
 * Show recovery key modal
 */
function showRecoveryKey(recoveryKey, email) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    
    modal.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 20px; max-width: 600px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <h2 style="margin: 0 0 20px 0; color: #667eea;">🔑 Account Recovery Key</h2>
            <p style="margin: 0 0 20px 0; color: #666;">
                <strong>IMPORTANT:</strong> Save this recovery key in a safe place. You'll need it if you forget your password.
            </p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; font-family: monospace; font-size: 14px; word-break: break-all; border: 2px dashed #667eea;">
                ${recoveryKey}
            </div>
            <p style="margin: 20px 0; color: #999; font-size: 14px;">
                Account: <strong>${email}</strong>
            </p>
            <div style="display: flex; gap: 10px;">
                <button onclick="copyRecoveryKey('${recoveryKey}')" style="flex: 1; padding: 15px; background: #667eea; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold;">
                    📋 Copy to Clipboard
                </button>
                <button onclick="downloadRecoveryKey('${recoveryKey}', '${email}')" style="flex: 1; padding: 15px; background: #764ba2; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold;">
                    💾 Download as File
                </button>
            </div>
            <button onclick="closeRecoveryModal()" style="width: 100%; margin-top: 10px; padding: 15px; background: #28a745; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold;">
                ✅ I've Saved My Recovery Key
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.recoveryModal = modal;
}

/**
 * Copy recovery key to clipboard
 */
window.copyRecoveryKey = function(key) {
    navigator.clipboard.writeText(key);
    showAlert('success', 'Recovery key copied to clipboard!');
}

/**
 * Download recovery key as file
 */
window.downloadRecoveryKey = function(key, email) {
    const content = `ACCOUNT RECOVERY KEY
====================================
Account: ${email}
Generated: ${new Date().toLocaleString()}

Recovery Key:
${key}

IMPORTANT: Keep this key safe and secure!
- You need this key if you forget your password
- Anyone with this key can access your account
- Store it in a password manager or safe location

====================================`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-key-${email}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert('success', 'Recovery key downloaded!');
}

/**
 * Close recovery key modal
 */
window.closeRecoveryModal = function() {
    if (window.recoveryModal) {
        window.recoveryModal.remove();
        window.recoveryModal = null;
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    await supabaseClient.auth.signOut();
    
    if (socket) {
        socket.disconnect();
    }

    cryptoHelper.clearKeys();
    currentUser = null;
    currentChatId = null;

    chatSection.style.display = 'none';
    authSection.style.display = 'block';

    showAlert('info', 'Logged out successfully');
    updateDebugLog('Logged out. Keys cleared.');
}

/**
 * Show alert message
 */
function showAlert(type, message) {
    alertContainer.innerHTML = `
        <div class="alert alert-${type}">
            ${message}
        </div>
    `;

    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

/**
 * Update debug log
 */
function updateDebugLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    debugLog.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    debugLog.scrollTop = debugLog.scrollHeight;
}

/**
 * Update chat debug log
 */
function updateChatDebugLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    chatDebugLog.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    chatDebugLog.scrollTop = chatDebugLog.scrollHeight;
}
