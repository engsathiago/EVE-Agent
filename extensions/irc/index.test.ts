// Irc tests cover index plugin behavior.
import { assertBundledChannelEntries } from "eve-agent/plugin-sdk/channel-test-helpers";
import { describe } from "vitest";
import entry from "./index.js";
import setupEntry from "./setup-entry.js";

describe("irc bundled entries", () => {
  assertBundledChannelEntries({
    entry,
    expectedId: "irc",
    expectedName: "IRC",
    setupEntry,
  });
});
