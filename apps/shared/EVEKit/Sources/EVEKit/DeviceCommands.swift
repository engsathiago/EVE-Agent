import Foundation

public enum EVEDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum EVEBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum EVEThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum EVENetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum EVENetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct EVEBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: EVEBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: EVEBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct EVEThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: EVEThermalState

    public init(state: EVEThermalState) {
        self.state = state
    }
}

public struct EVEStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct EVENetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: EVENetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [EVENetworkInterfaceType]

    public init(
        status: EVENetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [EVENetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct EVEDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: EVEBatteryStatusPayload
    public var thermal: EVEThermalStatusPayload
    public var storage: EVEStorageStatusPayload
    public var network: EVENetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: EVEBatteryStatusPayload,
        thermal: EVEThermalStatusPayload,
        storage: EVEStorageStatusPayload,
        network: EVENetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct EVEDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
