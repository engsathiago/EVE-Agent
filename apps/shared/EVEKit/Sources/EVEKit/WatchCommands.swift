import Foundation

public enum EVEWatchCommand: String, Codable, Sendable {
    case status = "watch.status"
    case notify = "watch.notify"
}

public enum EVEWatchPayloadType: String, Codable, Sendable, Equatable {
    case notify = "watch.notify"
    case reply = "watch.reply"
    case appSnapshot = "watch.app.snapshot"
    case appSnapshotRequest = "watch.app.snapshotRequest"
    case appCommand = "watch.app.command"
    case execApprovalPrompt = "watch.execApproval.prompt"
    case execApprovalResolve = "watch.execApproval.resolve"
    case execApprovalResolved = "watch.execApproval.resolved"
    case execApprovalExpired = "watch.execApproval.expired"
    case execApprovalSnapshot = "watch.execApproval.snapshot"
    case execApprovalSnapshotRequest = "watch.execApproval.snapshotRequest"
}

public enum EVEWatchRisk: String, Codable, Sendable, Equatable {
    case low
    case medium
    case high
}

public enum EVEWatchExecApprovalDecision: String, Codable, Sendable, Equatable {
    case allowOnce = "allow-once"
    case deny
}

public enum EVEWatchExecApprovalCloseReason: String, Codable, Sendable, Equatable {
    case expired
    case notFound = "not-found"
    case unavailable
    case replaced
    case resolved
}

public struct EVEWatchAction: Codable, Sendable, Equatable {
    public var id: String
    public var label: String
    public var style: String?

    public init(id: String, label: String, style: String? = nil) {
        self.id = id
        self.label = label
        self.style = style
    }
}

public struct EVEWatchExecApprovalItem: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var commandText: String
    public var commandPreview: String?
    public var host: String?
    public var nodeId: String?
    public var agentId: String?
    public var expiresAtMs: Int?
    public var allowedDecisions: [EVEWatchExecApprovalDecision]
    public var risk: EVEWatchRisk?

    public init(
        id: String,
        commandText: String,
        commandPreview: String? = nil,
        host: String? = nil,
        nodeId: String? = nil,
        agentId: String? = nil,
        expiresAtMs: Int? = nil,
        allowedDecisions: [EVEWatchExecApprovalDecision] = [],
        risk: EVEWatchRisk? = nil)
    {
        self.id = id
        self.commandText = commandText
        self.commandPreview = commandPreview
        self.host = host
        self.nodeId = nodeId
        self.agentId = agentId
        self.expiresAtMs = expiresAtMs
        self.allowedDecisions = allowedDecisions
        self.risk = risk
    }
}

public struct EVEWatchExecApprovalPromptMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var approval: EVEWatchExecApprovalItem
    public var sentAtMs: Int?
    public var deliveryId: String?
    public var resetResolvingState: Bool?

    public init(
        approval: EVEWatchExecApprovalItem,
        sentAtMs: Int? = nil,
        deliveryId: String? = nil,
        resetResolvingState: Bool? = nil)
    {
        self.type = .execApprovalPrompt
        self.approval = approval
        self.sentAtMs = sentAtMs
        self.deliveryId = deliveryId
        self.resetResolvingState = resetResolvingState
    }
}

public struct EVEWatchExecApprovalResolveMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var approvalId: String
    public var decision: EVEWatchExecApprovalDecision
    public var replyId: String
    public var sentAtMs: Int?

    public init(
        approvalId: String,
        decision: EVEWatchExecApprovalDecision,
        replyId: String,
        sentAtMs: Int? = nil)
    {
        self.type = .execApprovalResolve
        self.approvalId = approvalId
        self.decision = decision
        self.replyId = replyId
        self.sentAtMs = sentAtMs
    }
}

public struct EVEWatchExecApprovalResolvedMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var approvalId: String
    public var decision: EVEWatchExecApprovalDecision?
    public var resolvedAtMs: Int?
    public var source: String?

    public init(
        approvalId: String,
        decision: EVEWatchExecApprovalDecision? = nil,
        resolvedAtMs: Int? = nil,
        source: String? = nil)
    {
        self.type = .execApprovalResolved
        self.approvalId = approvalId
        self.decision = decision
        self.resolvedAtMs = resolvedAtMs
        self.source = source
    }
}

public struct EVEWatchExecApprovalExpiredMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var approvalId: String
    public var reason: EVEWatchExecApprovalCloseReason
    public var expiredAtMs: Int?

    public init(
        approvalId: String,
        reason: EVEWatchExecApprovalCloseReason,
        expiredAtMs: Int? = nil)
    {
        self.type = .execApprovalExpired
        self.approvalId = approvalId
        self.reason = reason
        self.expiredAtMs = expiredAtMs
    }
}

public struct EVEWatchExecApprovalSnapshotMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var approvals: [EVEWatchExecApprovalItem]
    public var sentAtMs: Int?
    public var snapshotId: String?

    public init(
        approvals: [EVEWatchExecApprovalItem],
        sentAtMs: Int? = nil,
        snapshotId: String? = nil)
    {
        self.type = .execApprovalSnapshot
        self.approvals = approvals
        self.sentAtMs = sentAtMs
        self.snapshotId = snapshotId
    }
}

public struct EVEWatchExecApprovalSnapshotRequestMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var requestId: String
    public var sentAtMs: Int?

    public init(requestId: String, sentAtMs: Int? = nil) {
        self.type = .execApprovalSnapshotRequest
        self.requestId = requestId
        self.sentAtMs = sentAtMs
    }
}

