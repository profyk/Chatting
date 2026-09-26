# Ditsala — API (all routes prefixed /api)

## Auth
- POST /auth/register {email,password,display_name,username,preferred_language} → {access_token,user}
- POST /auth/login {email,password} → {access_token,user}
- GET  /auth/me → user
- POST /auth/check-username {username} → {available}

## Users / contacts / safety
- PATCH /users/me {display_name?,bio?,avatar_url?,preferred_language?}
- PATCH /users/me/privacy {profile?,message?,call?,read_receipts?,online_status?,auto_translate?}
- GET  /users/search?q=
- GET  /users/{id}
- GET/POST /contacts · DELETE /contacts/{id}
- GET/POST /block · DELETE /block/{id}
- POST /reports {target_type,target_id,reason,details}

## Conversations / messages
- GET  /conversations
- POST /conversations/direct {user_id}
- POST /conversations/group {name,member_ids[],image_url?,description?}
- GET  /conversations/{id} · PATCH /conversations/{id} (admin) · DELETE /conversations/{id} (clear)
- POST /conversations/{id}/members · DELETE /conversations/{id}/members/{uid} · POST /conversations/{id}/admins/{uid}
- PATCH /conversations/{id}/settings {muted?,cleared?}
- POST /conversations/{id}/read
- GET  /conversations/{id}/messages?before=&limit=
- POST /conversations/{id}/messages {type,text,attachment?,reply_to?,is_forwarded?}
- PATCH /messages/{id} {text} · DELETE /messages/{id}
- POST /messages/{id}/react {emoji} · POST|DELETE /messages/{id}/pin · POST /messages/{id}/forward {conversation_ids[]}

## Media
- POST /upload (multipart file) → {url,mime,size,name}
- GET  /files/{path}?token=  (auth via header or token query)

## Calls / VIP
- POST /calls · PATCH /calls/{id} · GET /calls
- GET /vip/languages · GET /vip/status · POST /vip/subscribe · POST /vip/cancel
- POST /vip/translate {text,target_lang,source_lang?}  (VIP only)

## Realtime
- WS /ws?token=  (see REALTIME.md)
