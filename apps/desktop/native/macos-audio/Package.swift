// swift-tools-version:6.0
import PackageDescription

let v5: [SwiftSetting] = [.swiftLanguageMode(.v5)]

let package = Package(
    name: "MacOSAudio",
    platforms: [.macOS("14.2")],
    products: [
        .library(name: "AudioCapture", targets: ["AudioCapture"]),
        .executable(name: "cuelingo-audio", targets: ["Sidecar"]),
        .executable(name: "cuelingo-audio-spike", targets: ["Spike"]),
    ],
    dependencies: [
        .package(url: "https://github.com/FluidInference/FluidAudio.git", from: "0.18.0")
    ],
    targets: [
        .target(name: "AudioCapture", swiftSettings: v5),
        .target(
            name: "LocalSTT",
            dependencies: [.product(name: "FluidAudio", package: "FluidAudio")],
            swiftSettings: v5),
        .executableTarget(name: "Spike", dependencies: ["AudioCapture"], swiftSettings: v5),
        .executableTarget(
            name: "Sidecar", dependencies: ["AudioCapture", "LocalSTT"], swiftSettings: v5),
        .testTarget(name: "AudioCaptureTests", dependencies: ["AudioCapture"], swiftSettings: v5),
        .testTarget(name: "LocalSTTTests", dependencies: ["LocalSTT"], swiftSettings: v5),
    ]
)
