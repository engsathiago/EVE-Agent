import Foundation

public enum EVERemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum EVEReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct EVERemindersListParams: Codable, Sendable, Equatable {
    public var status: EVEReminderStatusFilter?
    public var limit: Int?

    public init(status: EVEReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct EVERemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct EVEReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct EVERemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [EVEReminderPayload]

    public init(reminders: [EVEReminderPayload]) {
        self.reminders = reminders
    }
}

public struct EVERemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: EVEReminderPayload

    public init(reminder: EVEReminderPayload) {
        self.reminder = reminder
    }
}
