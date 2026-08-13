// Telegram plugin module implements exec approval resolver behavior.
import { resolveApprovalOverGateway } from "eve-agent/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "eve-agent/plugin-sdk/approval-reply-runtime";
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";

export type ResolveTelegramExecApprovalParams = {
  cfg: EVEConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  allowPluginFallback?: boolean;
  gatewayUrl?: string;
};

export async function resolveTelegramExecApproval(
  params: ResolveTelegramExecApprovalParams,
): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    allowPluginFallback: params.allowPluginFallback,
    clientDisplayName: `Telegram approval (${params.senderId?.trim() || "unknown"})`,
  });
}
