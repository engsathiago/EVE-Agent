// STT live audio tests validate live speech-to-text audio fixtures.
import {
  expectEVELiveTranscriptMarker,
  normalizeTranscriptForMatch,
  EVE_LIVE_TRANSCRIPT_MARKER_RE,
} from "eve-agent/plugin-sdk/provider-test-contracts";
import { describe, expect, it } from "vitest";

describe("normalizeTranscriptForMatch", () => {
  it("normalizes punctuation and common EVE live transcription variants", () => {
    expect(normalizeTranscriptForMatch("E.V.E. integration OK")).toBe("eveintegrationok");
    expect(normalizeTranscriptForMatch("Testing Evie realtime transcription")).toMatch(
      EVE_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expect(normalizeTranscriptForMatch("Evy xAI realtime transcription")).toMatch(
      EVE_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expect(normalizeTranscriptForMatch("E V E xAI realtime transcription")).toMatch(
      EVE_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expectEVELiveTranscriptMarker("Evie integration OK");
  });
});
