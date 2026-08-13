import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-eve writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.eve.mac"
let gatewayLaunchdLabel = "ai.eve.gateway"
let onboardingVersionKey = "eve.onboardingVersion"
let onboardingSeenKey = "eve.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "eve.pauseEnabled"
let iconAnimationsEnabledKey = "eve.iconAnimationsEnabled"
let swabbleEnabledKey = "eve.swabbleEnabled"
let swabbleTriggersKey = "eve.swabbleTriggers"
let voiceWakeTriggerChimeKey = "eve.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "eve.voiceWakeSendChime"
let showDockIconKey = "eve.showDockIcon"
let defaultVoiceWakeTriggers = ["eve"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "eve.voiceWakeMicID"
let voiceWakeMicNameKey = "eve.voiceWakeMicName"
let voiceWakeLocaleKey = "eve.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "eve.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "eve.voicePushToTalkEnabled"
let voiceWakeTriggersTalkModeKey = "eve.voiceWakeTriggersTalkMode"
let talkEnabledKey = "eve.talkEnabled"
let talkPhaseSoundsEnabledKey = "eve.talkPhaseSoundsEnabled"
let talkShiftToStopEnabledKey = "eve.talkShiftToStopEnabled"
let iconOverrideKey = "eve.iconOverride"
let connectionModeKey = "eve.connectionMode"
let remoteTargetKey = "eve.remoteTarget"
let remoteIdentityKey = "eve.remoteIdentity"
let remoteProjectRootKey = "eve.remoteProjectRoot"
let remoteCliPathKey = "eve.remoteCliPath"
let canvasEnabledKey = "eve.canvasEnabled"
let cameraEnabledKey = "eve.cameraEnabled"
let systemRunPolicyKey = "eve.systemRunPolicy"
let systemRunAllowlistKey = "eve.systemRunAllowlist"
let systemRunEnabledKey = "eve.systemRunEnabled"
let locationModeKey = "eve.locationMode"
let locationPreciseKey = "eve.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "eve.peekabooBridgeEnabled"
let deepLinkKeyKey = "eve.deepLinkKey"
let cliInstallPromptedVersionKey = "eve.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "eve.heartbeatsEnabled"
let debugPaneEnabledKey = "eve.debugPaneEnabled"
let debugFileLogEnabledKey = "eve.debug.fileLogEnabled"
let appLogLevelKey = "eve.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
