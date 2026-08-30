// swift-tools-version: 6.2
// Package manifest for the EVE macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "EVE",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "EVEIPC", targets: ["EVEIPC"]),
        .library(name: "EVEDiscovery", targets: ["EVEDiscovery"]),
        .executable(name: "EVE", targets: ["EVE"]),
        .executable(name: "eve-mac", targets: ["EVEMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "1.0.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", exact: "3.5.2"),
        .package(path: "../shared/EVEKit"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "EVEIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "EVEDiscovery",
            dependencies: [
                .product(name: "EVEKit", package: "EVEKit"),
            ],
            path: "Sources/EVEDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "EVE",
            dependencies: [
                "EVEIPC",
                "EVEDiscovery",
                .product(name: "EVEKit", package: "EVEKit"),
                .product(name: "EVEChatUI", package: "EVEKit"),
                .product(name: "EVEProtocol", package: "EVEKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/EVE.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "EVEMacCLI",
            dependencies: [
                "EVEDiscovery",
                .product(name: "EVEKit", package: "EVEKit"),
                .product(name: "EVEProtocol", package: "EVEKit"),
            ],
            path: "Sources/EVEMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "EVEIPCTests",
            dependencies: [
                "EVEIPC",
                "EVE",
                "EVEMacCLI",
                "EVEDiscovery",
                .product(name: "EVEProtocol", package: "EVEKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
