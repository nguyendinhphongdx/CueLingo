/// The sidecar's command line and the fixed status messages its parent matches on. Pure, so `swift test`
/// covers it; `main.swift` only acts on what this returns. Protocol: scaffold/07-native-swift.md.
public enum SidecarMode: Equatable {
    case permissions
    case requestMicrophone
    case checkSystemAudio
    case calendar(String)
    /// Download (if needed), verify and compile the model for `CUELINGO_LANGUAGE`, then exit.
    case prewarm
    /// Say whether the model for `CUELINGO_LANGUAGE` is on this machine, then exit. Loads and downloads nothing.
    case modelStatus
    case file(String)
    case meeting

    public static func parse(_ args: [String]) -> SidecarMode {
        if args.contains("--permissions") { return .permissions }
        if args.contains("--request-microphone") { return .requestMicrophone }
        if let calendar = args.first(where: { $0.hasPrefix("--calendar-") }) { return .calendar(calendar) }
        if args.contains("--check-system-audio") { return .checkSystemAudio }
        if args.contains("--prewarm") { return .prewarm }
        if args.contains("--model-status") { return .modelStatus }
        if let flag = args.firstIndex(of: "--file"), flag + 1 < args.count { return .file(args[flag + 1]) }
        return .meeting
    }

    /// Modes that answer once and exit without a meeting; none of them prints the "loading" status.
    public var isOneShot: Bool { self != .meeting }
}

/// The `status` messages about the microphone. The TypeScript side matches these exact strings
/// (`micPermissionOf` in apps/desktop/src/session/capture-problems.ts); change both together.
public enum MicStatusMessage {
    public static let denied = "microphone: not authorized (denied)"
    public static let undetermined = "microphone: not authorized (undetermined)"
    public static let authorized = "microphone: authorized"
}

/// The `--check-system-audio` probe: macOS cannot report this permission, so a short sound is played and the
/// tap has to hear it. The first run waits for the permission dialog, so the probe retries for a while.
public enum SystemAudioProbe {
    public static let timeoutSeconds = 12
    public static let pingEverySeconds = 2
    /// Int16 peak above which the tap counts as having heard the sound.
    public static let heardPeak = 200

    public static func heard(peak: Int) -> Bool { peak > heardPeak }
}
