import EventKit
import Foundation

/// Reads upcoming calendar events on this machine so the app can suggest a meeting language.
/// Nothing is stored or sent: attendee addresses are cut down to their domain here and the app uses the
/// result right away.
public enum CalendarEvents {
    public enum Access: String, Sendable {
        case granted, denied, undetermined
    }

    public struct Item: Sendable {
        public let title: String
        public let startMs: Int
        public let endMs: Int
        public let location: String
        public let attendeeDomains: [String]
    }

    public static func access() -> Access {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess: return .granted
        case .notDetermined: return .undetermined
        default: return .denied  // denied, restricted, or write-only (cannot read events)
        }
    }

    /// Asks macOS for read access; the system shows its own prompt the first time.
    public static func request() async -> Access {
        guard access() == .undetermined else { return access() }
        let store = EKEventStore()
        _ = try? await store.requestFullAccessToEvents()
        return access()
    }

    /// The domain part of an attendee's address: `x@acme.co.jp` gives `acme.co.jp`.
    static func domain(ofAddress address: String) -> String? {
        let cleaned = address.replacingOccurrences(of: "mailto:", with: "")
        guard let at = cleaned.lastIndex(of: "@") else { return nil }
        let domain = cleaned[cleaned.index(after: at)...].lowercased()
        return domain.isEmpty ? nil : String(domain)
    }

    /// Events that are on now or start within `minutesAhead`, skipping all-day entries.
    public static func upcoming(minutesAhead: Int = 120, now: Date = Date()) -> [Item] {
        guard access() == .granted else { return [] }
        let store = EKEventStore()
        let predicate = store.predicateForEvents(
            withStart: now.addingTimeInterval(-30 * 60),
            end: now.addingTimeInterval(Double(minutesAhead) * 60), calendars: nil)
        return store.events(matching: predicate)
            .filter { !$0.isAllDay && $0.endDate > now }
            .sorted { $0.startDate < $1.startDate }
            .prefix(10)
            .map { event in
                let domains = Set(
                    (event.attendees ?? []).compactMap { domain(ofAddress: $0.url.absoluteString) })
                return Item(
                    title: event.title ?? "",
                    startMs: Int(event.startDate.timeIntervalSince1970 * 1000),
                    endMs: Int(event.endDate.timeIntervalSince1970 * 1000),
                    location: event.location ?? "",
                    attendeeDomains: domains.sorted())
            }
    }
}
