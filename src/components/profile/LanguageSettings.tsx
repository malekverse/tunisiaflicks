// Settings #display, "Language and display" (a SettingsSection id='display'): the site's language as
// a full-width switch, then tv-mode's <TvModeSetting/>. Mounted in src/app/profile/page.tsx after
// #privacy. Both settings belong to this device (a cookie each), not to the account.
"use client"
import { useI18n } from '@/src/components/I18nProvider'
import LanguageSwitch from '@/src/components/shell/LanguageSwitch'
import TvModeSetting from '@/src/components/tv/TvModeSetting'
import SettingsSection, { SettingsGroup } from './SettingsSection'

const LABEL_ID = 'setting-language-label'

export default function LanguageSettings(): JSX.Element | null {
  const { t } = useI18n()
  return (
    <SettingsSection id="display" title={t('languages.settings.title')} description={t('languages.settings.desc')}>
      <div className="space-y-4">
        <SettingsGroup>
          <div className="py-4">
            <p id={LABEL_ID} className="text-[15px] font-medium text-white">{t('languages.site.label')}</p>
            <p id={`${LABEL_ID}-hint`} className="mt-0.5 text-[13px] leading-snug text-white/55">{t('languages.site.hint')}</p>
            <LanguageSwitch stretch labelledBy={LABEL_ID} describedBy={`${LABEL_ID}-hint`} className="mt-4 max-w-[560px]" />
          </div>
        </SettingsGroup>
        <TvModeSetting />
      </div>
    </SettingsSection>
  )
}
