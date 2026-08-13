// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "EVEKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "EVEProtocol", targets: ["EVEProtocol"]),
        .library(name: "EVEKit", targets: ["EVEKit"]),
        .library(name: "EVEChatUI", targets: ["EVEChatUI"]),
    ],
    traits: [
        .trait(name: "Talk", description: "ElevenLabs cloud TTS / talk support"),
        .default(enabledTraits: ["Talk"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.1"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "EVEProtocol",
            path: "Sources/EVEProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "EVEKit",
            dependencies: [
                "EVEProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit", condition: .when(traits: ["Talk"])),
            ],
            path: "Sources/EVEKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "EVEChatUI",
            dependencies: [
                "EVEKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/EVEChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "EVEKitTests",
            dependencies: ["EVEKit", "EVEChatUI"],
            path: "Tests/EVEKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
