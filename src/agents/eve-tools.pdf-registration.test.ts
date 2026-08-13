// Verifies PDF tool factory output is included in EVE tool registration.
import { describe, expect, it } from "vitest";
import { collectPresentEVETools } from "./eve-tools.registration.js";
import { createPdfTool } from "./tools/pdf-tool.js";

describe("createEVETools PDF registration", () => {
  it("includes the pdf tool when the pdf factory returns a tool", () => {
    const pdfTool = createPdfTool({
      agentDir: "/tmp/eve-agent-main",
      config: {
        agents: {
          defaults: {
            pdfModel: { primary: "openai/gpt-5.4-mini" },
          },
        },
      },
    });

    expect(pdfTool?.name).toBe("pdf");
    expect(collectPresentEVETools([pdfTool]).map((tool) => tool.name)).toEqual(["pdf"]);
  });
});
