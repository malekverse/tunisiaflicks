// More memory for Gradle than Expo's template gives it (2 GB, 512 MB of metaspace): a release build
// for two architectures ran out of metaspace on GitHub's runner.
const { withGradleProperties } = require('expo/config-plugins')

const JVM_ARGS = '-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8'

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((item) => !(item.type === 'property' && item.key === 'org.gradle.jvmargs'))
    mod.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS })
    return mod
  })
}
