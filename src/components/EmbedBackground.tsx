/**
 * EmbedBackground
 *
 * The app's global stylesheet (`globals.css`) paints `body` with an
 * indigo → sky → fuchsia radial gradient. That gradient is correct for the
 * full app, but when a public widget (booking / contact form) is embedded in an
 * <iframe> on a marketing site it bleeds in as a contrasting pink/blue
 * background around the widget.
 *
 * Rendering this component inside an embed route's layout neutralises that
 * gradient for the embedded document only. `transparent` lets the host page's
 * own background (the beige-white used on aesthetics-ge.ch) show through the
 * iframe with no colour seam, so every embed blends into its host.
 */
export default function EmbedBackground() {
  return (
    <style>{`html, body { background: transparent !important; }`}</style>
  );
}
