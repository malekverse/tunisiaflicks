// Signs release builds with the key from the environment (the workflow decodes it from the
// repository's ANDROID_* secrets): the same key as the earlier apps, so these install as updates.
// Without TF_KEYSTORE_PATH, release builds keep Expo's default (debug) signing, for local testing.
const { withAppBuildGradle } = require('expo/config-plugins')

const BLOCK = `
    // Added by plugins/with-release-signing.js
    def tfKeystore = System.getenv('TF_KEYSTORE_PATH')
    if (tfKeystore) {
        signingConfigs {
            tfRelease {
                storeFile file(tfKeystore)
                storePassword System.getenv('TF_KEYSTORE_PASSWORD')
                keyAlias System.getenv('TF_KEY_ALIAS')
                keyPassword System.getenv('TF_KEY_PASSWORD')
            }
        }
        buildTypes.release.signingConfig signingConfigs.tfRelease
    }
`

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('with-release-signing')) {
      // Last thing in the android { } block, so it overrides the template's release signing.
      mod.modResults.contents = mod.modResults.contents.replace(/\nandroid\s*\{([\s\S]*?)\n\}/, (match) => match.replace(/\n\}$/, `${BLOCK}\n}`))
    }
    return mod
  })
}
