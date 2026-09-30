import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryPropertyRecords } from "../src/property_records.js";
import { DownloadDenied, issuePropertyDownload } from "../src/signed_download.js";

test("a tenant cannot receive a signed URL for another tenant's inspection reminder", async () => {
  let presignCalls = 0;
  const infrai = {
    auth: { session: { verify: async () => ({ user_id: "user-river-7" }) } },
    storage: {
      bucket: { create: async () => ({}) },
      object: {
        presign: async () => {
          presignCalls += 1;
          return { url: "https://download.example/signed" };
        },
      },
    },
  };

  await assert.rejects(
    issuePropertyDownload(
      {
        sessionId: "session-valid",
        recordId: "inspection-oct",
        requestId: "59f6ce6d-e784-44d7-a0c0-16ef18265920",
      },
      new InMemoryPropertyRecords(),
      infrai,
      "property-private-files",
    ),
    DownloadDenied,
  );
  assert.equal(presignCalls, 0);
});

test("a matching tenant gets a two-minute maintenance download", async () => {
  const infrai = {
    auth: { session: { verify: async () => ({ user_id: "user-river-7" }) } },
    storage: {
      bucket: { create: async () => ({}) },
      object: {
        presign: async () => ({ url: "https://download.example/signed" }),
      },
    },
  };

  const result = await issuePropertyDownload(
    {
      sessionId: "session-valid",
      recordId: "maintenance-1042",
      requestId: "9d2a5dad-f7df-469b-b017-53a2232c79aa",
    },
    new InMemoryPropertyRecords(),
    infrai,
    "property-private-files",
  );

  assert.equal(result.kind, "maintenance-request");
  assert.equal(result.expiresSeconds, 120);
});
