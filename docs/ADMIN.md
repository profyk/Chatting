# Ditsala — Admin (planned, separate app)

The admin dashboard is a SEPARATE web application (not part of the mobile client) and is not built in
this mobile-focused v1. This document specifies its contract so it can be built against the same API/DB.

## Roles (RBAC)
- Super Admin — full control incl. admin management + role assignment + MFA policy.
- Admin — user/moderation/VIP management, system monitoring.
- Moderator — reports + moderation actions only.
- Support — read-only user lookup + status.

Admins authenticate with a separate admin credential store and **MFA (TOTP)**. Admin JWTs carry a
`role` claim; every admin endpoint checks the role. Privilege escalation is blocked: only Super Admin may
change roles, and never for their own account beyond their level.

## Data access boundary
Admins **cannot** read private message content. Moderation surfaces show only reported message ids +
metadata + reporter context, never bulk message bodies. All admin actions are audit-logged.

## Feature surface
- Dashboard metrics: total/active users, new registrations, messages, calls, reports, blocked, VIP users.
- User management: search, view, suspend (`users.status=suspended`), restore, verification status.
- Moderation: user/message/group reports queue, moderation actions.
- VIP management: subscriptions, status, translation usage (`vip_usage`), stats.
- System monitoring: API health (`/api/health`), DB health, storage usage, realtime connections, errors.

Suspended users are blocked at auth (`get_user_by_token` → 403) — already enforced in the mobile backend.
