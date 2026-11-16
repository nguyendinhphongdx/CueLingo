import XCTest
@testable import LocalSTT

final class SidecarProtocolTests: XCTestCase {
    func testNewFlagsAreOneShotModes() {
        XCTAssertEqual(SidecarMode.parse(["--request-microphone"]), .requestMicrophone)
        XCTAssertEqual(SidecarMode.parse(["--prewarm"]), .prewarm)
        XCTAssertEqual(SidecarMode.parse(["--model-status"]), .modelStatus)
        for mode in [SidecarMode.requestMicrophone, .prewarm, .modelStatus, .permissions, .checkSystemAudio] {
            XCTAssertTrue(mode.isOneShot)
        }
    }

    func testExistingFlagsStillParse() {
        XCTAssertEqual(SidecarMode.parse(["--permissions"]), .permissions)
        XCTAssertEqual(SidecarMode.parse(["--check-system-audio"]), .checkSystemAudio)
        XCTAssertEqual(SidecarMode.parse(["--calendar-events"]), .calendar("--calendar-events"))
        XCTAssertEqual(SidecarMode.parse(["--file", "a.wav"]), .file("a.wav"))
    }

    func testNoFlagIsAMeeting() {
        XCTAssertEqual(SidecarMode.parse([]), .meeting)
        XCTAssertFalse(SidecarMode.meeting.isOneShot)
        XCTAssertEqual(SidecarMode.parse(["--file"]), .meeting)  // a --file without a path is not a mode
    }

    func testMicStatusMessagesAreTheStringsTheAppMatches() {
        XCTAssertEqual(MicStatusMessage.denied, "microphone: not authorized (denied)")
        XCTAssertEqual(MicStatusMessage.undetermined, "microphone: not authorized (undetermined)")
        XCTAssertEqual(MicStatusMessage.authorized, "microphone: authorized")
    }

    func testSystemAudioProbeThreshold() {
        XCTAssertFalse(SystemAudioProbe.heard(peak: 200))
        XCTAssertTrue(SystemAudioProbe.heard(peak: 201))
        XCTAssertEqual(SystemAudioProbe.timeoutSeconds, 12)
        XCTAssertEqual(SystemAudioProbe.pingEverySeconds, 2)
    }
}
