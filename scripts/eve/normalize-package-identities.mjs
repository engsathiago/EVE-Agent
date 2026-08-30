#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skippedDirectories = new Set([".git", "node_modules", "dist"]);
const dependencySections = new Set([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
]);

function listJsonManifests(directory, results = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      listJsonManifests(absolutePath, results);
    } else if (entry.name === "package.json" || entry.name === "npm-shrinkwrap.json") {
      results.push(absolutePath);
    }
  }
  return results;
}

function renameDependencyKeys(value) {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      dependencySections.has(key) &&
      child &&
      typeof child === "object" &&
      !Array.isArray(child)
    ) {
      if (Object.hasOwn(child, "eve")) {
        child["eve-agent"] = child.eve;
        delete child.eve;
      }
      if (
        (key === "dependencies" || key === "devDependencies") &&
        Object.hasOwn(child, "eve-agent")
      ) {
        child["eve-agent"] = "workspace:*";
      }
      if (Object.hasOwn(child, "@eve/fs-safe")) {
        child["@openclaw/fs-safe"] = child["@eve/fs-safe"];
        delete child["@eve/fs-safe"];
      }
      if (Object.hasOwn(child, "@eve/proxyline")) {
        child["@openclaw/proxyline"] = child["@eve/proxyline"];
        delete child["@eve/proxyline"];
      }
    }
    renameDependencyKeys(child);
  }
}

let changed = 0;
for (const manifestPath of listJsonManifests(root)) {
  const before = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(before);
  renameDependencyKeys(manifest);
  const after = `${JSON.stringify(manifest, null, 2)}\n`;
  if (after !== before) {
    fs.writeFileSync(manifestPath, after);
    changed += 1;
  }
}

process.stdout.write(`Normalized ${changed} package manifests.\n`);
