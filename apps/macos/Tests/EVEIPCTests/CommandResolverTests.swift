import Darwin
import Foundation
import Testing
@testable import EVE

@Suite(.serialized) struct CommandResolverTests {
    private func makeDefaults() -> UserDefaults {
        // Use a unique suite to avoid cross-suite concurrency on UserDefaults.standard.
        UserDefaults(suiteName: "CommandResolverTests.\(UUID().uuidString)")!
    }

    private func makeLocalDefaults() -> UserDefaults {
        let defaults = self.makeDefaults()
        defaults.set(AppState.ConnectionMode.local.rawValue, forKey: connectionModeKey)
        return defaults
    }

    private func makeProjectRootWithPnpm() throws -> (tmp: URL, pnpmPath: URL) {
        let tmp = try makeTempDirForTests()
        let pnpmPath = tmp.appendingPathComponent("node_modules/.bin/pnpm")
        try makeExecutableForTests(at: pnpmPath)
        return (tmp, pnpmPath)
    }

    @Test func `prefers open claw binary`() throws {
        let defaults = self.makeLocalDefaults()

        let tmp = try makeTempDirForTests()

        let evePath = tmp.appendingPathComponent("node_modules/.bin/eve")
        try makeExecutableForTests(at: evePath)

        let searchPaths = [tmp.appendingPathComponent("node_modules/.bin").path]
        let cmd = CommandResolver.eveCommand(
            subcommand: "gateway",
            defaults: defaults,
            configRoot: [:],
            searchPaths: searchPaths,
            projectRoot: tmp)
        #expect(cmd.prefix(2).elementsEqual([evePath.path, "gateway"]))
    }

    @Test func `falls back to node and script`() throws {
        let defaults = self.makeLocalDefaults()

        let tmp = try makeTempDirForTests()

        let nodePath = tmp.appendingPathComponent("node_modules/.bin/node")
        let scriptPath = tmp.appendingPathComponent("bin/eve.js")
        try makeExecutableForTests(at: nodePath)
        try "#!/bin/sh\necho v22.19.0\n".write(to: nodePath, atomically: true, encoding: .utf8)
        try FileManager().setAttributes([.posixPermissions: 0o755], ofItemAtPath: nodePath.path)
        try makeExecutableForTests(at: scriptPath)

        let cmd = CommandResolver.eveCommand(
            subcommand: "rpc",
            defaults: defaults,
            configRoot: [:],
            searchPaths: [tmp.appendingPathComponent("node_modules/.bin").path],
            projectRoot: tmp)

        #expect(cmd.count >= 3)
        if cmd.count >= 3 {
            #expect(cmd[0] == nodePath.path)
            #expect(cmd[1] == scriptPath.path)
            #expect(cmd[2] == "rpc")
        }
    }

    @Test func `prefers open claw binary over pnpm`() throws {
        let defaults = self.makeLocalDefaults()

        let tmp = try makeTempDirForTests()

        let binDir = tmp.appendingPathComponent("bin")
        let evePath = binDir.appendingPathComponent("eve")
        let pnpmPath = binDir.appendingPathComponent("pnpm")
        try makeExecutableForTests(at: evePath)
        try makeExecutableForTests(at: pnpmPath)

        let cmd = CommandResolver.eveCommand(
            subcommand: "rpc",
            defaults: defaults,
            configRoot: [:],
            searchPaths: [binDir.path],
            projectRoot: tmp)

        #expect(cmd.prefix(2).elementsEqual([evePath.path, "rpc"]))
    }

    @Test func `uses open claw binary without node runtime`() throws {
        let defaults = self.makeLocalDefaults()

        let tmp = try makeTempDirForTests()

        let binDir = tmp.appendingPathComponent("bin")
        let evePath = binDir.appendingPathComponent("eve")
        try makeExecutableForTests(at: evePath)

        let cmd = CommandResolver.eveCommand(
            subcommand: "gateway",
            defaults: defaults,
            configRoot: [:],
            searchPaths: [binDir.path],
            projectRoot: tmp)

        #expect(cmd.prefix(2).elementsEqual([evePath.path, "gateway"]))
    }

    @Test func `falls back to pnpm`() throws {
        let defaults = self.makeLocalDefaults()
        let (tmp, pnpmPath) = try self.makeProjectRootWithPnpm()

        let cmd = CommandResolver.eveCommand(
            subcommand: "rpc",
            defaults: defaults,
            configRoot: [:],
            searchPaths: [tmp.appendingPathComponent("node_modules/.bin").path])

        #expect(cmd.prefix(4).elementsEqual([pnpmPath.path, "--silent", "eve", "rpc"]))
    }

