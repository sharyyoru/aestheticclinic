const { withPodfile } = require("expo/config-plugins");

// Fixes Xcode 26.4 build error:
//   "call to consteval function 'fmt::basic_format_string<...>' is not a constant expression"
// Root cause: fmt 11.x (bundled with React Native) enables FMT_USE_CONSTEVAL for
// Clang >= 11, but Apple Clang in Xcode 26.4 enforces stricter consteval rules.
// Workaround from expo/expo#44229: patch fmt headers in the Pods sandbox during
// post_install to force FMT_USE_CONSTEVAL=0 (runtime format-string validation).
// Patching source files directly is immune to build-setting overwrites from
// react_native_post_install.
const PATCH = `
  # [withFmtFix] Fix fmt consteval compilation error with Xcode 26.4+ (expo/expo#44229)
  begin
    fmt_pod_dir = installer.sandbox.pod_dir('fmt')
    Dir.glob(File.join(fmt_pod_dir, '**', 'base.h')).each do |header|
      content = File.read(header)
      patched = content.gsub('define FMT_USE_CONSTEVAL 1', 'define FMT_USE_CONSTEVAL 0')
      patched = patched.gsub(/(#\\s*ifndef FMT_USE_CONSTEVAL)/, "# define FMT_USE_CONSTEVAL 0\\n\\\\1")
      if patched != content
        File.chmod(0644, header)
        File.write(header, patched)
        Pod::UI.puts "[withFmtFix] Patched FMT_USE_CONSTEVAL=0 in #{header}"
      end
    end
  rescue => e
    Pod::UI.puts "[withFmtFix] Skipped fmt patch: #{e.message}"
  end
  # [withFmtFix] Belt-and-braces: define FMT_USE_CONSTEVAL=0 on every pod target so
  # any target including fmt headers also skips the consteval code path.
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
      defs = [defs] if defs.is_a?(String)
      unless defs.include?('FMT_USE_CONSTEVAL=0')
        defs << 'FMT_USE_CONSTEVAL=0'
      end
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
    end
  end
`;

module.exports = function withFmtFix(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes("FMT_USE_CONSTEVAL")) {
      config.modResults.contents = contents.replace(
        "post_install do |installer|",
        `post_install do |installer|\n${PATCH}`
      );
    }
    return config;
  });
};
