// Normalizes config version metadata and compatibility comparisons.
import {
  comparePrereleaseIdentifiers,
  normalizeLegacyDotBetaVersion,
} from "../infra/semver-compare.js";

type EVEVersion = {
  major: number;
  minor: number;
  patch: number;
  revision: number | null;
  prerelease: string[] | null;
};

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

/** Parses stable, prerelease, and legacy dot-beta EVE versions. */
export function parseEVEVersion(raw: string | null | undefined): EVEVersion | null {
  if (!raw) {
    return null;
  }
  const normalized = normalizeLegacyDotBetaVersion(raw.trim());
  const match = normalized.match(VERSION_RE);
  if (!match) {
    return null;
  }
  const [, major, minor, patch, suffix] = match;
  const revision = suffix && /^[0-9]+$/.test(suffix) ? Number.parseInt(suffix, 10) : null;
  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
    revision,
    prerelease: suffix && revision == null ? suffix.split(".").filter(Boolean) : null,
  };
}

export function normalizeEVEVersionBase(raw: string | null | undefined): string | null {
  const parsed = parseEVEVersion(raw);
  if (!parsed) {
    return null;
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

export function isSameEVEStableFamily(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const parsedA = parseEVEVersion(a);
  const parsedB = parseEVEVersion(b);
  if (!parsedA || !parsedB) {
    return false;
  }
  if (parsedA.prerelease?.length || parsedB.prerelease?.length) {
    return false;
  }
  return (
    parsedA.major === parsedB.major &&
    parsedA.minor === parsedB.minor &&
    parsedA.patch === parsedB.patch
  );
}

export function compareEVEVersions(
  a: string | null | undefined,
  b: string | null | undefined,
): number | null {
  const parsedA = parseEVEVersion(a);
  const parsedB = parseEVEVersion(b);
  if (!parsedA || !parsedB) {
    return null;
  }
  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }

  const rankA = releaseRank(parsedA);
  const rankB = releaseRank(parsedB);
  if (rankA !== rankB) {
    return rankA < rankB ? -1 : 1;
  }

  if (
    parsedA.revision != null &&
    parsedB.revision != null &&
    parsedA.revision !== parsedB.revision
  ) {
    return parsedA.revision < parsedB.revision ? -1 : 1;
  }

  if (parsedA.prerelease || parsedB.prerelease) {
    return comparePrereleaseIdentifiers(parsedA.prerelease, parsedB.prerelease);
  }

  return 0;
}

export function shouldWarnOnTouchedVersion(
  current: string | null | undefined,
  touched: string | null | undefined,
): boolean {
  const parsedCurrent = parseEVEVersion(current);
  const parsedTouched = parseEVEVersion(touched);
  if (
    parsedCurrent &&
    parsedTouched &&
    parsedCurrent.major === parsedTouched.major &&
    parsedCurrent.minor === parsedTouched.minor &&
    parsedCurrent.patch === parsedTouched.patch
  ) {
    if (!parsedTouched.prerelease?.length) {
      return false;
    }
  }
  if (isSameEVEStableFamily(current, touched)) {
    return false;
  }
  const cmp = compareEVEVersions(current, touched);
  return cmp !== null && cmp < 0;
}

function releaseRank(version: EVEVersion): number {
  if (version.prerelease?.length) {
    return 0;
  }
  if (version.revision != null) {
    return 2;
  }
  return 1;
}
