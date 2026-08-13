/**
 * Help examples shown by the Browser CLI root command.
 */
/** Core Browser CLI examples for lifecycle and inspection commands. */
export const browserCoreExamples = [
  "eve browser status",
  "eve browser start",
  "eve browser start --headless",
  "eve browser stop",
  "eve browser tabs",
  "eve browser open https://example.com",
  "eve browser focus abcd1234",
  "eve browser close abcd1234",
  "eve browser screenshot",
  "eve browser screenshot --full-page",
  "eve browser screenshot --ref 12",
  "eve browser snapshot",
  "eve browser snapshot --format aria --limit 200",
  "eve browser snapshot --efficient",
  "eve browser snapshot --labels",
];

/** Browser CLI examples for interaction/action commands. */
export const browserActionExamples = [
  "eve browser navigate https://example.com",
  "eve browser resize 1280 720",
  "eve browser click 12 --double",
  "eve browser click-coords 120 340",
  'eve browser type 23 "hello" --submit',
  "eve browser press Enter",
  "eve browser hover 44",
  "eve browser drag 10 11",
  "eve browser select 9 OptionA OptionB",
  "eve browser upload /tmp/eve/uploads/file.pdf",
  "eve browser upload media://inbound/file.pdf",
  'eve browser fill --fields \'[{"ref":"1","value":"Ada"}]\'',
  "eve browser dialog --accept",
  'eve browser wait --text "Done"',
  "eve browser evaluate --fn '(el) => el.textContent' --ref 7",
  "eve browser evaluate --fn 'const title = document.title; return title;'",
  "eve browser console --level error",
  "eve browser pdf",
];
