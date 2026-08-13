/** ACP server option re-exports and EVE agent identity metadata. */
export type { AcpProvenanceMode, AcpServerOptions, AcpSession } from "@eve/acp-core/types";
export { normalizeAcpProvenanceMode } from "@eve/acp-core/types";
import { VERSION } from "../version.js";

/** ACP agent identity advertised during protocol initialization. */
export const ACP_AGENT_INFO = {
  name: "eve-acp",
  title: "EVE ACP Gateway",
  version: VERSION,
};
