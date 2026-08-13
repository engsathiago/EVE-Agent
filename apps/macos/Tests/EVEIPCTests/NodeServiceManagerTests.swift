import Foundation
import Testing
@testable import EVE

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() async throws {
        try await TestIsolation.withUserDefaultsValues(["eve.gatewayProjectRootPath": nil]) {
            let tmp = try makeTempDirForTests()
            CommandResolver.setProjectRoot(tmp.path)

            let evePath = tmp.appendingPathComponent("node_modules/.bin/eve")
            try makeExecutableForTests(at: evePath)

            let start = NodeServiceManager._testServiceCommand(["start"])
            #expect(start == [evePath.path, "node", "start", "--json"])

            let stop = NodeServiceManager._testServiceCommand(["stop"])
            #expect(stop == [evePath.path, "node", "stop", "--json"])
        }
    }
}
