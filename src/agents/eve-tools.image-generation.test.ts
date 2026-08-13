// Verifies image-generation tool registration through the shared generation harness.
import { describeEVEGenerationToolRegistration } from "./eve-tools.generation.test-support.js";

describeEVEGenerationToolRegistration({
  suiteName: "eve tools image generation registration",
  toolName: "image_generate",
  toolLabel: "an image-generation tool",
});
