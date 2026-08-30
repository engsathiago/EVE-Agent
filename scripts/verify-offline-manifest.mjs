#!/usr/bin/env node
// Verify every payload file in an EVE offline bundle before installation.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const bundleRoot = path.resolve(process.argv[2] ?? import.meta.dirname);
const manifestPath = path.join(bundleRoot, "offline-manifest.json");
const expectedManifestHash = process.argv[3]?.trim().toLowerCase();

function fail(message) {
  process.stderr.write(`EVE offline bundle verification failed: ${message}\n`);
  process.exitCode = 1;
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function listFiles(root) {
  const files = [];
  const visit = async (directory) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        files.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
      } else if (entry.isSymbolicLink()) {
        throw new Error(`symbolic links are not allowed: ${absolute}`);
      }
    }
  };
  await visit(root);
  return files.toSorted((left, right) => left.localeCompare(right));
}

try {
  if (!/^[a-f0-9]{64}$/.test(expectedManifestHash ?? "")) {
    throw new Error("a trusted offline-manifest SHA-256 is required");
  }
  if ((await sha256(manifestPath)) !== expectedManifestHash) {
    throw new Error("offline manifest does not match the trusted SHA-256");
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || typeof manifest.checksums !== "object") {
    throw new Error("unsupported or malformed manifest");
  }

  const expected = Object.keys(manifest.checksums).toSorted();
  const actual = (await listFiles(bundleRoot)).filter((file) => file !== "offline-manifest.json");
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    const missing = expected.filter((file) => !actual.includes(file));
    const unexpected = actual.filter((file) => !expected.includes(file));
    throw new Error(
      `payload inventory differs (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"})`,
    );
  }

  for (const relative of expected) {
    const normalized = path.posix.normalize(relative);
    if (normalized !== relative || relative.startsWith("../") || path.posix.isAbsolute(relative)) {
      throw new Error(`unsafe manifest path: ${relative}`);
    }
    const actualHash = await sha256(path.join(bundleRoot, ...relative.split("/")));
    if (actualHash !== manifest.checksums[relative]) {
      throw new Error(`checksum mismatch: ${relative}`);
    }
  }

  process.stdout.write(`Verified EVE offline bundle (${expected.length} payload files).\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
