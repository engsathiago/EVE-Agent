/** ACP runtime error exports wired to EVE secret redaction. */
import { configureAcpErrorRedactor } from "@eve/acp-core";
import { redactSensitiveText } from "../../logging/redact.js";

// Ensure ACP-core runtime errors use EVE's secret redaction before re-export.
configureAcpErrorRedactor(redactSensitiveText);

export * from "@eve/acp-core/runtime/errors";
