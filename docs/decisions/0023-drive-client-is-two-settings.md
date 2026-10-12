# ADR 0023 — The Drive client is two settings

## Status

Accepted. Replaces the required-set rule in ADR 0008. The connection route still does not call Google.

## Problem

A person who rotates the Google OAuth client should change two values, not four. The redirect URI for this workstation is already known. The Shared Drive id is not a secret and is not available yet. Requiring all four before startup would stop the API when only the client pair exists.

## Decision

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are the only Drive values an operator sets. They live in `.env`, which is gitignored.
- Setting one of that pair without the other refuses startup. The error names the missing variable and does not repeat the secret.
- `GOOGLE_REDIRECT_URI` defaults to `http://127.0.0.1:43124/api/v1/storage/oauth/callback` when it is blank. A non-URL value still refuses startup.
- `GOOGLE_DRIVE_ID` is optional. When it is blank and the client pair is set, the connection report is `configured` and `missing` is `["GOOGLE_DRIVE_ID"]`.
- The report still does not call Google and still does not return any setting value.

## Alternatives

- Keep all four required. Rejected. The operator would have to paste the same redirect URI every time they rotate the client.
- Invent a shared drive id. Rejected. A live call needs the real id.

## Trade-offs

`configured` means the client pair is present. It does not mean a file can be stored. Uploads stay `upload_failed` until a later change calls Drive.

## Security

The secret is not written to git, the connection body, or the startup error.

## Revisit when

A Shared Drive id exists. The next Drive change is one live read, with the failure classes, still without returning the secret.
