// Crypto Helper Functions for Zero-Knowledge Encryption

class CryptoHelper {
    constructor() {
        this.privateKey = null;
        this.publicKey = null;
        this.chatKeys = new Map(); // chatId -> AES key
    }

    /**
     * Generate RSA key pair for user
     */
    async generateUserKeys() {
        console.log('🔐 Generating RSA key pair...');
        
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256',
            },
            true,
            ['encrypt', 'decrypt']
        );

        this.privateKey = keyPair.privateKey;
        this.publicKey = keyPair.publicKey;

        // Store private key in localStorage (in production, use IndexedDB)
        const exportedPrivateKey = await crypto.subtle.exportKey('jwk', this.privateKey);
        localStorage.setItem('privateKey', JSON.stringify(exportedPrivateKey));

        console.log('✅ RSA key pair generated!');
        console.log('🔒 Private key stored locally (NEVER uploaded!)');

        return keyPair;
    }

    /**
     * Load private key from localStorage
     */
    async loadPrivateKey() {
        const stored = localStorage.getItem('privateKey');
        if (!stored) return null;

        const keyData = JSON.parse(stored);
        this.privateKey = await crypto.subtle.importKey(
            'jwk',
            keyData,
            {
                name: 'RSA-OAEP',
                hash: 'SHA-256',
            },
            true,
            ['decrypt']
        );

        console.log('✅ Private key loaded from storage');
        return this.privateKey;
    }

    /**
     * Export public key as base64 string
     */
    async exportPublicKey() {
        const exported = await crypto.subtle.exportKey('jwk', this.publicKey);
        return btoa(JSON.stringify(exported));
    }

    /**
     * Import public key from base64 string
     */
    async importPublicKey(base64Key) {
        const keyData = JSON.parse(atob(base64Key));
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            {
                name: 'RSA-OAEP',
                hash: 'SHA-256',
            },
            true,
            ['encrypt']
        );
    }

    /**
     * Generate AES symmetric key for a chat
     */
    async generateChatKey(chatId) {
        console.log(`🔑 Generating AES chat key for chat ${chatId}...`);
        
        const chatKey = await crypto.subtle.generateKey(
            {
                name: 'AES-GCM',
                length: 256,
            },
            true,
            ['encrypt', 'decrypt']
        );

        this.chatKeys.set(chatId, chatKey);

        // Store in localStorage (in production, use IndexedDB)
        const exported = await crypto.subtle.exportKey('raw', chatKey);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
        localStorage.setItem(`chatKey_${chatId}`, base64);

        console.log('✅ Chat key generated and stored locally');
        return chatKey;
    }

    /**
     * Load chat key from storage
     */
    async loadChatKey(chatId) {
        // Check memory first
        if (this.chatKeys.has(chatId)) {
            return this.chatKeys.get(chatId);
        }

        // Load from storage
        const stored = localStorage.getItem(`chatKey_${chatId}`);
        if (!stored) return null;

        const rawKey = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
        const chatKey = await crypto.subtle.importKey(
            'raw',
            rawKey,
            {
                name: 'AES-GCM',
            },
            true,
            ['encrypt', 'decrypt']
        );

        this.chatKeys.set(chatId, chatKey);
        console.log(`✅ Chat key loaded for chat ${chatId}`);
        return chatKey;
    }

    /**
     * Encrypt chat key with recipient's public key
     */
    async encryptChatKey(chatKey, recipientPublicKey) {
        const exported = await crypto.subtle.exportKey('raw', chatKey);
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'RSA-OAEP',
            },
            recipientPublicKey,
            exported
        );

        return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    }

    /**
     * Decrypt chat key with own private key
     */
    async decryptChatKey(encryptedKeyBase64, chatId) {
        try {
            console.log(`🔐 Attempting to decrypt chat key for chat ${chatId}`);
            console.log(`   Private key available: ${!!this.privateKey}`);
            console.log(`   Encrypted key length: ${encryptedKeyBase64.length} chars`);
            
            const encryptedKey = Uint8Array.from(atob(encryptedKeyBase64), c => c.charCodeAt(0));
            console.log(`   Decoded to ${encryptedKey.length} bytes`);
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'RSA-OAEP',
                },
                this.privateKey,
                encryptedKey
            );
            console.log(`   ✅ RSA decryption successful, ${decrypted.byteLength} bytes`);

            const chatKey = await crypto.subtle.importKey(
                'raw',
                decrypted,
                {
                    name: 'AES-GCM',
                },
                true,
                ['encrypt', 'decrypt']
            );
            console.log(`   ✅ AES key imported successfully`);

            this.chatKeys.set(chatId, chatKey);

            // Store it
            const base64 = btoa(String.fromCharCode(...new Uint8Array(decrypted)));
            localStorage.setItem(`chatKey_${chatId}`, base64);

            console.log(`✅ Chat key decrypted and stored for chat ${chatId}`);
            return chatKey;
        } catch (error) {
            console.error('❌ Chat key decryption failed:', error);
            console.error('   Error type:', error.name);
            console.error('   Error message:', error.message);
            console.error('   Stack:', error.stack);
            throw new Error('Failed to decrypt chat key. This usually happens when your encryption keys were regenerated. Please ask the sender to create a new chat.');
        }
    }

    /**
     * Encrypt a message
     */
    async encryptMessage(message, chatId) {
        const chatKey = await this.loadChatKey(chatId);
        if (!chatKey) {
            throw new Error('No chat key found for this chat');
        }

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedMessage = new TextEncoder().encode(message);

        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv,
            },
            chatKey,
            encodedMessage
        );

        return {
            encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
        };
    }

    /**
     * Decrypt a message
     */
    async decryptMessage(encryptedBase64, ivBase64, chatId) {
        const chatKey = await this.loadChatKey(chatId);
        if (!chatKey) {
            throw new Error('No chat key found for this chat');
        }

        const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
            },
            chatKey,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    }

    /**
     * Clear all keys (logout)
     */
    clearKeys() {
        this.privateKey = null;
        this.publicKey = null;
        this.chatKeys.clear();
        
        // Clear from storage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('chatKey_') || key === 'privateKey') {
                localStorage.removeItem(key);
            }
        });

        console.log('🗑️ All keys cleared');
    }

    // ============ MASTER KEY METHODS ============

    /**
     * Generate master encryption key (random, independent of password)
     */
    async generateMasterKey() {
        const masterKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        return masterKey;
    }

    /**
     * Encrypt master key with password
     */
    async encryptMasterKeyWithPassword(masterKey, password, email) {
        const encoder = new TextEncoder();
        const salt = await crypto.subtle.digest('SHA-256', encoder.encode(email));
        
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const wrappingKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new Uint8Array(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['wrapKey', 'unwrapKey']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const wrapped = await crypto.subtle.wrapKey('raw', masterKey, wrappingKey, { name: 'AES-GCM', iv });

        return {
            wrapped: btoa(String.fromCharCode(...new Uint8Array(wrapped))),
            iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
            salt: btoa(String.fromCharCode(...new Uint8Array(salt)))
        };
    }

    /**
     * Decrypt master key with password
     */
    async decryptMasterKeyWithPassword(encryptedData, password) {
        const encoder = new TextEncoder();
        const salt = Uint8Array.from(atob(encryptedData.salt), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
        const wrapped = Uint8Array.from(atob(encryptedData.wrapped), c => c.charCodeAt(0));

        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const wrappingKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['wrapKey', 'unwrapKey']
        );

        const masterKey = await crypto.subtle.unwrapKey(
            'raw',
            wrapped,
            wrappingKey,
            { name: 'AES-GCM', iv },
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        return masterKey;
    }

    /**
     * Derive auth password from user password
     */
    async deriveAuthPassword(password, email) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + ':auth:' + email);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)));
    }

    /**
     * Store master key in IndexedDB
     */
    async storeMasterKeyInIndexedDB(masterKey) {
        const exported = await crypto.subtle.exportKey('raw', masterKey);
        const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)));
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EncryptionDB', 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const transaction = e.target.transaction;
                
                let store;
                if (!db.objectStoreNames.contains('keys')) {
                    // Create the object store
                    store = db.createObjectStore('keys');
                } else {
                    // Get existing store from the upgrade transaction
                    store = transaction.objectStore('keys');
                }
                
                // Store the key in the upgrade transaction
                store.put(base64Key, 'masterKey');
                console.log('📦 Stored master key during database upgrade');
            };
            
            request.onsuccess = (e) => {
                const db = e.target.result;
                
                // Check if we need to store (database already existed)
                if (db.objectStoreNames.contains('keys')) {
                    // Database existed, use a new transaction to update
                    try {
                        const tx = db.transaction(['keys'], 'readwrite');
                        const store = tx.objectStore('keys');
                        store.put(base64Key, 'masterKey');
                        
                        tx.oncomplete = () => {
                            console.log('✅ Master key updated in IndexedDB');
                            db.close();
                            resolve();
                        };
                        
                        tx.onerror = () => {
                            db.close();
                            reject(tx.error);
                        };
                    } catch (error) {
                        console.error('Transaction error:', error);
                        db.close();
                        reject(error);
                    }
                } else {
                    // Database was just created, already stored in upgrade
                    console.log('✅ Master key stored in IndexedDB');
                    db.close();
                    resolve();
                }
            };
            
            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Load master key from IndexedDB
     */
    async loadMasterKeyFromIndexedDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open('EncryptionDB', 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('keys')) {
                    db.createObjectStore('keys');
                }
            };
            
            request.onsuccess = async (e) => {
                const db = e.target.result;
                
                if (!db.objectStoreNames.contains('keys')) {
                    db.close();
                    resolve(null);
                    return;
                }
                
                try {
                    const tx = db.transaction(['keys'], 'readonly');
                    const store = tx.objectStore('keys');
                    const getReq = store.get('masterKey');
                    
                    getReq.onsuccess = async () => {
                        db.close();
                        if (!getReq.result) {
                            resolve(null);
                            return;
                        }
                        
                        try {
                            const keyData = Uint8Array.from(atob(getReq.result), c => c.charCodeAt(0));
                            const masterKey = await crypto.subtle.importKey(
                                'raw',
                                keyData,
                                { name: 'AES-GCM', length: 256 },
                                true,
                                ['encrypt', 'decrypt']
                            );
                            resolve(masterKey);
                        } catch (error) {
                            console.error('Failed to import master key:', error);
                            resolve(null);
                        }
                    };
                    
                    getReq.onerror = () => {
                        db.close();
                        resolve(null);
                    };
                } catch (error) {
                    db.close();
                    resolve(null);
                }
            };
            
            request.onerror = () => resolve(null);
        });
    }

    /**
     * Clear master key from IndexedDB
     */
    async clearMasterKeyFromIndexedDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open('EncryptionDB', 1);
            
            request.onsuccess = (e) => {
                const db = e.target.result;
                
                if (!db.objectStoreNames.contains('keys')) {
                    db.close();
                    resolve();
                    return;
                }
                
                try {
                    const tx = db.transaction(['keys'], 'readwrite');
                    const store = tx.objectStore('keys');
                    store.delete('masterKey');
                    
                    tx.oncomplete = () => {
                        db.close();
                        console.log('🗑️ Cleared master key from IndexedDB');
                        resolve();
                    };
                    
                    tx.onerror = () => {
                        db.close();
                        resolve();
                    };
                } catch (error) {
                    db.close();
                    resolve();
                }
            };
            
            request.onerror = () => resolve();
        });
    }

    /**
     * Encrypt RSA private key with master key
     */
    async encryptRSAPrivateKey(rsaPrivateKey, masterKey) {
        const exported = await crypto.subtle.exportKey('pkcs8', rsaPrivateKey);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            masterKey,
            exported
        );

        return {
            encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...new Uint8Array(iv)))
        };
    }

    /**
     * Decrypt RSA private key with master key
     */
    async decryptRSAPrivateKey(encryptedData, masterKey) {
        const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
        const encrypted = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            masterKey,
            encrypted
        );

        return await crypto.subtle.importKey(
            'pkcs8',
            decrypted,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['decrypt']
        );
    }

    /**
     * Generate recovery key for account recovery
     */
    async generateRecoveryKey(masterKey) {
        // Export master key
        const exported = await crypto.subtle.exportKey('raw', masterKey);
        
        // Generate random salt
        const salt = crypto.getRandomValues(new Uint8Array(16));
        
        // Combine and encode
        const combined = new Uint8Array(exported.byteLength + salt.byteLength);
        combined.set(new Uint8Array(exported), 0);
        combined.set(salt, exported.byteLength);
        
        // Convert to base32-like format (easier to write down)
        const base64 = btoa(String.fromCharCode(...combined));
        
        // Format as groups of 4 characters
        const formatted = base64.match(/.{1,4}/g).join('-');
        
        return formatted;
    }

    /**
     * Restore master key from recovery key
     */
    async restoreMasterKeyFromRecovery(recoveryKey) {
        try {
            // Remove dashes and decode
            const base64 = recoveryKey.replace(/-/g, '');
            const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            
            // Extract master key (first 32 bytes for AES-256)
            const masterKeyData = combined.slice(0, 32);
            
            // Import as master key
            const masterKey = await crypto.subtle.importKey(
                'raw',
                masterKeyData,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
            
            return masterKey;
        } catch (error) {
            console.error('Failed to restore from recovery key:', error);
            throw new Error('Invalid recovery key');
        }
    }

    /**
     * Clear master key from IndexedDB (for corrupted accounts)
     */
    async clearMasterKey() {
        try {
            const db = await this.openDB();
            const tx = db.transaction('keys', 'readwrite');
            const store = tx.objectStore('keys');
            await store.delete('masterKey');
            console.log('Master key cleared from IndexedDB');
        } catch (error) {
            console.error('Failed to clear master key:', error);
        }
    }
}

// Export for use in app.js
window.CryptoHelper = CryptoHelper;
