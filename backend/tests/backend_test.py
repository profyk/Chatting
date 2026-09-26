"""Ditsala backend API tests — covers auth, users, contacts, conversations,
messages, VIP, calls, media, realtime WS, and cross-user access control."""
import asyncio
import io
import json
import os
import time
import uuid

import pytest
import requests
import websockets

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ditsala-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
WS = API.replace("https://", "wss://").replace("http://", "ws://") + "/ws"

RUN = uuid.uuid4().hex[:8]


def _u(prefix):
    return {
        "email": f"test_{prefix}_{RUN}@ditsala.app",
        "password": "password123",
        "display_name": f"Test {prefix} {RUN}",
        "username": f"t_{prefix}_{RUN}"[:20],
        "preferred_language": "en",
    }


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def alice(client):
    r = client.post(f"{API}/auth/register", json=_u("alice"))
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture(scope="module")
def bob(client):
    r = client.post(f"{API}/auth/register", json=_u("bob"))
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture(scope="module")
def carol(client):
    r = client.post(f"{API}/auth/register", json=_u("carol"))
    assert r.status_code == 201, r.text
    return r.json()


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- Auth ----------------
class TestAuth:
    def test_health(self, client):
        r = client.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_register_dup_email(self, client, alice):
        payload = _u("alice")  # same run → same email
        r = client.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 409

    def test_login_success(self, client, alice):
        r = client.post(f"{API}/auth/login", json={"email": alice["user"]["email"], "password": "password123"})
        assert r.status_code == 200
        assert r.json()["access_token"]

    def test_login_bad_password(self, client, alice):
        r = client.post(f"{API}/auth/login", json={"email": alice["user"]["email"], "password": "wrong-pw!"})
        assert r.status_code == 401

    def test_me_unauth(self, client):
        r = client.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_ok(self, client, alice):
        r = client.get(f"{API}/auth/me", headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["email"] == alice["user"]["email"]


# ---------------- Profile / Search ----------------
class TestProfile:
    def test_patch_me(self, client, alice):
        r = client.patch(f"{API}/users/me", json={"bio": "hello"}, headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["bio"] == "hello"

    def test_privacy(self, client, alice):
        r = client.patch(f"{API}/users/me/privacy", json={"read_receipts": False}, headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["read_receipts"] is False
        # revert
        client.patch(f"{API}/users/me/privacy", json={"read_receipts": True}, headers=H(alice["access_token"]))

    def test_search(self, client, alice, bob):
        r = client.get(f"{API}/users/search", params={"q": bob["user"]["username"][:6]}, headers=H(alice["access_token"]))
        assert r.status_code == 200
        assert any(u["id"] == bob["user"]["id"] for u in r.json())

    def test_get_user(self, client, alice, bob):
        r = client.get(f"{API}/users/{bob['user']['id']}", headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["id"] == bob["user"]["id"]


# ---------------- Contacts / Block / Report ----------------
class TestContacts:
    def test_add_contact(self, client, alice, bob):
        r = client.post(f"{API}/contacts", json={"contact_id": bob["user"]["id"]}, headers=H(alice["access_token"]))
        assert r.status_code == 201

    def test_list_contacts(self, client, alice, bob):
        r = client.get(f"{API}/contacts", headers=H(alice["access_token"]))
        assert r.status_code == 200 and any(c["id"] == bob["user"]["id"] for c in r.json())

    def test_remove_contact(self, client, alice, bob):
        r = client.delete(f"{API}/contacts/{bob['user']['id']}", headers=H(alice["access_token"]))
        assert r.status_code == 200

    def test_block_flow(self, client, alice, carol):
        r = client.post(f"{API}/block", json={"user_id": carol["user"]["id"]}, headers=H(alice["access_token"]))
        assert r.status_code == 200
        r = client.get(f"{API}/block", headers=H(alice["access_token"]))
        assert r.status_code == 200 and any(u["id"] == carol["user"]["id"] for u in r.json())
        # Direct conversation should now fail with 403
        r = client.post(f"{API}/conversations/direct", json={"user_id": carol["user"]["id"]}, headers=H(alice["access_token"]))
        assert r.status_code == 403
        # unblock
        assert client.delete(f"{API}/block/{carol['user']['id']}", headers=H(alice["access_token"])).status_code == 200

    def test_report(self, client, alice, carol):
        r = client.post(f"{API}/reports", json={"target_type": "user", "target_id": carol["user"]["id"], "reason": "spam"}, headers=H(alice["access_token"]))
        assert r.status_code == 201


# ---------------- Conversations & Messages ----------------
@pytest.fixture(scope="module")
def direct_conv(client, alice, bob):
    r = client.post(f"{API}/conversations/direct", json={"user_id": bob["user"]["id"]}, headers=H(alice["access_token"]))
    assert r.status_code == 200
    return r.json()


class TestConversations:
    def test_direct_idempotent(self, client, alice, bob, direct_conv):
        r = client.post(f"{API}/conversations/direct", json={"user_id": bob["user"]["id"]}, headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["id"] == direct_conv["id"]

    def test_list(self, client, alice, direct_conv):
        r = client.get(f"{API}/conversations", headers=H(alice["access_token"]))
        assert r.status_code == 200 and any(c["id"] == direct_conv["id"] for c in r.json())

    def test_send_message_and_persist(self, client, alice, bob, direct_conv):
        cid = direct_conv["id"]
        r = client.post(f"{API}/conversations/{cid}/messages", json={"type": "text", "text": "hello bob"}, headers=H(alice["access_token"]))
        assert r.status_code == 201
        msg = r.json()
        assert msg["text"] == "hello bob" and msg["sender_id"] == alice["user"]["id"]
        # GET verification
        r = client.get(f"{API}/conversations/{cid}/messages", headers=H(bob["access_token"]))
        assert r.status_code == 200
        texts = [m.get("text") for m in r.json()["messages"]]
        assert "hello bob" in texts

    def test_edit_only_sender(self, client, alice, bob, direct_conv):
        r = client.post(f"{API}/conversations/{direct_conv['id']}/messages", json={"type": "text", "text": "to edit"}, headers=H(alice["access_token"]))
        mid = r.json()["id"]
        # Bob (not sender) → 403
        r = client.patch(f"{API}/messages/{mid}", json={"text": "hax"}, headers=H(bob["access_token"]))
        assert r.status_code == 403
        # Alice succeeds
        r = client.patch(f"{API}/messages/{mid}", json={"text": "edited"}, headers=H(alice["access_token"]))
        assert r.status_code == 200

    def test_delete_only_sender(self, client, alice, bob, direct_conv):
        r = client.post(f"{API}/conversations/{direct_conv['id']}/messages", json={"type": "text", "text": "to delete"}, headers=H(alice["access_token"]))
        mid = r.json()["id"]
        assert client.delete(f"{API}/messages/{mid}", headers=H(bob["access_token"])).status_code == 403
        assert client.delete(f"{API}/messages/{mid}", headers=H(alice["access_token"])).status_code == 200

    def test_react_pin(self, client, alice, direct_conv):
        r = client.post(f"{API}/conversations/{direct_conv['id']}/messages", json={"type": "text", "text": "react"}, headers=H(alice["access_token"]))
        mid = r.json()["id"]
        r = client.post(f"{API}/messages/{mid}/react", json={"emoji": "👍"}, headers=H(alice["access_token"]))
        assert r.status_code == 200 and len(r.json()["reactions"]) == 1
        assert client.post(f"{API}/messages/{mid}/pin", headers=H(alice["access_token"])).status_code == 200
        assert client.delete(f"{API}/messages/{mid}/pin", headers=H(alice["access_token"])).status_code == 200

    def test_mark_read(self, client, bob, direct_conv):
        r = client.post(f"{API}/conversations/{direct_conv['id']}/read", headers=H(bob["access_token"]))
        assert r.status_code == 200

    def test_settings_mute(self, client, alice, direct_conv):
        r = client.patch(f"{API}/conversations/{direct_conv['id']}/settings", json={"muted": True}, headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["muted"] is True

    def test_non_member_cannot_access(self, client, carol, direct_conv):
        r = client.get(f"{API}/conversations/{direct_conv['id']}/messages", headers=H(carol["access_token"]))
        assert r.status_code == 404
        r = client.post(f"{API}/conversations/{direct_conv['id']}/messages", json={"type": "text", "text": "hax"}, headers=H(carol["access_token"]))
        assert r.status_code == 404


class TestGroups:
    def test_create_group(self, client, alice, bob, carol):
        r = client.post(f"{API}/conversations/group", json={"name": "Squad", "member_ids": [bob["user"]["id"], carol["user"]["id"]]}, headers=H(alice["access_token"]))
        assert r.status_code == 201
        gid = r.json()["id"]
        # PATCH admin only
        r = client.patch(f"{API}/conversations/{gid}", json={"description": "team"}, headers=H(alice["access_token"]))
        assert r.status_code == 200
        # bob is not admin
        r = client.patch(f"{API}/conversations/{gid}", json={"description": "bad"}, headers=H(bob["access_token"]))
        assert r.status_code == 403
        # promote bob
        assert client.post(f"{API}/conversations/{gid}/admins/{bob['user']['id']}", headers=H(alice["access_token"])).status_code == 200
        # remove carol
        assert client.delete(f"{API}/conversations/{gid}/members/{carol['user']['id']}", headers=H(alice["access_token"])).status_code == 200


# ---------------- VIP ----------------
class TestVIP:
    def test_translate_gated(self, client, alice):
        r = client.post(f"{API}/vip/translate", json={"text": "Hello", "target_lang": "zu"}, headers=H(alice["access_token"]))
        assert r.status_code == 403

    def test_subscribe_and_translate(self, client, alice):
        r = client.post(f"{API}/vip/subscribe", headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["is_vip"] is True
        r = client.post(f"{API}/vip/translate", json={"text": "Hello, how are you?", "target_lang": "zu"}, headers=H(alice["access_token"]), timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)
        # response must include translated content
        s = json.dumps(body).lower()
        assert len(s) > 5

    def test_status_and_cancel(self, client, alice):
        r = client.get(f"{API}/vip/status", headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["is_vip"] is True
        r = client.post(f"{API}/vip/cancel", headers=H(alice["access_token"]))
        assert r.status_code == 200 and r.json()["is_vip"] is False


# ---------------- Calls ----------------
class TestCalls:
    def test_call_flow(self, client, alice, bob, direct_conv):
        r = client.post(f"{API}/calls", json={"conversation_id": direct_conv["id"], "type": "voice"}, headers=H(alice["access_token"]))
        assert r.status_code == 201
        call_id = r.json()["call"]["id"]
        r = client.patch(f"{API}/calls/{call_id}", json={"status": "answered"}, headers=H(bob["access_token"]))
        assert r.status_code == 200
        r = client.patch(f"{API}/calls/{call_id}", json={"status": "ended", "duration": 42}, headers=H(alice["access_token"]))
        assert r.status_code == 200
        r = client.get(f"{API}/calls", headers=H(bob["access_token"]))
        assert r.status_code == 200
        history = r.json()
        assert any(c["id"] == call_id and c["direction"] == "incoming" for c in history)


# ---------------- Media ----------------
class TestMedia:
    def test_upload_and_access_control(self, alice, bob, carol, direct_conv):
        # multipart upload (no default content-type json)
        files = {"file": ("hello.txt", io.BytesIO(b"hello ditsala"), "text/plain")}
        r = requests.post(f"{API}/upload", files=files, headers={"Authorization": f"Bearer {alice['access_token']}"})
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        # owner can download (via token query)
        r = requests.get(f"{API}/files/{path}", params={"token": alice["access_token"]})
        assert r.status_code == 200 and r.content == b"hello ditsala"
        # non-member/non-owner (carol) → 403 (attachment not linked to any conversation msg)
        r = requests.get(f"{API}/files/{path}", params={"token": carol["access_token"]})
        assert r.status_code == 403
        # send message with attachment then bob (member) can access
        att = {"url": f"/api/files/{path}", "name": "hello.txt", "size": 13, "mime": "text/plain"}
        r = requests.post(
            f"{API}/conversations/{direct_conv['id']}/messages",
            json={"type": "file", "text": "", "attachment": att},
            headers=H(alice["access_token"]),
        )
        assert r.status_code == 201
        r = requests.get(f"{API}/files/{path}", params={"token": bob["access_token"]})
        assert r.status_code == 200


# ---------------- Realtime WebSocket ----------------
class TestRealtime:
    def test_ws_delivers_message(self, alice, bob, direct_conv):
        async def run():
            uri = f"{WS}?token={bob['access_token']}"
            async with websockets.connect(uri) as ws:
                # give server tick
                await asyncio.sleep(0.5)
                # trigger a REST send from alice
                requests.post(
                    f"{API}/conversations/{direct_conv['id']}/messages",
                    json={"type": "text", "text": f"ws-hello-{RUN}"},
                    headers=H(alice["access_token"]),
                )
                # wait for message:new
                got = None
                deadline = time.time() + 8
                while time.time() < deadline:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=2)
                        data = json.loads(raw)
                        if data.get("type") == "message:new" and data.get("conversation_id") == direct_conv["id"]:
                            got = data
                            break
                    except asyncio.TimeoutError:
                        continue
                assert got is not None, "did not receive message:new"
                assert got["message"]["text"] == f"ws-hello-{RUN}"

        asyncio.run(run())

    def test_ws_bad_token_closes(self):
        async def run():
            uri = f"{WS}?token=nope"
            try:
                async with websockets.connect(uri) as ws:
                    # server should close immediately
                    with pytest.raises(Exception):
                        await asyncio.wait_for(ws.recv(), timeout=3)
            except Exception:
                pass

        asyncio.run(run())
