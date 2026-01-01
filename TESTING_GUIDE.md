# 🧪 Two-User Testing Guide

## Setup

You'll need **2 browser windows** to test the chat between two users.

### Method 1: Two Different Browsers
- **Browser 1**: Chrome (normal mode)
- **Browser 2**: Firefox or Edge

### Method 2: Incognito/Private Windows
- **Window 1**: Chrome normal mode
- **Window 2**: Chrome incognito mode (Ctrl+Shift+N)

---

## Step-by-Step Testing

### 1. Start Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Should show: `Server running on port 3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npx http-server -p 5173 -c-1 --cors
```
Should show: `Available on: http://127.0.0.1:5173`

---

### 2. Create User 1 (Alice)

1. Open **Browser 1** → http://127.0.0.1:5173
2. Enter credentials:
   - Email: `alice@test.com`
   - Password: `password123`
3. Click **Sign Up**
4. Watch the debug panel - you should see:
   ```
   ✅ Step 1: Account created!
   ✅ Step 2: Profile created!
   ✅ Step 3: Keys generated!
   ✅ Step 4: Public key uploaded!
   🎉 Zero-Knowledge setup complete!
   ```
5. **Keep this window open** - Alice is now logged in

---

### 3. Create User 2 (Bob)

1. Open **Browser 2** (different browser or incognito) → http://127.0.0.1:5173
2. Enter credentials:
   - Email: `bob@test.com`
   - Password: `password123`
3. Click **Sign Up**
4. Watch the same debug panel steps complete
5. **Keep this window open** - Bob is now logged in

---

### 4. Start a Chat (From Alice's Browser)

Currently, you need to use the browser console to start a chat:

1. In **Alice's browser** (Browser 1), press **F12** to open DevTools
2. Go to the **Console** tab
3. Get Bob's user ID from the database or use this method:
   - In **Bob's browser**, open DevTools console
   - Type: `currentUser.id` and press Enter
   - **Copy the user ID** (looks like: `dd28c10d-a31f-420a-aca1-6bb342ff83e4`)
4. Back in **Alice's console**, create a chat:
   ```javascript
   // Replace BOB_USER_ID with the actual ID you copied
   fetch('http://localhost:3000/api/chats/direct/BOB_USER_ID', {
       method: 'POST',
       headers: {
           'Authorization': 'Bearer ' + (await supabaseClient.auth.getSession()).data.session.access_token
       }
   }).then(r => r.json()).then(console.log)
   ```

---

### 5. Send Encrypted Messages

Once the chat is created, you can test messaging:

1. In **Alice's browser**:
   - Type a message in the input box
   - Click **Send**
   - Watch the **Encryption Debug Panel** showing the encryption process

2. In **Bob's browser**:
   - The message should appear automatically
   - Watch the **Encryption Debug Panel** showing decryption

3. Try from **Bob's side**:
   - Type and send a message
   - Alice should receive it in real-time

---

## What to Observe

### ✅ Zero-Knowledge Encryption Flow

**Alice sends "Hello Bob":**

1. **Alice's Debug Panel:**
   ```
   🔐 Encrypting message with AES-GCM...
   📤 Sending encrypted message to server...
   ✅ Message sent!
   ```

2. **Server Logs (Terminal 1):**
   ```
   [info]: Message received: {encrypted blob of gibberish}
   ```
   ⚠️ **Server NEVER sees plaintext!**

3. **Bob's Debug Panel:**
   ```
   📨 Received encrypted message
   🔓 Decrypting with AES-GCM...
   ✅ Message decrypted: "Hello Bob"
   ```

---

## Troubleshooting

### Issue: "Failed to create chat"
- Make sure both users are signed up and logged in
- Verify the user ID is correct (UUID format)
- Check backend logs for errors

### Issue: "Messages not appearing"
- Check that Socket.IO is connected (should show in console)
- Verify both users are in the same chat
- Check browser console for errors

### Issue: "Decryption failed"
- Make sure chat keys are shared between users
- Check that both users have their RSA keys loaded
- Verify the encryption/decryption flow in debug panel

### Issue: "Public key not found"
- User might not have completed signup properly
- Check database `user_keys` table
- Re-signup the user

---

## Database Inspection (Optional)

To verify zero-knowledge encryption:

1. Go to Supabase Dashboard → SQL Editor
2. Run:
   ```sql
   -- See all messages (should be encrypted!)
   SELECT content, created_at FROM messages ORDER BY created_at DESC LIMIT 5;
   
   -- See user keys (public keys only)
   SELECT user_id, LEFT(public_key, 50) FROM user_keys;
   
   -- See chat keys (encrypted with recipient's public key)
   SELECT chat_id, user_id, LEFT(encrypted_key, 50) FROM chat_keys;
   ```

3. **Verify:** Message content should be base64 gibberish, NOT readable text!

---

## Quick Test Script

For automated testing, use this in Alice's browser console:

```javascript
// Send 5 test messages
for(let i = 1; i <= 5; i++) {
    setTimeout(() => {
        document.getElementById('messageInput').value = `Test message ${i}`;
        document.getElementById('sendBtn').click();
    }, i * 1000);
}
```

---

## Success Criteria ✅

- [ ] Both users can sign up and generate keys
- [ ] Chat can be created between two users
- [ ] Messages send in real-time
- [ ] Debug panel shows encryption/decryption
- [ ] Server logs show encrypted content only
- [ ] Database shows encrypted messages
- [ ] Both users can read each other's messages

---

## Next Steps

After basic testing works:
1. Add UI for creating chats (user search + click to chat)
2. Add chat list sidebar
3. Add typing indicators
4. Add read receipts
5. Add file encryption/sharing

**For now, use the browser console method to create chats!**
