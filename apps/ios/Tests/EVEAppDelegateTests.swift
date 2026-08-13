import Foundation
import Testing
@testable import EVE

@Suite(.serialized) struct EVEAppDelegateTests {
    @Test @MainActor func `resolves registry model before view task assigns delegate model`() {
        let registryModel = NodeAppModel()
        EVEAppModelRegistry.appModel = registryModel
        defer { EVEAppModelRegistry.appModel = nil }

        let delegate = EVEAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func `prefers explicit delegate model over registry fallback`() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        EVEAppModelRegistry.appModel = registryModel
        defer { EVEAppModelRegistry.appModel = nil }

        let delegate = EVEAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }

    @Test @MainActor func `derives background refresh task identifier from app bundle identifier`() {
        let delegate = EVEAppDelegate()
        let bundleIdentifier = Bundle.main.bundleIdentifier ?? "ai.evefoundation.app.tests"

        #expect(delegate._test_wakeRefreshTaskIdentifier() == "\(bundleIdentifier).bgrefresh")
    }
}
