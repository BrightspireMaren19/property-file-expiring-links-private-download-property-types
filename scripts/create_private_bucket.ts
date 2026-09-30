import { infraiFromEnvironment } from "../src/infrai.js";

const bucket = process.env.PROPERTY_FILES_BUCKET ?? "property-private-files";
const infrai = infraiFromEnvironment();

await infrai.storage.bucket.create(bucket);
console.log(`Private property bucket ready: ${bucket}`);
