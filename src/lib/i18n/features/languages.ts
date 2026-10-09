// Strings for: Interface languages, the language switch, the one-time language hint and the
// Settings "Language and display" section (#display).
import { defineStrings } from '../define'

export const languages = defineStrings({
  en: {
    'languages.settings.title': 'Language and display',
    'languages.settings.desc': 'On this device.',
    'languages.site.label': 'Site language',
    'languages.site.hint': 'Menus and buttons, and the catalogue where a translation exists.',
    'languages.hint.title': 'TunisiaFlicks speaks French',
    'languages.hint.text': 'You can change the language at any time from the menu.',
    'languages.hint.others': 'Other languages',
    'languages.switched': 'Language: {language}',
    'languages.offline': 'You’re offline. The language will change as soon as you’re back online.',
    // The site's own title and description (the root layout's metadata, see siteMetadata in lib/seo).
    'languages.meta.title': 'TunisiaFlicks: movies, TV shows and Tunisian series',
    'languages.meta.description': 'Movies, TV shows and Tunisian series in one place: what’s trending today, trailers, a daily Top 10, Ramadan series and release alerts, in English, French and Arabic.',
  },
  ar: {
    'languages.settings.title': 'اللغة والعرض',
    'languages.settings.desc': 'على هذا الجهاز.',
    'languages.site.label': 'لغة الموقع',
    'languages.site.hint': 'القوائم والأزرار، والكتالوج عندما تتوفّر ترجمة.',
    'languages.hint.title': 'TunisiaFlicks يتحدث الفرنسية',
    'languages.hint.text': 'يمكنك تغيير اللغة في أي وقت من القائمة.',
    'languages.hint.others': 'لغات أخرى',
    'languages.switched': 'اللغة: {language}',
    'languages.offline': 'أنت غير متصل بالإنترنت. ستتغيّر اللغة فور عودة الاتصال.',
    'languages.meta.title': 'TunisiaFlicks: أفلام ومسلسلات ومسلسلات تونسية',
    'languages.meta.description': 'الأفلام والمسلسلات والمسلسلات التونسية في مكان واحد: الرائج اليوم، والمقاطع الدعائية، وأفضل 10 كل يوم، ومسلسلات رمضان وتنبيهات الإصدارات، بالعربية والفرنسية والإنجليزية.',
  },
  tn: {
    'languages.settings.title': 'اللغة والعرض',
    'languages.settings.desc': 'على الجهاز هذا.',
    'languages.site.label': 'لغة السيت',
    'languages.site.hint': 'المنيوات والبوتونات، والكتالوڨ كي تكون فما ترجمة.',
    'languages.hint.title': 'TunisiaFlicks يحكي بالفرنساوي',
    'languages.hint.text': 'تنجم تبدّل اللغة وقت ما تحب من المنيو.',
    'languages.hint.others': 'لغات أخرين',
    'languages.switched': 'اللغة: {language}',
    'languages.offline': 'ماكش متصل بالإنترنت. اللغة تتبدّل كي يرجع الإنترنت.',
    'languages.meta.title': 'TunisiaFlicks: أفلام، مسلسلات ومسلسلات تونسية',
    'languages.meta.description': 'الأفلام والمسلسلات والمسلسلات التونسية في بلاصة وحدة: شنوّة الرائج اليوم، البروموات، أفضل 10 كل نهار، مسلسلات رمضان وتنبيهات كي يخرج عنوان، بالعربي والفرنساوي والإنڨليزي.',
  },
  fr: {
    'languages.settings.title': 'Langue et affichage',
    'languages.settings.desc': 'Sur cet appareil.',
    'languages.site.label': 'Langue du site',
    'languages.site.hint': 'Les menus, les boutons, et le catalogue quand une traduction existe.',
    'languages.hint.title': 'TunisiaFlicks parle français',
    'languages.hint.text': 'Vous pouvez changer de langue à tout moment depuis le menu.',
    'languages.hint.others': 'Autres langues',
    'languages.switched': 'Langue\u00a0: {language}',
    'languages.offline': 'Vous êtes hors ligne. La langue changera dès le retour de la connexion.',
    'languages.meta.title': 'TunisiaFlicks : films, séries et séries tunisiennes',
    'languages.meta.description': 'Films, séries et séries tunisiennes au même endroit : les tendances du jour, les bandes-annonces, un Top 10 quotidien, les séries du Ramadan et des alertes de sortie, en français, en anglais et en arabe.',
  },
})
