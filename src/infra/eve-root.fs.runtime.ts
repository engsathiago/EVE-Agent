// EVE root resolution imports fs through this facade so tests can replace
// filesystem behavior without mocking node:fs globally.
export { default as eveRootFsSync } from "node:fs";
export { default as eveRootFs } from "node:fs/promises";
