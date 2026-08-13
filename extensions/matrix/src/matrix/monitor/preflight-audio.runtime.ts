import { sendDurableMessageBatch as sendDurableMessageBatchImpl } from "eve-agent/plugin-sdk/channel-outbound";
import { transcribeFirstAudio as transcribeFirstAudioImpl } from "eve-agent/plugin-sdk/media-runtime";

type TranscribeFirstAudio = typeof import("eve-agent/plugin-sdk/media-runtime").transcribeFirstAudio;
type SendDurableMessageBatch =
  typeof import("eve-agent/plugin-sdk/channel-outbound").sendDurableMessageBatch;

export async function transcribeFirstAudio(
  ...args: Parameters<TranscribeFirstAudio>
): ReturnType<TranscribeFirstAudio> {
  return await transcribeFirstAudioImpl(...args);
}

export async function sendDurableMessageBatch(
  ...args: Parameters<SendDurableMessageBatch>
): ReturnType<SendDurableMessageBatch> {
  return await sendDurableMessageBatchImpl(...args);
}
