package ai.eve.app.node

import ai.eve.app.protocol.EVECalendarCommand
import ai.eve.app.protocol.EVECallLogCommand
import ai.eve.app.protocol.EVECameraCommand
import ai.eve.app.protocol.EVECapability
import ai.eve.app.protocol.EVEContactsCommand
import ai.eve.app.protocol.EVEDeviceCommand
import ai.eve.app.protocol.EVELocationCommand
import ai.eve.app.protocol.EVEMotionCommand
import ai.eve.app.protocol.EVENotificationsCommand
import ai.eve.app.protocol.EVEPhotosCommand
import ai.eve.app.protocol.EVESmsCommand
import ai.eve.app.protocol.EVESystemCommand
import ai.eve.app.protocol.EVETalkCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      EVECapability.Canvas.rawValue,
      EVECapability.Device.rawValue,
      EVECapability.Notifications.rawValue,
      EVECapability.System.rawValue,
      EVECapability.Talk.rawValue,
      EVECapability.Contacts.rawValue,
      EVECapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      EVECapability.Camera.rawValue,
      EVECapability.Location.rawValue,
      EVECapability.Sms.rawValue,
      EVECapability.CallLog.rawValue,
      EVECapability.VoiceWake.rawValue,
      EVECapability.Motion.rawValue,
      EVECapability.Photos.rawValue,
    )

  private val coreCommands =
    setOf(
      EVEDeviceCommand.Status.rawValue,
      EVEDeviceCommand.Info.rawValue,
      EVEDeviceCommand.Permissions.rawValue,
      EVEDeviceCommand.Health.rawValue,
      EVENotificationsCommand.List.rawValue,
      EVENotificationsCommand.Actions.rawValue,
      EVESystemCommand.Notify.rawValue,
      EVETalkCommand.PttStart.rawValue,
      EVETalkCommand.PttStop.rawValue,
      EVETalkCommand.PttCancel.rawValue,
      EVETalkCommand.PttOnce.rawValue,
      EVEContactsCommand.Search.rawValue,
      EVEContactsCommand.Add.rawValue,
      EVECalendarCommand.Events.rawValue,
      EVECalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      EVECameraCommand.Snap.rawValue,
      EVECameraCommand.Clip.rawValue,
      EVECameraCommand.List.rawValue,
      EVELocationCommand.Get.rawValue,
      EVEMotionCommand.Activity.rawValue,
      EVEMotionCommand.Pedometer.rawValue,
      EVESmsCommand.Send.rawValue,
      EVESmsCommand.Search.rawValue,
      EVECallLogCommand.Search.rawValue,
      EVEPhotosCommand.Latest.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesDeviceAppsOnlyWhenUserOptedIn() {
    val disabled = InvokeCommandRegistry.advertisedCommands(defaultFlags(installedAppsSharingEnabled = false))
    val enabled = InvokeCommandRegistry.advertisedCommands(defaultFlags(installedAppsSharingEnabled = true))

    assertFalse(disabled.contains(EVEDeviceCommand.Apps.rawValue))
    assertTrue(enabled.contains(EVEDeviceCommand.Apps.rawValue))
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          smsSearchPossible = false,
          callLogAvailable = false,
          photosAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          installedAppsSharingEnabled = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(EVEMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(EVEMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true, smsSearchPossible = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCommands.contains(EVESmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(EVESmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(EVESmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(EVESmsCommand.Search.rawValue))
    assertTrue(requestableSearchCommands.contains(EVESmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCapabilities.contains(EVECapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(EVECapability.Sms.rawValue))
    assertFalse(requestableSearchCapabilities.contains(EVECapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(EVECallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(EVECapability.CallLog.rawValue))
  }

  @Test
  fun advertisedPhotosSurface_respectsFeatureAvailability() {
    val disabledFlags = defaultFlags(photosAvailable = false)
    val enabledFlags = defaultFlags(photosAvailable = true)

    assertFalse(InvokeCommandRegistry.advertisedCapabilities(disabledFlags).contains(EVECapability.Photos.rawValue))
    assertFalse(InvokeCommandRegistry.advertisedCommands(disabledFlags).contains(EVEPhotosCommand.Latest.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCapabilities(enabledFlags).contains(EVECapability.Photos.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCommands(enabledFlags).contains(EVEPhotosCommand.Latest.rawValue))
  }

  @Test
  fun advertisedCapabilities_includesVoiceWakeWithoutAdvertisingCommands() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(voiceWakeEnabled = true))
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(voiceWakeEnabled = true))

    assertTrue(capabilities.contains(EVECapability.VoiceWake.rawValue))
    assertFalse(commands.any { it.contains("voice", ignoreCase = true) })
  }

  @Test
  fun find_returnsForegroundMetadataForCameraCommands() {
    val list = InvokeCommandRegistry.find(EVECameraCommand.List.rawValue)
    val location = InvokeCommandRegistry.find(EVELocationCommand.Get.rawValue)

    assertNotNull(list)
    assertEquals(true, list?.requiresForeground)
    assertNotNull(location)
    assertEquals(false, location?.requiresForeground)
  }

  @Test
  fun find_returnsNullForUnknownCommand() {
    assertNull(InvokeCommandRegistry.find("not.real"))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    photosAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    installedAppsSharingEnabled: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      smsSearchPossible = smsSearchPossible,
      callLogAvailable = callLogAvailable,
      photosAvailable = photosAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      installedAppsSharingEnabled = installedAppsSharingEnabled,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(
    actual: List<String>,
    expected: Set<String>,
  ) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(
    actual: List<String>,
    forbidden: Set<String>,
  ) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
