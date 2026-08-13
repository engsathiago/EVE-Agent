import { describe, expect, it } from "vitest";
import {
  allowEveAction,
  createEmptyEvePolicy,
  evaluateEvePolicy,
} from "./contract.js";

describe("empty EVE policy contract", () => {
  it("contains no behavioral rules", () => {
    expect(createEmptyEvePolicy()).toEqual({ version: 1, rules: [] });
  });

  it("allows every action without matching a rule", () => {
    expect(evaluateEvePolicy(createEmptyEvePolicy(), { action: "any-action" })).toEqual(
      allowEveAction(),
    );
  });
});
