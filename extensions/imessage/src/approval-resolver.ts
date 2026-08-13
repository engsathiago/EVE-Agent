// Imessage plugin module implements approval resolver behavior.
import { resolveApprovalOverGateway } from "eve-agent/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "eve-agent/plugin-sdk/approval-reply-runtime";
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import { isApprovalNotFoundError } from "eve-agent/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveIMessageApproval(params: {
  cfg: EVEConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `iMessage approval (${params.senderId?.trim() || "unknown"})`,
  });
}
