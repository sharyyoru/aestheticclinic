"use client";

import { useState } from "react";
import Image from "next/image";

export default function AliiceChatEmbedDocs() {
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = "https://aestheticclinic.vercel.app";

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const iframeCodeEN = `<iframe
  src="${baseUrl}/aliicechat/embed?lang=en"
  style="position: fixed; bottom: 0; right: 0; width: 100%; height: 100%; border: none; z-index: 9999; pointer-events: none;"
  allow="microphone"
></iframe>
<style>
  iframe { pointer-events: auto; }
</style>`;

  const iframeCodeFR = `<iframe
  src="${baseUrl}/aliicechat/embed?lang=fr"
  style="position: fixed; bottom: 0; right: 0; width: 100%; height: 100%; border: none; z-index: 9999; pointer-events: none;"
  allow="microphone"
></iframe>
<style>
  iframe { pointer-events: auto; }
</style>`;

  const scriptCode = `<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = '${baseUrl}/aliicechat/embed?lang=en';
  iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:100%;height:100%;border:none;z-index:9999;pointer-events:auto;';
  iframe.allow = 'microphone';
  document.body.appendChild(iframe);
})();
</script>`;

  const wordpressShortcode = `<!-- Add this to your theme's footer.php or use a plugin like "Insert Headers and Footers" -->
<iframe
  src="${baseUrl}/aliicechat/embed?lang=en"
  style="position: fixed; bottom: 0; right: 0; width: 100%; height: 100%; border: none; z-index: 9999;"
  allow="microphone"
></iframe>`;

  const wordpressElementor = `<!-- In Elementor: Add HTML Widget to your page/template -->
<!-- Paste this code: -->
<iframe
  src="${baseUrl}/aliicechat/embed?lang=en"
  style="position: fixed; bottom: 0; right: 0; width: 100%; height: 100%; border: none; z-index: 9999;"
  allow="microphone"
></iframe>`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-sky-200">
            <Image src="/logos/AliiceAgent.jpg" alt="Aliice" width={48} height={48} className="object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Aliice Chat Widget</h1>
            <p className="text-sm text-slate-500">Embed Documentation for Developers</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">
        {/* Introduction */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Getting Started</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Embed the Aliice AI chat assistant on your website to provide instant customer support 
            for your Aesthetics Clinic. The widget supports both English and French, and works 
            seamlessly on WordPress, Webflow, Squarespace, and any HTML website.
          </p>
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
            <h3 className="font-semibold text-sky-800 mb-2">✨ Features</h3>
            <ul className="text-sky-700 text-sm space-y-1">
              <li>• Bilingual support (English & French)</li>
              <li>• Mobile responsive design</li>
              <li>• Minimizable chat bubble</li>
              <li>• Auto-opens option available</li>
              <li>• No dependencies required</li>
            </ul>
          </div>
        </section>

        {/* URL Parameters */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">URL Parameters</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Parameter</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Values</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-mono text-sky-600">lang</td>
                  <td className="px-4 py-3"><code className="bg-slate-100 px-2 py-0.5 rounded">en</code> | <code className="bg-slate-100 px-2 py-0.5 rounded">fr</code></td>
                  <td className="px-4 py-3 text-slate-600">Set widget language (default: en)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-sky-600">open</td>
                  <td className="px-4 py-3"><code className="bg-slate-100 px-2 py-0.5 rounded">true</code> | <code className="bg-slate-100 px-2 py-0.5 rounded">false</code></td>
                  <td className="px-4 py-3 text-slate-600">Auto-open chat on load (default: false)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Example: <code className="bg-slate-100 px-2 py-1 rounded text-xs">{baseUrl}/aliicechat/embed?lang=fr&open=true</code>
          </p>
        </section>

        {/* Method 1: iframe */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Method 1: iframe (Recommended)</h2>
          <p className="text-slate-600 mb-4">
            The simplest method that works on all platforms including WordPress. Just paste this code 
            before the closing <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">&lt;/body&gt;</code> tag.
          </p>
          
          <div className="space-y-4">
            {/* English */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">🇬🇧 English Version</span>
                <button
                  onClick={() => copyToClipboard(iframeCodeEN, "iframe-en")}
                  className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  {copied === "iframe-en" ? "✓ Copied!" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs overflow-x-auto">
                <code>{iframeCodeEN}</code>
              </pre>
            </div>

            {/* French */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">🇫🇷 French Version</span>
                <button
                  onClick={() => copyToClipboard(iframeCodeFR, "iframe-fr")}
                  className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  {copied === "iframe-fr" ? "✓ Copied!" : "Copy Code"}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs overflow-x-auto">
                <code>{iframeCodeFR}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Method 2: JavaScript */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Method 2: JavaScript Snippet</h2>
          <p className="text-slate-600 mb-4">
            For dynamic loading, use this JavaScript snippet. It injects the iframe after page load.
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">JavaScript Loader</span>
            <button
              onClick={() => copyToClipboard(scriptCode, "script")}
              className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 px-3 py-1.5 rounded-full transition-colors"
            >
              {copied === "script" ? "✓ Copied!" : "Copy Code"}
            </button>
          </div>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs overflow-x-auto">
            <code>{scriptCode}</code>
          </pre>
        </section>

        {/* WordPress Instructions */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">WordPress Integration</h2>
          
          <div className="space-y-6">
            {/* Option 1: Plugin */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-sky-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                Using "Insert Headers and Footers" Plugin (Easiest)
              </h3>
              <ol className="text-slate-600 text-sm space-y-2 ml-8 list-decimal">
                <li>Install and activate the <strong>"Insert Headers and Footers"</strong> plugin (by WPCode)</li>
                <li>Go to <strong>Settings → Insert Headers and Footers</strong></li>
                <li>Paste the iframe code in the <strong>"Scripts in Footer"</strong> section</li>
                <li>Click <strong>Save</strong></li>
              </ol>
              <div className="mt-4">
                <button
                  onClick={() => copyToClipboard(wordpressShortcode, "wp-plugin")}
                  className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  {copied === "wp-plugin" ? "✓ Copied!" : "Copy WordPress Code"}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs overflow-x-auto mt-3">
                <code>{wordpressShortcode}</code>
              </pre>
            </div>

            {/* Option 2: Elementor */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                Using Elementor
              </h3>
              <ol className="text-slate-600 text-sm space-y-2 ml-8 list-decimal">
                <li>Edit your page with Elementor</li>
                <li>Drag an <strong>"HTML"</strong> widget to your page</li>
                <li>Paste the iframe code</li>
                <li>Click <strong>Update</strong></li>
              </ol>
              <div className="mt-4">
                <button
                  onClick={() => copyToClipboard(wordpressElementor, "elementor")}
                  className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  {copied === "elementor" ? "✓ Copied!" : "Copy Elementor Code"}
                </button>
              </div>
            </div>

            {/* Option 3: Theme Editor */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                Direct Theme Edit (Advanced)
              </h3>
              <ol className="text-slate-600 text-sm space-y-2 ml-8 list-decimal">
                <li>Go to <strong>Appearance → Theme File Editor</strong></li>
                <li>Select your child theme (recommended)</li>
                <li>Open <strong>footer.php</strong></li>
                <li>Paste the iframe code just before <code className="bg-slate-100 px-1 rounded">&lt;/body&gt;</code></li>
                <li>Click <strong>Update File</strong></li>
              </ol>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-amber-800 text-xs">
                  ⚠️ Always use a child theme to prevent losing changes during theme updates.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Troubleshooting</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-2">Widget not appearing?</h3>
              <ul className="text-slate-600 text-sm space-y-1">
                <li>• Check if your theme has a high z-index element covering it</li>
                <li>• Try adding <code className="bg-slate-100 px-1 rounded">z-index: 999999 !important;</code> to the iframe style</li>
                <li>• Ensure the code is placed before <code className="bg-slate-100 px-1 rounded">&lt;/body&gt;</code></li>
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-2">Widget blocking page clicks?</h3>
              <p className="text-slate-600 text-sm">
                The widget uses <code className="bg-slate-100 px-1 rounded">pointer-events</code> to only capture clicks on the 
                chat bubble and window. If you&apos;re experiencing issues, ensure the full iframe code including the style tag is used.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-2">CORS or security errors?</h3>
              <p className="text-slate-600 text-sm">
                The widget is hosted on <code className="bg-slate-100 px-1 rounded">aestheticclinic.vercel.app</code> which 
                allows embedding on any domain. If you see errors, contact support.
              </p>
            </div>
          </div>
        </section>

        {/* Live Preview */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Live Preview</h2>
          <p className="text-slate-600 mb-4">
            Test the embed widget directly on this page. Look for the chat bubble in the bottom-right corner.
          </p>
          <div className="flex gap-4">
            <a
              href="/aliicechat/embed?lang=en"
              target="_blank"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <span>🇬🇧</span> Preview English Widget
            </a>
            <a
              href="/aliicechat/embed?lang=fr"
              target="_blank"
              className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <span>🇫🇷</span> Preview French Widget
            </a>
          </div>
        </section>

        {/* Support */}
        <section className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-3">Need Help?</h2>
          <p className="text-sky-100 mb-4">
            Our team is here to help you integrate the Aliice chat widget on your website.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="mailto:support@aestheticclinic.com" className="bg-white/20 hover:bg-white/30 px-5 py-2.5 rounded-xl font-semibold transition-colors">
              📧 Email Support
            </a>
            <a href="tel:+41227322223" className="bg-white/20 hover:bg-white/30 px-5 py-2.5 rounded-xl font-semibold transition-colors">
              📞 +41 22 732 22 23
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm">
          © {new Date().getFullYear()} Aesthetics Clinic Geneva. All rights reserved.
        </div>
      </footer>

      {/* Embed the actual widget for live preview */}
      <iframe
        src="/aliicechat/embed?lang=en"
        style={{ position: "fixed", bottom: 0, right: 0, width: "100%", height: "100%", border: "none", zIndex: 9999, pointerEvents: "auto" }}
        allow="microphone"
      />
    </main>
  );
}
