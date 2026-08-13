import Foundation

public enum EVEAppGroup {
    public static let canonicalIdentifier = "group.ai.evefoundation.app.shared"

    public static var identifier: String {
        let raw = Bundle.main.object(forInfoDictionaryKey: "EVEAppGroupIdentifier") as? String
        let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? self.canonicalIdentifier : trimmed
    }
}
