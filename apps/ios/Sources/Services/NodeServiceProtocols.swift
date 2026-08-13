import CoreLocation
import Foundation
import EVEKit
import UIKit

typealias EVECameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias EVECameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: EVECameraSnapParams) async throws -> EVECameraSnapResult
    func clip(params: EVECameraClipParams) async throws -> EVECameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: EVELocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: EVELocationGetParams,
        desiredAccuracy: EVELocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> EVEDeviceStatusPayload
    func info() -> EVEDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: EVEPhotosLatestParams) async throws -> EVEPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: EVEContactsSearchParams) async throws -> EVEContactsSearchPayload
    func add(params: EVEContactsAddParams) async throws -> EVEContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: EVECalendarEventsParams) async throws -> EVECalendarEventsPayload
    func add(params: EVECalendarAddParams) async throws -> EVECalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: EVERemindersListParams) async throws -> EVERemindersListPayload
    func add(params: EVERemindersAddParams) async throws -> EVERemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: EVEMotionActivityParams) async throws -> EVEMotionActivityPayload
    func pedometer(params: EVEPedometerParams) async throws -> EVEPedometerPayload
}

struct WatchMessagingStatus: Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Equatable {
    var replyId: String
    var approvalId: String
    var decision: EVEWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchAppSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchAppCommandEvent: Codable, Equatable {
    var commandId: String
    var command: EVEWatchAppCommand
    var sessionKey: String?
    var gatewayStableID: String?
    var text: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func setAppSnapshotRequestHandler(_ handler: (@Sendable (WatchAppSnapshotRequestEvent) -> Void)?)
    func setAppCommandHandler(_ handler: (@Sendable (WatchAppCommandEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: EVEWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: EVEWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: EVEWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: EVEWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: EVEWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
    func syncAppSnapshot(
        _ message: EVEWatchAppSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
