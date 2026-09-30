import { z } from "zod";
import type { InfraiClient } from "./infrai.js";
import type { PropertyRecordStore } from "./property_records.js";

export const downloadRequestSchema = z.object({
  sessionId: z.string().min(1),
  recordId: z.string().min(1),
  requestId: z.string().uuid(),
}).strict();

export type DownloadRequest = z.infer<typeof downloadRequestSchema>;

export class DownloadDenied extends Error {}
export class RecordNotFound extends Error {}

type DownloadGateway = Pick<InfraiClient, "auth" | "storage">;

export async function issuePropertyDownload(
  input: DownloadRequest,
  records: PropertyRecordStore,
  infrai: DownloadGateway,
  bucket: string,
) {
  const session = await infrai.auth.session.verify(input.sessionId);

  const record = records.find(input.recordId);
  if (!record) throw new RecordNotFound("Property record was not found");
  if (record.ownerUserId !== session.user_id) {
    throw new DownloadDenied("This session cannot fetch that tenant record");
  }

  const expiresSeconds = record.kind === "inspection-reminder" ? 300 : 120;
  const signed = await infrai.storage.object.presign(
    bucket,
    record.objectKey,
    expiresSeconds,
    input.requestId,
  );

  return {
    recordId: record.id,
    kind: record.kind,
    label: record.label,
    downloadUrl: signed.url,
    expiresSeconds,
  };
}
