import Foundation

public enum EVELocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}
