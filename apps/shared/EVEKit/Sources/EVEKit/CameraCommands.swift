import Foundation

public enum EVECameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum EVECameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum EVECameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum EVECameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct EVECameraSnapParams: Codable, Sendable, Equatable {
    public var facing: EVECameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: EVECameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: EVECameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: EVECameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct EVECameraClipParams: Codable, Sendable, Equatable {
    public var facing: EVECameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: EVECameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: EVECameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: EVECameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
