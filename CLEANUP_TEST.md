# Manual Cleanup for Testing

If you're having issues with old chat keys, run these SQL commands in Supabase SQL Editor:

## Option 1: Delete ALL chat keys (fresh start)

```sql
DELETE FROM chat_keys;
DELETE FROM messages;
DELETE FROM chats;
```

## Option 2: Delete chat keys for specific user

```sql
-- Replace 'USER_ID_HERE' with actual user ID
DELETE FROM chat_keys WHERE recipient_id = 'USER_ID_HERE';
DELETE FROM chat_keys WHERE sender_id = 'USER_ID_HERE';
```

## Option 3: View current chat keys

```sql
SELECT 
  ck.*,
  up.email as recipient_email
FROM chat_keys ck
JOIN auth.users up ON up.id = ck.recipient_id
ORDER BY ck.created_at DESC;
```

## After Cleanup

1. Hard refresh both browsers (Ctrl+Shift+R)
2. Log in (keys will auto-regenerate)
3. Create fresh chat
4. Test messaging

---

**Note**: The system now uses `UPSERT` for chat keys, so duplicate key errors should be prevented automatically!