    @Test func `pnpm keeps extra args after subcommand`() throws {
        let defaults = self.makeLocalDefaults()
        let (tmp, pnpmPath) = try self.makeProjectRootWithPnpm()

        let cmd = CommandResolver.eveCommand(
            subcommand: "health",
            extraArgs: ["--json", "--timeout", "5"],
            defaults: defaults,
            configRoot: [:],
            searchPaths: [tmp.appendingPathComponent("node_modules/.bin").path])

        #expect(cmd.prefix(5).elementsEqual([pnpmPath.path, "--silent", "eve", "health", "--json"]))
        #expect(cmd.suffix(2).elementsEqual(["--timeout", "5"]))
    }

    @Test func `preferred paths start with project node bins`() throws {
        let tmp = try makeTempDirForTests()

        let first = CommandResolver.preferredPaths(
            home: FileManager().homeDirectoryForCurrentUser,
            current: [],
            projectRoot: tmp).first
        #expect(first == tmp.appendingPathComponent("node_modules/.bin").path)
    }

    @Test func `builds SSH command for remote mode`() {
        let defaults = self.makeDefaults()
        defaults.set(AppState.ConnectionMode.remote.rawValue, forKey: connectionModeKey)
        defaults.set("eve@example.com:2222", forKey: remoteTargetKey)
        defaults.set("/tmp/id_ed25519", forKey: remoteIdentityKey)
        defaults.set("/srv/eve", forKey: remoteProjectRootKey)

        let cmd = CommandResolver.eveCommand(
            subcommand: "status",
            extraArgs: ["--json"],
            defaults: defaults,
            configRoot: [:])

        #expect(cmd.first == "/usr/bin/ssh")
        if let marker = cmd.firstIndex(of: "--") {
            #expect(cmd[marker + 1] == "eve@example.com")
        } else {
            #expect(Bool(false))
        }
        #expect(cmd.contains("StrictHostKeyChecking=yes"))
        #expect(!cmd.contains("StrictHostKeyChecking=accept-new"))
        #expect(cmd.contains("UpdateHostKeys=yes"))
        #expect(cmd.contains("-i"))
        #expect(cmd.contains("/tmp/id_ed25519"))
        if let script = cmd.last {
            #expect(script.contains("PRJ='/srv/eve'"))
            #expect(script.contains("cd \"$PRJ\""))
            #expect(script.contains("eve"))
            #expect(script.contains("status"))
            #expect(script.contains("--json"))
            #expect(script.contains("CLI="))
        }
    }

    @Test func `empty remote defaults fall back to config remote values`() {
        let defaults = self.makeDefaults()
        defaults.set(AppState.ConnectionMode.remote.rawValue, forKey: connectionModeKey)
        defaults.set(" ", forKey: remoteTargetKey)
        defaults.set("", forKey: remoteIdentityKey)

        let settings = CommandResolver.connectionSettings(
            defaults: defaults,
            configRoot: [
                "gateway": [
                    "mode": "remote",
                    "remote": [
                        "sshTarget": "alice@gateway.local",
                        "sshIdentity": "/tmp/config-id",
                    ],
                ],
            ])

        #expect(settings.target == "alice@gateway.local")
        #expect(settings.identity == "/tmp/config-id")
    }

    @Test func `rejects unsafe SSH targets`() {
        #expect(CommandResolver.parseSSHTarget("-oProxyCommand=calc") == nil)
        #expect(CommandResolver.parseSSHTarget("host:-oProxyCommand=calc") == nil)
        #expect(CommandResolver.parseSSHTarget("user@host:2222")?.port == 2222)
    }

    @Test func `config root local overrides remote defaults`() throws {
        let defaults = self.makeDefaults()
        defaults.set(AppState.ConnectionMode.remote.rawValue, forKey: connectionModeKey)
        defaults.set("eve@example.com:2222", forKey: remoteTargetKey)

        let tmp = try makeTempDirForTests()

        let evePath = tmp.appendingPathComponent("node_modules/.bin/eve")
        try makeExecutableForTests(at: evePath)

        let cmd = CommandResolver.eveCommand(
            subcommand: "daemon",
            defaults: defaults,
            configRoot: ["gateway": ["mode": "local"]],
            searchPaths: [tmp.appendingPathComponent("node_modules/.bin").path],
            projectRoot: tmp)

        #expect(cmd.first == evePath.path)
        #expect(cmd.count >= 2)
        if cmd.count >= 2 {
            #expect(cmd[1] == "daemon")
        }
    }

    @Test func `remote settings fall back to config ssh target`() {
        let defaults = self.makeDefaults()
        let settings = CommandResolver.connectionSettings(
            defaults: defaults,
            configRoot: [
                "gateway": [
                    "mode": "remote",
                    "remote": [
                        "sshTarget": "alice@gateway.example:2222",
                        "sshIdentity": "/tmp/id_ed25519",
                    ],
                ],
            ])

        #expect(settings.mode == .remote)
        #expect(settings.target == "alice@gateway.example:2222")
        #expect(settings.identity == "/tmp/id_ed25519")
    }
}
