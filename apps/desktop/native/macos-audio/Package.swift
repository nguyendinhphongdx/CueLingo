// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "MacOSAudio",
    platforms: [.macOS("14.2")],
    products: [
        .library(name: "AudioCapture", targets: ["AudioCapture"]),
        .executable(name: "cuelingo-audio-spike", targets: ["Spike"]),
    ],
    targets: [
        .target(name: "AudioCapture"),
        .target(name: "LocalSTT"),
        .executableTarget(name: "Spike", dependencies: ["AudioCapture"]),
        .testTarget(name: "AudioCaptureTests", dependencies: ["AudioCapture"]),
    ]
)
