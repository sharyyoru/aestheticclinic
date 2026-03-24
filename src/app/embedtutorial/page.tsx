"use client";

import { useState } from "react";

export default function EmbedTutorialPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const codeBlocks = {
    contactFr: `<iframe
  id="aesthetics-contact-form"
  src="https://aestheticclinic.vercel.app/embed/contact"
  style="width: 100%; border: none; overflow: hidden; min-height: 750px;"
  scrolling="no"
  frameborder="0"
  allowtransparency="true"
></iframe>

<script>
(function() {
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'embed-height') {
      var iframe = document.getElementById('aesthetics-contact-form');
      if (iframe) {
        iframe.style.height = event.data.height + 'px';
      }
    }
  });
})();
</script>`,

    contactEn: `<iframe
  id="aesthetics-contact-form-en"
  src="https://aestheticclinic.vercel.app/embed/contact?lang=en"
  style="width: 100%; border: none; overflow: hidden; min-height: 750px;"
  scrolling="no"
  frameborder="0"
  allowtransparency="true"
></iframe>

<script>
(function() {
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'embed-height') {
      var iframe = document.getElementById('aesthetics-contact-form-en');
      if (iframe) {
        iframe.style.height = event.data.height + 'px';
      }
    }
  });
})();
</script>`,

    bookingFr: `<iframe
  id="aesthetics-booking-form"
  src="https://aestheticclinic.vercel.app/embed/book"
  style="width: 100%; border: none; overflow: hidden; min-height: 600px;"
  scrolling="no"
  frameborder="0"
  allowtransparency="true"
></iframe>

<script>
(function() {
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'embed-height') {
      var iframe = document.getElementById('aesthetics-booking-form');
      if (iframe) {
        iframe.style.height = event.data.height + 'px';
      }
    }
  });
})();
</script>`,

    bookingEn: `<iframe
  id="aesthetics-booking-form-en"
  src="https://aestheticclinic.vercel.app/embed/book?lang=en"
  style="width: 100%; border: none; overflow: hidden; min-height: 600px;"
  scrolling="no"
  frameborder="0"
  allowtransparency="true"
></iframe>

<script>
(function() {
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'embed-height') {
      var iframe = document.getElementById('aesthetics-booking-form-en');
      if (iframe) {
        iframe.style.height = event.data.height + 'px';
      }
    }
  });
})();
</script>`,

    globalScript: `<script>
(function() {
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'embed-height') {
      // Update all Aesthetics iframes
      var iframes = document.querySelectorAll('iframe[src*="aestheticclinic.vercel.app"]');
      iframes.forEach(function(iframe) {
        iframe.style.height = event.data.height + 'px';
      });
    }
  });
})();
</script>`,

    simpleIframe: `<iframe
  src="https://aestheticclinic.vercel.app/embed/contact"
  style="width: 100%; border: none; overflow: hidden; min-height: 750px;"
  scrolling="no"
  frameborder="0"
></iframe>`,
  };

  const CodeBlock = ({ code, index, title }: { code: string; index: number; title: string }) => (
    <div className="relative">
      <div className="flex items-center justify-between bg-slate-800 text-slate-300 px-4 py-2 rounded-t-lg text-sm">
        <span>{title}</span>
        <button
          onClick={() => copyToClipboard(code, index)}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
        >
          {copiedIndex === index ? (
            <>
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-b-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Iframe Embed Implementation Guide
          </h1>
          <p className="text-lg text-slate-600">
            Aesthetics Clinic Forms - WordPress Integration
          </p>
        </div>

        {/* Current Issue */}
        <section className="mb-10">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Current Issue
            </h2>
            <p className="text-amber-900">
              Your iframe is displaying the form, but it has a <strong>fixed height</strong> which causes scrollbars on mobile devices. 
              The embed sends its content height automatically, but your page needs a JavaScript listener to receive it.
            </p>
          </div>
        </section>

        {/* Step by Step */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Step-by-Step Instructions for WPBakery</h2>
          
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Open the Page in WPBakery
              </h3>
              <ol className="list-decimal list-inside text-slate-600 space-y-2 ml-10">
                <li>Go to <strong>Pages</strong> → Find your page (e.g., &quot;Abdominoplastie&quot;)</li>
                <li>Click <strong>Edit with WPBakery Page Builder</strong></li>
              </ol>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Edit the Raw HTML Element
              </h3>
              <ol className="list-decimal list-inside text-slate-600 space-y-2 ml-10">
                <li>Find your existing <strong>Raw HTML</strong> element containing the iframe</li>
                <li>Click the <strong>pencil icon</strong> to edit it</li>
                <li><strong>Delete all existing code</strong> in the text area</li>
              </ol>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Paste the Complete Code
              </h3>
              <p className="text-slate-600 ml-10 mb-4">
                Copy and paste the appropriate code block below based on which form you need:
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                Save and Preview
              </h3>
              <ol className="list-decimal list-inside text-slate-600 space-y-2 ml-10">
                <li>Click <strong>Save Changes</strong> in the Raw HTML dialog</li>
                <li>Click <strong>Update</strong> to save the page</li>
                <li>Click <strong>Preview</strong> to test the page</li>
                <li><strong>Test on mobile</strong> using browser developer tools (F12 → Toggle device toolbar)</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Code Blocks */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Code Blocks</h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Contact Form (French)</h3>
              <CodeBlock code={codeBlocks.contactFr} index={0} title="HTML + JavaScript" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Contact Form (English)</h3>
              <CodeBlock code={codeBlocks.contactEn} index={1} title="HTML + JavaScript" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Booking Form (French)</h3>
              <CodeBlock code={codeBlocks.bookingFr} index={2} title="HTML + JavaScript" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Booking Form (English)</h3>
              <CodeBlock code={codeBlocks.bookingEn} index={3} title="HTML + JavaScript" />
            </div>
          </div>
        </section>

        {/* Multiple Forms */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Multiple Forms on One Page?</h2>
          <p className="text-slate-600 mb-4">
            If you have <strong>multiple forms on the same page</strong>, use this single global script once 
            (add to theme footer or a separate Raw HTML element at the bottom):
          </p>
          <CodeBlock code={codeBlocks.globalScript} index={4} title="Global Script (add once)" />
          
          <p className="text-slate-600 mt-6 mb-4">
            Then your iframes only need the simple version without the script:
          </p>
          <CodeBlock code={codeBlocks.simpleIframe} index={5} title="Simple iframe (use with global script)" />
        </section>

        {/* Available URLs */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Available Form URLs</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-6 py-3 text-slate-700 font-semibold">Form</th>
                  <th className="text-left px-6 py-3 text-slate-700 font-semibold">Language</th>
                  <th className="text-left px-6 py-3 text-slate-700 font-semibold">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-6 py-4 text-slate-900">Contact</td>
                  <td className="px-6 py-4 text-slate-600">French</td>
                  <td className="px-6 py-4">
                    <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700">
                      https://aestheticclinic.vercel.app/embed/contact
                    </code>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-900">Contact</td>
                  <td className="px-6 py-4 text-slate-600">English</td>
                  <td className="px-6 py-4">
                    <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700">
                      https://aestheticclinic.vercel.app/embed/contact?lang=en
                    </code>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-900">Booking</td>
                  <td className="px-6 py-4 text-slate-600">French</td>
                  <td className="px-6 py-4">
                    <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700">
                      https://aestheticclinic.vercel.app/embed/book
                    </code>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-900">Booking</td>
                  <td className="px-6 py-4 text-slate-600">English</td>
                  <td className="px-6 py-4">
                    <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700">
                      https://aestheticclinic.vercel.app/embed/book?lang=en
                    </code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Troubleshooting */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Troubleshooting</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-6 py-3 text-slate-700 font-semibold">Problem</th>
                  <th className="text-left px-6 py-3 text-slate-700 font-semibold">Solution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-6 py-4 text-slate-900">Form not appearing</td>
                  <td className="px-6 py-4 text-slate-600">Check the iframe <code className="bg-slate-100 px-1 rounded">src</code> URL is correct</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-900">Scrollbars showing</td>
                  <td className="px-6 py-4 text-slate-600">Make sure the <code className="bg-slate-100 px-1 rounded">&lt;script&gt;</code> is included</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-900">Form too short</td>
                  <td className="px-6 py-4 text-slate-600">Increase <code className="bg-slate-100 px-1 rounded">min-height</code> value (e.g., 800px)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-900">Form cut off on mobile</td>
                  <td className="px-6 py-4 text-slate-600">The script auto-adjusts height; ensure it&apos;s included</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Support */}
        <section className="mb-10">
          <div className="bg-slate-100 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Technical Support</h2>
            <p className="text-slate-600 mb-4">If issues persist after following these instructions, please:</p>
            <ol className="list-decimal list-inside text-slate-600 space-y-2">
              <li>Send a screenshot of the Raw HTML code</li>
              <li>Send a screenshot of the issue on the frontend</li>
              <li>Include the page URL</li>
            </ol>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm pt-8 border-t border-slate-200">
          <p>Aesthetics Clinic © {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
}
