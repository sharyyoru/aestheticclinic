const { withPodfile } = require("expo/config-plugins");

// Fixes Xcode 26.4 build error: "call to consteval function 'fmt::basic_format_string...'
// is not a constant expression". Compiles only the fmt pod with C++17 so the
// consteval code path is skipped. See facebook/react-native#55601 and expo/expo#44229.
const FMT_FIX = `
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;

module.exports = function withFmtFix(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes("CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'")) {
      contents = contents.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${FMT_FIX}`
      );
      config.modResults.contents = contents;
    }
    return config;
  });
};
