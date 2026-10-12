# ADR 0009 — Server sessions

## Status

Accepted. Module 3.

## Problem

Login has to create a session the browser script cannot read, and a disabled account has to lose access even if a cookie already exists. User administration is a later module and is not part of the cookie.

## Decision

- `POST /api/v1/session` checks email and password. Unknown users, wrong passwords, and disabled users all receive HTTP 401 and the message "The email or password is incorrect."
- The session token is 32 random bytes. The database stores its SHA-256 hash. The browser receives it only in the `dam_session` cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, 12 hours. `Secure` is set when `NODE_ENV` is production.
- A new login deletes that user's other sessions.
- `GET /api/v1/session` requires the cookie. An expired session or a disabled user is deleted and answered with 401 "Sign in is required."
- `DELETE /api/v1/session` deletes the server row and clears the cookie.
- Passwords are hashed with Node `scrypt` (`N=16384`, `r=8`, `p=1`, 16-byte salt, 32-byte key). The stored form is `scrypt$16384$8$1$<salt>$<hash>`. A different cost is rejected.
- Missing users still run a password verify against a cached placeholder hash so the failure does not return early.
- There is no public registration. An operator creates a user with `apps/api/scripts/create-user.mjs`. The password must be at least 12 characters and is not printed.
- Company membership is not part of the session cookie. Module 4 checks it on company routes.

## Alternatives

- A bearer token in local storage. Rejected. Any script on the page could read it.
- Argon2id. Preferable later. It needs a native module this process does not have. scrypt is in Node and is slow enough for this cost.
- A seeded demo user. Rejected. The repository would contain a known password.

## Trade-offs

scrypt at this cost adds a fraction of a second to each login. That is the point. The placeholder hash is computed once per process, so the first unknown-user login in a fresh process is slower than the ones after it.

## Security

The JSON body never includes the token or the password hash. Validation errors for a missing password are HTTP 400 and do not say whether the email exists. Logs for 4xx responses do not include the exception detail.

## Scaling limit

Session lookup is one indexed read of `tokenHash`. Expired rows are deleted when they are presented, not by a sweeper. A sweeper can wait until the table is large.

## Revisit when

Module 4 adds membership. The session stays the principal. Company checks stay on the request, not in the cookie.
