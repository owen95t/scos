// Runs before every db test file. Fails loudly instead of skipping, and refuses
// to touch any database that isn't a disposable *_test one, since the suites
// delete orders.
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "db tests require DATABASE_URL pointing at a *_test database. Run `pnpm test:integration`."
  );
}

let dbName: string;
try {
  dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
} catch {
  throw new Error("DATABASE_URL is not a valid URL");
}

if (!dbName.endsWith("_test")) {
  throw new Error(
    `Refusing to run db tests against database "${dbName}": name must end with "_test".`
  );
}
