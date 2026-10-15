import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routesSource = readFileSync(new URL("../src/shared/config/routes.ts", import.meta.url), "utf8");
const siteSource = readFileSync(new URL("../src/shared/config/site.ts", import.meta.url), "utf8");
const apiRoutesSource = readFileSync(new URL("../src/core/api/api.routes.ts", import.meta.url), "utf8");

assert.match(siteSource, /name:\s*"Modelry"/);
assert.match(siteSource, /description:\s*"[^"]*interactive AI laboratory[^"]*"/i);

assert.match(routesSource, /ROOT:\s*"\/"/);
assert.match(routesSource, /AUTH:\s*\{/);
assert.match(routesSource, /ACCOUNT:\s*\{/);
assert.match(routesSource, /STUDIO:\s*\{/);
assert.doesNotMatch(routesSource, /STORE:\s*\{/);
assert.doesNotMatch(routesSource, /BLOG:\s*\{/);
assert.doesNotMatch(routesSource, /FEEDS:\s*\{/);

assert.match(apiRoutesSource, /system:\s*systemRouter/);
assert.match(apiRoutesSource, /viewer:\s*viewerRouter/);
assert.doesNotMatch(apiRoutesSource, /addressRouter|catalogRouter|orderRouter|paymentRouter|wishlistRouter/);

console.log("starter smoke checks passed");
