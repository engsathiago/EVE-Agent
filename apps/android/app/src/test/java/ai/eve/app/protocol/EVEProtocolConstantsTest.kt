package ai.eve.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class EVEProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", EVECanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", EVECanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", EVECanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", EVECanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", EVECanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", EVECanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", EVECanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", EVECanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", EVECapability.Canvas.rawValue)
    assertEquals("camera", EVECapability.Camera.rawValue)
    assertEquals("voiceWake", EVECapability.VoiceWake.rawValue)
    assertEquals("talk", EVECapability.Talk.rawValue)
    assertEquals("location", EVECapability.Location.rawValue)
    assertEquals("sms", EVECapability.Sms.rawValue)
    assertEquals("device", EVECapability.Device.rawValue)
    assertEquals("notifications", EVECapability.Notifications.rawValue)
    assertEquals("system", EVECapability.System.rawValue)
    assertEquals("photos", EVECapability.Photos.rawValue)
    assertEquals("contacts", EVECapability.Contacts.rawValue)
    assertEquals("calendar", EVECapability.Calendar.rawValue)
    assertEquals("motion", EVECapability.Motion.rawValue)
    assertEquals("callLog", EVECapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", EVECameraCommand.List.rawValue)
    assertEquals("camera.snap", EVECameraCommand.Snap.rawValue)
    assertEquals("camera.clip", EVECameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", EVENotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", EVENotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", EVEDeviceCommand.Status.rawValue)
    assertEquals("device.info", EVEDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", EVEDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", EVEDeviceCommand.Health.rawValue)
    assertEquals("device.apps", EVEDeviceCommand.Apps.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", EVESystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", EVEPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", EVEContactsCommand.Search.rawValue)
    assertEquals("contacts.add", EVEContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", EVECalendarCommand.Events.rawValue)
    assertEquals("calendar.add", EVECalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", EVEMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", EVEMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", EVESmsCommand.Send.rawValue)
    assertEquals("sms.search", EVESmsCommand.Search.rawValue)
  }

  @Test
  fun talkCommandsUseStableStrings() {
    assertEquals("talk.ptt.start", EVETalkCommand.PttStart.rawValue)
    assertEquals("talk.ptt.stop", EVETalkCommand.PttStop.rawValue)
    assertEquals("talk.ptt.cancel", EVETalkCommand.PttCancel.rawValue)
    assertEquals("talk.ptt.once", EVETalkCommand.PttOnce.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", EVECallLogCommand.Search.rawValue)
  }
}
