import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, infraiFromEnvironment } from "./infrai.js";
import { InMemoryPropertyRecords } from "./property_records.js";
import {
  DownloadDenied,
  RecordNotFound,
  downloadRequestSchema,
  issuePropertyDownload,
} from "./signed_download.js";

const bucket = process.env.PROPERTY_FILES_BUCKET ?? "property-private-files";
const port = Number(process.env.PORT ?? 3000);
const infrai = infraiFromEnvironment();
const records = new InMemoryPropertyRecords();

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/downloads") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = downloadRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await issuePropertyDownload(input, records, infrai, bucket);
    json(response, 200, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Request body is invalid" });
    } else if (error instanceof DownloadDenied) {
      json(response, 403, { error: error.message });
    } else if (error instanceof RecordNotFound) {
      json(response, 404, { error: error.message });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.message });
    } else {
      json(response, 500, { error: "Could not issue the download" });
    }
  }
});

server.listen(port, () => {
  console.log(`Property file service listening at http://localhost:${port}`);
});
