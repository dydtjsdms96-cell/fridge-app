/**
 * utterance → freshpocket://add?text=...
 * Parsing and saving happen inside the Android app.
 * JS runtime v2: use export default (not module.exports).
 */
export default function ({ utterance }) {
  var text = String(utterance == null ? "" : utterance).trim();
  return "freshpocket://add?text=" + encodeURIComponent(text);
}
