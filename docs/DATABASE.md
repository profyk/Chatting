# Ditsala — Database (MongoDB)

All documents use UUID string `id`. Timestamps are ISO8601 UTC strings. Soft deletion via `deleted_at`.

## Collections
- **users**: id, email(uniq), password_hash, display_name, username(uniq), bio, avatar_url,
  preferred_language, is_online, last_seen, is_vip, vip_since, privacy{}, push_settings{}, status, created_at, deleted_at
- **conversations**: id, type(direct|group), name, image_url, description, members[], admins[],
  created_by, last_message{}, pinned_message_ids[], member_settings{uid:{muted,cleared_at}}, updated_at, deleted_at
- **messages**: id, conversation_id, sender_id, type(text|image|video|voice|file|contact|system|deleted),
  text, attachment{url,name,size,mime,duration,width,height,thumbnail_url}, reply_to, is_forwarded,
  reactions[{user_id,emoji}], read_by[], is_edited, is_pinned, created_at, deleted_at
- **contacts**: id, owner_id, contact_id, created_at, deleted_at
- **blocked_users**: id, blocker_id, blocked_id, created_at
- **reports**: id, reporter_id, target_type, target_id, reason, details, status, created_at
- **calls**: id, conversation_id, caller_id, callee_ids[], type, status, participants[], started_at, answered_at, ended_at, duration
- **attachments**: id, owner_id, path, name, mime, size, created_at
- **vip_usage**: user_id, target_lang, chars, created_at (metering — no message content stored)

Logical tables from the spec (message_reactions, message_reads, group_members, conversation_members)
are embedded arrays here for read performance; they can be promoted to collections at scale.

## Indexes (created on startup)
- users.email(uniq), users.username(uniq)
- conversations.members, conversations.updated_at desc
- messages.(conversation_id, created_at desc), messages.attachment.url
- contacts.(owner_id, contact_id), blocked_users.(blocker_id, blocked_id)
- calls.(caller_id, created_at desc), attachments.path
