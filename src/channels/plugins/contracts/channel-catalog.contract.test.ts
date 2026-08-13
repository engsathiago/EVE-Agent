// Channel catalog contract tests cover bundled and registry-backed channel catalog invariants.
import {
  describeBundledMetadataOnlyChannelCatalogContract,
  describeChannelCatalogEntryContract,
  describeOfficialFallbackChannelCatalogContract,
} from "./test-helpers/channel-catalog-contract.js";

describeChannelCatalogEntryContract({
  channelId: "msteams",
  npmSpec: "@eve/msteams",
  alias: "teams",
});

const whatsappMeta = {
  id: "whatsapp",
  label: "WhatsApp",
  selectionLabel: "WhatsApp (QR link)",
  detailLabel: "WhatsApp Web",
  docsPath: "/channels/whatsapp",
  blurb: "works with your own number; recommend a separate phone + eSIM.",
};

describeBundledMetadataOnlyChannelCatalogContract({
  pluginId: "whatsapp",
  packageName: "@eve/whatsapp",
  npmSpec: "@eve/whatsapp",
  meta: whatsappMeta,
  defaultChoice: "npm",
});

describeOfficialFallbackChannelCatalogContract({
  channelId: "whatsapp",
  npmSpec: "@eve/whatsapp",
  meta: whatsappMeta,
  packageName: "@eve/whatsapp",
  pluginId: "whatsapp",
  externalNpmSpec: "@vendor/whatsapp-fork",
  externalLabel: "WhatsApp Fork",
});

describeChannelCatalogEntryContract({
  channelId: "wecom",
  npmSpec: "@wecom/wecom-eve-plugin@2026.5.7",
  alias: "wework",
});

describeChannelCatalogEntryContract({
  channelId: "yuanbao",
  npmSpec: "eve-plugin-yuanbao@2.13.1",
  alias: "yb",
});

describeChannelCatalogEntryContract({
  channelId: "eve-zaloclawbot",
  npmSpec: "@zalo-platforms/eve-zaloclawbot@0.1.4",
  alias: "zaloclawbot",
});
