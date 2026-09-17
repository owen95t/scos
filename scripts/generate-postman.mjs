import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Converter = require("openapi-to-postmanv2");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = path.join(rootDir, "openapi.yaml");
const collectionPath = path.join(rootDir, "postman/scos-api.postman_collection.json");
const checkOnly = process.argv.includes("--check");

function convertCollection(openapiData) {
  return new Promise((resolve, reject) => {
    Converter.convert(
      { type: "string", data: openapiData },
      {},
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

        resolve(
          typeof generatedCollection.toJSON === "function"
            ? generatedCollection.toJSON()
            : generatedCollection
        );
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

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function flattenRequests(items = [], requests = []) {
  for (const item of items) {
    if (item.request) {
      requests.push(item);
    }
    if (item.item) {
      flattenRequests(item.item, requests);
    }
  }
  return requests;
}

function requestKey(item) {
  const path = (item.request?.url?.path ?? []).map((segment) =>
    segment.startsWith(":") ? `{{${segment.slice(1)}}}` : segment
  ).join("/") || item.request?.url?.raw || "";
  return `${item.request?.method?.toUpperCase() ?? ""} ${path}`;
}

function displayFolderName(pathSegments) {
  const apiIndex = pathSegments.indexOf("api");
  const resource = pathSegments[apiIndex + 1] ?? pathSegments[0] ?? "api";
  return resource
    .split(/[-_]/u)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function addCollectionVariables(generatedCollection, existingCollection) {
  const existingVariables = (existingCollection.variable ?? []).map(clone);
  const existingKeys = new Set(existingVariables.map((variable) => variable.key));
  const hadExistingBaseUrl = existingKeys.has("baseUrl");

  for (const variable of generatedCollection.variable ?? []) {
    if (!existingKeys.has(variable.key)) {
      existingVariables.push(clone(variable));
      existingKeys.add(variable.key);
    }
  }

  if (!hadExistingBaseUrl) {
    const generatedBaseUrl = existingVariables.find((variable) => variable.key === "baseUrl");
    if (generatedBaseUrl) {
      generatedBaseUrl.value = "http://localhost:3001";
    } else {
      existingVariables.unshift({ key: "baseUrl", value: "http://localhost:3001", type: "string" });
    }
  }

  generatedCollection.variable = existingVariables;
}

function normalizeRequest(item, existingItem) {
  const request = item.request;
  const url = request.url ?? {};
  const pathSegments = (url.path ?? []).map((segment) =>
    segment.startsWith(":") ? `{{${segment.slice(1)}}}` : segment
  );
  const query = (url.query ?? [])
    .filter((parameter) => !parameter.disabled)
    .map((parameter) => `${parameter.key}=${parameter.value ?? ""}`)
    .join("&");

  url.path = pathSegments;
  url.host = ["{{baseUrl}}"];
  url.variable = [];
  url.raw = `{{baseUrl}}/${pathSegments.join("/")}${query ? `?${query}` : ""}`;
  request.url = url;

  if (request.auth === null) {
    delete request.auth;
  }
  if (
    request.description &&
    typeof request.description === "object" &&
    !request.description.content
  ) {
    delete request.description;
  }

  if (request.body?.mode === "raw" && typeof request.body.raw === "string") {
    for (const field of ["quantity", "latitude", "longitude"]) {
      const pattern = new RegExp(
        `("${field}"\\s*:\\s*)(?:"(?:\\\\.|[^"\\\\])*"|[^,}\\n]+)`,
        "gu"
      );
      request.body.raw = request.body.raw.replace(pattern, `$1{{${field}}}`);
    }
  }

  const existingEvents = existingItem?.event;
  item.event = existingEvents?.length ? clone(existingEvents) : [];
  item.response = existingItem?.response ? clone(existingItem.response) : [];
  if (Object.keys(request.body ?? {}).length === 0) {
    delete request.body;
  }
  if (existingItem?.protocolProfileBehavior) {
    item.protocolProfileBehavior = clone(existingItem.protocolProfileBehavior);
  } else {
    delete item.protocolProfileBehavior;
  }
  if (existingItem?.name) {
    item.name = existingItem.name;
  }
}

function removeTransientIds(value) {
  if (Array.isArray(value)) {
    value.forEach(removeTransientIds);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }

  delete value.id;
  Object.values(value).forEach(removeTransientIds);
}

function decorateCollection(generatedCollection, existingCollection) {
  const existingRequests = new Map(
    flattenRequests(existingCollection.item).map((item) => [requestKey(item), item])
  );
  const generatedRequests = flattenRequests(generatedCollection.item);
  const folders = new Map();

  for (const item of generatedRequests) {
    const existingItem = existingRequests.get(requestKey(item));
    normalizeRequest(item, existingItem);

    const folderName = displayFolderName(item.request.url.path ?? []);
    if (!folders.has(folderName)) {
      folders.set(folderName, { name: folderName, item: [] });
    }
    folders.get(folderName).item.push(item);
  }

  generatedCollection.item = [...folders.values()];
  addCollectionVariables(generatedCollection, existingCollection);

  const generatedInfo = generatedCollection.info ?? {};
  const existingInfo = existingCollection.info ?? {};
  generatedCollection.info = {
    _postman_id:
      existingInfo._postman_id ??
      generatedInfo._postman_id ??
      generatedCollection._?.postman_id ??
      "c8b4a1d2-5e6f-4a7b-9c8d-1e2f3a4b5c6d",
    name: generatedInfo.name ?? existingInfo.name ?? "SCOS Order Management API",
    schema:
      generatedInfo.schema ??
      existingInfo.schema ??
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    ...(generatedInfo.description || existingInfo.description
      ? { description: generatedInfo.description ?? existingInfo.description }
      : {}),
  };
  delete generatedCollection._;
  delete generatedCollection.event;
  removeTransientIds(generatedCollection);

  const normalizedCollection = {
    info: generatedCollection.info,
    variable: generatedCollection.variable,
    item: generatedCollection.item,
  };
  for (const key of ["auth", "protocolProfileBehavior"]) {
    if (generatedCollection[key] !== undefined) {
      normalizedCollection[key] = generatedCollection[key];
    }
  }

  return normalizedCollection;
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
const generatedCollection = decorateCollection(
  await convertCollection(openapiData),
  existingCollection
);
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