public struct EVEWatchChatItem: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var role: String
    public var text: String
    public var timestampMs: Int?

    public init(
        id: String,
        role: String,
        text: String,
        timestampMs: Int? = nil)
    {
        self.id = id
        self.role = role
        self.text = text
        self.timestampMs = timestampMs
    }
}

public struct EVEWatchAppSnapshotMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var gatewayStatusText: String
    public var gatewayConnected: Bool
    public var agentName: String
    public var agentAvatarURL: String?
    public var agentAvatarText: String?
    public var sessionKey: String
    public var gatewayStableID: String?
    public var talkStatusText: String
    public var talkEnabled: Bool
    public var talkListening: Bool
    public var talkSpeaking: Bool
    public var pendingApprovalCount: Int
    public var chatItems: [EVEWatchChatItem]?
    public var chatStatusText: String?
    public var sentAtMs: Int?
    public var snapshotId: String?

    public init(
        gatewayStatusText: String,
        gatewayConnected: Bool,
        agentName: String,
        agentAvatarURL: String? = nil,
        agentAvatarText: String? = nil,
        sessionKey: String,
        gatewayStableID: String? = nil,
        talkStatusText: String,
        talkEnabled: Bool,
        talkListening: Bool,
        talkSpeaking: Bool,
        pendingApprovalCount: Int,
        chatItems: [EVEWatchChatItem]? = nil,
        chatStatusText: String? = nil,
        sentAtMs: Int? = nil,
        snapshotId: String? = nil)
    {
        self.type = .appSnapshot
        self.gatewayStatusText = gatewayStatusText
        self.gatewayConnected = gatewayConnected
        self.agentName = agentName
        self.agentAvatarURL = agentAvatarURL
        self.agentAvatarText = agentAvatarText
        self.sessionKey = sessionKey
        self.gatewayStableID = gatewayStableID
        self.talkStatusText = talkStatusText
        self.talkEnabled = talkEnabled
        self.talkListening = talkListening
        self.talkSpeaking = talkSpeaking
        self.pendingApprovalCount = pendingApprovalCount
        self.chatItems = chatItems
        self.chatStatusText = chatStatusText
        self.sentAtMs = sentAtMs
        self.snapshotId = snapshotId
    }
}

public struct EVEWatchAppSnapshotRequestMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var requestId: String
    public var sentAtMs: Int?

    public init(requestId: String, sentAtMs: Int? = nil) {
        self.type = .appSnapshotRequest
        self.requestId = requestId
        self.sentAtMs = sentAtMs
    }
}

public enum EVEWatchAppCommand: String, Codable, Sendable, Equatable {
    case refresh
    case openChat = "open-chat"
    case sendChat = "send-chat"
    case startTalk = "start-talk"
    case stopTalk = "stop-talk"
}

public struct EVEWatchAppCommandMessage: Codable, Sendable, Equatable {
    public var type: EVEWatchPayloadType
    public var command: EVEWatchAppCommand
    public var commandId: String
    public var sessionKey: String?
    public var gatewayStableID: String?
    public var text: String?
    public var sentAtMs: Int?

    public init(
        command: EVEWatchAppCommand,
        commandId: String,
        sessionKey: String? = nil,
        gatewayStableID: String? = nil,
        text: String? = nil,
        sentAtMs: Int? = nil)
    {
        self.type = .appCommand
        self.command = command
        self.commandId = commandId
        self.sessionKey = sessionKey
        self.gatewayStableID = gatewayStableID
        self.text = text
        self.sentAtMs = sentAtMs
    }
}

public struct EVEWatchStatusPayload: Codable, Sendable, Equatable {
    public var supported: Bool
    public var paired: Bool
    public var appInstalled: Bool
    public var reachable: Bool
    public var activationState: String

    public init(
        supported: Bool,
        paired: Bool,
        appInstalled: Bool,
        reachable: Bool,
        activationState: String)
    {
        self.supported = supported
        self.paired = paired
        self.appInstalled = appInstalled
        self.reachable = reachable
        self.activationState = activationState
    }
}

public struct EVEWatchNotifyParams: Codable, Sendable, Equatable {
    public var title: String
    public var body: String
    public var priority: EVENotificationPriority?
    public var promptId: String?
    public var sessionKey: String?
    public var kind: String?
    public var details: String?
    public var expiresAtMs: Int?
    public var risk: EVEWatchRisk?
    public var actions: [EVEWatchAction]?

    public init(
        title: String,
        body: String,
        priority: EVENotificationPriority? = nil,
        promptId: String? = nil,
        sessionKey: String? = nil,
        kind: String? = nil,
        details: String? = nil,
        expiresAtMs: Int? = nil,
        risk: EVEWatchRisk? = nil,
        actions: [EVEWatchAction]? = nil)
    {
        self.title = title
        self.body = body
        self.priority = priority
        self.promptId = promptId
        self.sessionKey = sessionKey
        self.kind = kind
        self.details = details
        self.expiresAtMs = expiresAtMs
        self.risk = risk
        self.actions = actions
    }
}

public struct EVEWatchNotifyPayload: Codable, Sendable, Equatable {
    public var deliveredImmediately: Bool
    public var queuedForDelivery: Bool
    public var transport: String

    public init(deliveredImmediately: Bool, queuedForDelivery: Bool, transport: String) {
        self.deliveredImmediately = deliveredImmediately
        self.queuedForDelivery = queuedForDelivery
        self.transport = transport
    }
}
