import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Converter = require("openapi-to-postmanv2");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = path.join(rootDir, "apps/api/openapi.yaml");
const collectionPath = path.join(rootDir, "postman/scos-api.postman_collection.json");
const checkOnly = process.argv.includes("--check");

function syncCollection(openapiData, existingCollection) {
  return new Promise((resolve, reject) => {
    Converter.syncCollection(
      { type: "string", data: openapiData },
      {},
      existingCollection,
      {
        syncExamples: true,
        deleteOrphanedRequests: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result?.result) {
          reject(new Error(result?.reason ?? "OpenAPI conversion failed"));
          return;
        }

        const generatedCollection = result.output?.find(
          (output) => output.type === "collection"
        )?.data;

        if (!generatedCollection) {
          reject(new Error("OpenAPI conversion did not produce a Postman collection"));
          return;
        }

        resolve(generatedCollection);
      }
    );
  });
}

function collectionRequestCount(items = []) {
  return items.reduce(
    (count, item) =>
      count + (item.request ? 1 : 0) + collectionRequestCount(item.item),
    0
  );
}

async function writeCollectionAtomically(collection) {
  const temporaryPath = `${collectionPath}.${process.pid}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(collection, null, 2)}\n`,
      "utf8"
    );
    await rename(temporaryPath, collectionPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

const [openapiData, existingCollectionData] = await Promise.all([
  readFile(specPath, "utf8"),
  readFile(collectionPath, "utf8"),
]);

const existingCollection = JSON.parse(existingCollectionData);
const generatedCollection = await syncCollection(openapiData, existingCollection);
const requestCount = collectionRequestCount(generatedCollection.item);

if (requestCount === 0) {
  throw new Error("Generated collection contains no requests");
}

const generatedJson = `${JSON.stringify(generatedCollection, null, 2)}\n`;

if (checkOnly) {
  if (generatedJson !== existingCollectionData) {
    console.error(
      "Postman collection is out of date. Run `pnpm postman:generate` and commit the result."
    );
    process.exitCode = 1;
  } else {
    console.log(`Postman collection is up to date (${requestCount} requests).`);
  }
} else {
  await writeCollectionAtomically(generatedCollection);
  console.log(`Generated ${collectionPath} from ${specPath} (${requestCount} requests).`);
}
