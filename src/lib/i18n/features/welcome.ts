// Strings for: the welcome strip, the one-line hello a first-time visitor gets on the home page,
// pointing to the landing page (/about). One line on a 360px phone, in every language: keep it short.
// French typography: ’ for apostrophes, U+00A0 before ':' and U+202F before ? ! ;
import { defineStrings } from '../define'

export const welcome = defineStrings({
  en: {
    'welcome.strip.aria': 'Welcome to TunisiaFlicks',
    'welcome.strip.new': 'New here?',
    'welcome.strip.see': 'See what TunisiaFlicks can do',
  },
  ar: {
    'welcome.strip.aria': 'مرحبًا بك في TunisiaFlicks',
    'welcome.strip.new': 'أول زيارة لك؟',
    'welcome.strip.see': 'اكتشف ما يقدّمه الموقع',
  },
  tn: {
    'welcome.strip.aria': 'مرحبا بيك في TunisiaFlicks',
    'welcome.strip.new': 'أوّل مرّة هنا؟',
    'welcome.strip.see': 'شوف شنوّة فمّا في الموقع',
  },
  fr: {
    'welcome.strip.aria': 'Bienvenue sur TunisiaFlicks',
    'welcome.strip.new': 'Première visite ?',
    'welcome.strip.see': 'Découvrez le site',
  },
})
