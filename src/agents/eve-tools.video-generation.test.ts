// Verifies video-generation tool registration through the shared generation harness.
import { describeEVEGenerationToolRegistration } from "./eve-tools.generation.test-support.js";

describeEVEGenerationToolRegistration({
  suiteName: "eve tools video generation registration",
  toolName: "video_generate",
  toolLabel: "a video-generation tool",
});
