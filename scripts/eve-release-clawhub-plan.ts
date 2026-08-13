#!/usr/bin/env -S node --import tsx
// EVE release ClawHub plan CLI emits release workflow routing as JSON.

import { pathToFileURL } from "node:url";
import {
  buildEVEReleaseClawHubPlan,
  parseEVEReleaseClawHubPlanArgs,
} from "./lib/eve-release-clawhub-plan.ts";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = parseEVEReleaseClawHubPlanArgs(process.argv.slice(2));
  const plan = await buildEVEReleaseClawHubPlan(args);
  console.log(JSON.stringify(plan, null, 2));
}
