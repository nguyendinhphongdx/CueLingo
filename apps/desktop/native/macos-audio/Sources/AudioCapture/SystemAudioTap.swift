import AVFoundation
import CoreAudio

public enum CaptureError: Error, CustomStringConvertible {
    case coreAudio(String, OSStatus)
    case format(String)

    public var description: String {
        switch self {
        case .coreAudio(let what, let status): return "\(what) failed (OSStatus \(status))"
        case .format(let what): return what
        }
    }
}

/// Captures everything the Mac plays (the other people in a call) through a Core Audio process tap.
/// Needs macOS 14.2+ and the "System Audio Recording" permission.
public final class SystemAudioTap {
    private var tapID = AudioObjectID(kAudioObjectUnknown)
    private var aggregateID = AudioObjectID(kAudioObjectUnknown)
    private var procID: AudioDeviceIOProcID?
    private let queue = DispatchQueue(label: "cuelingo.system-tap", qos: .userInteractive)

    public init() {}

    /// `onSamples` is called on an audio queue with 16 kHz mono Int16 samples.
    public func start(onSamples: @escaping @Sendable ([Int16]) -> Void) throws {
        let description = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
        description.name = "CueLingo system audio"
        description.isPrivate = true
        description.muteBehavior = .unmuted

        var status = AudioHardwareCreateProcessTap(description, &tapID)
        guard status == noErr else { throw CaptureError.coreAudio("AudioHardwareCreateProcessTap", status) }

        let outputUID = try Self.defaultOutputUID()
        let aggregate: [String: Any] = [
            kAudioAggregateDeviceNameKey: "CueLingo tap",
            kAudioAggregateDeviceUIDKey: UUID().uuidString,
            kAudioAggregateDeviceMainSubDeviceKey: outputUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceIsStackedKey: false,
            kAudioAggregateDeviceTapAutoStartKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outputUID]],
            kAudioAggregateDeviceTapListKey: [
                [
                    kAudioSubTapDriftCompensationKey: true,
                    kAudioSubTapUIDKey: description.uuid.uuidString,
                ]
            ],
        ]
        status = AudioHardwareCreateAggregateDevice(aggregate as CFDictionary, &aggregateID)
        guard status == noErr else { throw CaptureError.coreAudio("AudioHardwareCreateAggregateDevice", status) }

        var asbd = try Self.tapFormat(tapID)
        guard let format = AVAudioFormat(streamDescription: &asbd),
            let resampler = Resampler(from: format)
        else { throw CaptureError.format("unsupported tap format") }

        status = AudioDeviceCreateIOProcIDWithBlock(&procID, aggregateID, queue) { _, input, _, _, _ in
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, bufferListNoCopy: input) else { return }
            let samples = resampler.convert(buffer)
            if !samples.isEmpty { onSamples(samples) }
        }
        guard status == noErr else { throw CaptureError.coreAudio("AudioDeviceCreateIOProcIDWithBlock", status) }
        status = AudioDeviceStart(aggregateID, procID)
        guard status == noErr else { throw CaptureError.coreAudio("AudioDeviceStart", status) }
    }

    public func stop() {
        if let procID {
            AudioDeviceStop(aggregateID, procID)
            AudioDeviceDestroyIOProcID(aggregateID, procID)
        }
        if aggregateID != kAudioObjectUnknown { AudioHardwareDestroyAggregateDevice(aggregateID) }
        if tapID != kAudioObjectUnknown { AudioHardwareDestroyProcessTap(tapID) }
        procID = nil
        aggregateID = AudioObjectID(kAudioObjectUnknown)
        tapID = AudioObjectID(kAudioObjectUnknown)
    }

    private static func defaultOutputUID() throws -> String {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultSystemOutputDevice,
            mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var device = AudioObjectID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        var status = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &device)
        guard status == noErr else { throw CaptureError.coreAudio("default output device", status) }

        address.mSelector = kAudioDevicePropertyDeviceUID
        var uid: Unmanaged<CFString>?
        size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        status = AudioObjectGetPropertyData(device, &address, 0, nil, &size, &uid)
        guard status == noErr, let uid else { throw CaptureError.coreAudio("output device UID", status) }
        return uid.takeRetainedValue() as String
    }

    private static func tapFormat(_ tap: AudioObjectID) throws -> AudioStreamBasicDescription {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioTapPropertyFormat,
            mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var asbd = AudioStreamBasicDescription()
        var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        let status = AudioObjectGetPropertyData(tap, &address, 0, nil, &size, &asbd)
        guard status == noErr else { throw CaptureError.coreAudio("tap format", status) }
        return asbd
    }
}
