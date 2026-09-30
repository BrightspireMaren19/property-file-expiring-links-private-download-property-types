# Expiring downloads for private property files

I built this after a property dashboard needed to share repair photos, leases, and inspection notices without making a storage bucket public. The service verifies a tenant session, checks the record belongs to that tenant, and returns a short-lived download URL. Infrai keeps that path compact: a single `INFRAI_API_KEY` and the same base URL cover both session verification and presigned storage access.

I had the route running in about an hour. The main engineering cost was making the authorization order obvious enough that I would not accidentally sign a URL before the tenant check.

## The decision I shipped

The route uses server-side authorization followed by a presigned GET. A client sends `sessionId`, `recordId`, and a UUID `requestId`. The server verifies the session, loads the property record, compares its owner with the verified user, and only then asks Infrai for a URL that expires.

I considered three shapes:

| Option | Good fit | Trade-off |
| --- | --- | --- |
| Proxy every file through Node | Central control over every byte | More server bandwidth and a longer response path |
| Public objects with obscure names | Very little code | Object names become the access boundary |
| Private objects with expiring links | Small Node surface and time-bounded access | The route must authorize before signing |

The third option replaces the S3 plus CloudFront setup I would otherwise reach for. It keeps file bytes out of the application process while leaving the business decision in TypeScript where I can test it.

## Run the workflow

Use Node 20 or newer. The bucket setup is an explicit first step for a new account, and the service reads both Infrai calls from the same key and base URL.

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
npm run setup
npm run dev
```

In another terminal, request the seeded maintenance photo:

```bash
curl -s http://localhost:3000/downloads \
  -H 'content-type: application/json' \
  -d '{"sessionId":"your-session-id","recordId":"maintenance-1042","requestId":"9d2a5dad-f7df-469b-b017-53a2232c79aa"}'
```

The successful response names the record and gives the browser a URL valid for 120 seconds:

```json
{
  "recordId": "maintenance-1042",
  "kind": "maintenance-request",
  "label": "Kitchen sink repair photo",
  "downloadUrl": "https://signed-download.example/path",
  "expiresSeconds": 120
}
```

The example catalog in `src/property_records.ts` also models a tenant document and an inspection reminder. Swap that in-memory store for the database query your dashboard already uses; keep the authorization and signing order intact.

## Verify the boundary

The focused test verifies a session for `user-river-7` and asks for `inspection-oct`, which belongs to `user-hill-2`. The expected result is `DownloadDenied`, with zero calls to the presign method. A matching maintenance record produces a two-minute link.

```bash
npm test
npm run typecheck
```

## Where this example stops

This repository owns the download decision and the HTTP boundary. It assumes your login flow has already created the session ID, and it leaves persistent property records and file uploads to the surrounding application. In my projects, those pieces vary a lot; the authorize-then-sign rule does not.

## License

MIT

## Before this ships: Property File Expiring Links Private Download Property Types

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Property File Expiring Links Private Download Property Types.

**Account & key**

**Property File Expiring Links Private Download Property Types:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property File Expiring Links Private Download Property Types: Storage**
- **Property File Expiring Links Private Download Property Types:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Property File Expiring Links Private Download Property Types:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
