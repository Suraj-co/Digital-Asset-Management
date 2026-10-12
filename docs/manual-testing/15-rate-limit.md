# Manual test — Module 15

Do not flood the running API while a browser on this machine is in use. The development proxy and a local curl share one socket address, so a flood refuses both for the rest of the window.

## Signed out

Open `/`. Expect Ready when the API and PostgreSQL are up. Expect the sentence that a client that calls too often is refused, and that this page does not show the counter.

`GET /api/v1/health` is HTTP 200. The body is still the health report. It has no request counter.

## Refusal

The automated test covers the refusal. It boots an API with a limit of 2 and expects the third `GET /api/v1/health/live` to be HTTP 429, `error: too_many_requests`, and a `Retry-After` header. The body says “Too many requests from this client. Try again later.” It does not contain the database password.

A second API process would not share that count. Do not claim that it does.

## Narrow width

At 390px the environment page fits. `documentElement.scrollWidth` equals `clientWidth`.
