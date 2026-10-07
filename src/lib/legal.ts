// Content of the About / Privacy / Terms / DMCA pages, per UI language.
//
// Written to match how the site actually works (TMDB metadata, third-party players and download
// sources, no video files hosted by us). It is a sensible starting point, not legal advice: have it
// reviewed before relying on it. Other Arabic-script locales fall back to the Arabic text.
import type { Locale } from '@/src/lib/i18n'

export type LegalSection = { heading: string, paragraphs?: string[], bullets?: string[] }
export type LegalDoc = { title: string, description: string, intro: string, sections: LegalSection[] }
export type LegalPageId = 'about' | 'privacy' | 'terms' | 'dmca'

export const LEGAL_UPDATED = '2026-10-07'

const en: Record<LegalPageId, LegalDoc> = {
  about: {
    title: 'About TunisiaFlicks',
    description: 'What TunisiaFlicks is, how it works and who makes it.',
    intro: 'TunisiaFlicks helps you find something good to watch: movies and TV shows from around the world, plus a catalogue of Tunisian series and films, with personal touches like Continue Watching, recommendations, lists and release alerts.',
    sections: [
      {
        heading: 'How it works',
        bullets: [
          'Titles, posters, cast and ratings come from The Movie Database (TMDB). TunisiaFlicks uses the TMDB API but is not endorsed or certified by TMDB.',
          'Trailers are YouTube videos embedded from YouTube.',
          'Video players and download sources are provided by independent third-party services. TunisiaFlicks does not host, upload or store any video files.',
          'The Tunisian catalogue is built from publicly available listings and links to the original pages.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'An account is free and optional. It keeps your favorites, bookmarks, watch history, lists, profiles and alerts in sync across your devices. You can download or delete your data at any time from your profile page.',
        ],
      },
      {
        heading: 'Get in touch',
        paragraphs: [
          'Ideas, bugs or questions are always welcome through the contact page. Rights holders can use the DMCA page to report content.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'What data TunisiaFlicks collects, why, and the choices you have.',
    intro: 'We collect as little as we need to run the service, we never sell your data, and you can export or delete it whenever you want.',
    sections: [
      {
        heading: 'What we collect',
        bullets: [
          'Account details: your name, email address, profile picture and a securely hashed password (never the password itself). If you sign in with Google we receive your name, email and profile picture from Google.',
          'Your activity on TunisiaFlicks: favorites, bookmarks, watch history, lists, profiles, followed titles and notification preferences.',
          'If you turn on notifications: the address your browser gives us to deliver them (a push subscription), your language and which notifications you chose. Turning them off deletes it.',
          'Technical data: your IP address is used briefly to protect logins and forms against abuse (rate limiting) and is not kept for longer than a day.',
          'Cookies: a session cookie to keep you signed in, and small preference cookies for your language and active profile. We do not use advertising cookies.',
          'Analytics: anonymous, cookie-free page statistics (Vercel Web Analytics) to see which pages are used.',
        ],
      },
      {
        heading: 'How we use it',
        bullets: [
          'To provide your account features (sync, recommendations, alerts, your yearly recap).',
          'To send the emails you ask for: password resets, email verification and release alerts.',
          'To show anonymous site-wide trends ("Trending on TunisiaFlicks"): only counts of how many accounts watched a title, and only once several different accounts have.',
          'To keep the service secure and fix problems.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          'We do not sell or rent your data. It is processed only by the providers that run the service: hosting (Vercel), database (MongoDB Atlas) and email delivery. When you press play, the video player you chose is a third-party service with its own privacy policy, as are YouTube trailers.',
        ],
      },
      {
        heading: 'Your choices and rights',
        bullets: [
          'Export: download a copy of your data from your profile page.',
          'Correct: change your name, email and avatar from your profile page.',
          'Delete: delete your account and all its data from your profile page. Deletion is permanent.',
          'Questions or requests can also be sent through the contact page.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'Accounts are meant for people aged 13 and over. Parents can create Kids profiles, which only show titles rated for children.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: ['If this policy changes, the date at the top of this page will change too. Significant changes will be announced on the site.'],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    description: 'The rules for using TunisiaFlicks.',
    intro: 'By using TunisiaFlicks you agree to these terms. If you do not agree, please do not use the service.',
    sections: [
      {
        heading: 'The service',
        paragraphs: [
          'TunisiaFlicks is a free catalogue for discovering movies and TV shows. Information about titles comes from TMDB. TunisiaFlicks does not host, upload or store video files: players, streams and download sources shown on the site are provided by independent third parties, and we do not control their content or availability.',
        ],
      },
      {
        heading: 'Your account',
        bullets: [
          'Give accurate information and keep your password safe. You are responsible for activity on your account.',
          'One person per account; profiles are for members of your household.',
          'We may suspend accounts that break these terms.',
        ],
      },
      {
        heading: 'Acceptable use',
        bullets: [
          'Do not use the service for anything unlawful, or to infringe the rights of others.',
          'Do not attack, overload, scrape or try to break the service or its security.',
          'Public lists and anything else you publish must not be offensive, misleading or infringing. We may remove such content.',
        ],
      },
      {
        heading: 'Third-party content',
        paragraphs: [
          'Links, embedded players, trailers and download sources lead to services we do not operate. Use them at your own discretion and according to the law where you live. Rights holders can report content through the DMCA page and we will act on valid notices.',
        ],
      },
      {
        heading: 'No warranty and limitation of liability',
        paragraphs: [
          'The service is provided "as is", without warranties of any kind. To the extent permitted by law, TunisiaFlicks is not liable for any indirect or consequential damages arising from its use, or from third-party content and services.',
        ],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [
          'We may update these terms; the date at the top of this page shows the latest version. Questions are welcome through the contact page.',
        ],
      },
    ],
  },
  dmca: {
    title: 'Copyright & DMCA',
    description: 'How rights holders can report content on TunisiaFlicks.',
    intro: 'TunisiaFlicks respects the rights of creators. We do not host video files on our servers: our pages show information from TMDB and link to or embed content hosted by independent third parties. If you believe a page on TunisiaFlicks links to or embeds content that infringes your copyright, send us a notice and we will remove the link or embed.',
    sections: [
      {
        heading: 'What a notice must include',
        bullets: [
          'Your name and contact details (an email address we can reply to).',
          'The copyrighted work you believe is infringed.',
          'The exact TunisiaFlicks page address(es) (URLs) where the material appears.',
          'A statement that you believe in good faith that the use is not authorised by the copyright owner, its agent or the law.',
          'A statement that the information in the notice is accurate and, under penalty of perjury, that you are the owner or are authorised to act for the owner.',
          'Your physical or electronic signature (typing your full name is enough).',
        ],
      },
      {
        heading: 'What happens next',
        paragraphs: [
          'We review notices promptly, usually within a few working days, and remove or disable the reported links or embeds when a notice is valid. Because the files themselves are hosted elsewhere, we also recommend notifying the hosting provider directly.',
          'If you believe content was removed by mistake, you can send a counter-notice through the same form with the details above. Accounts that repeatedly publish infringing material may be closed.',
        ],
      },
    ],
  },
}

const ar: Record<LegalPageId, LegalDoc> = {
  about: {
    title: 'حول TunisiaFlicks',
    description: 'ما هو TunisiaFlicks، كيف يعمل ومن يقف وراءه.',
    intro: 'يساعدك TunisiaFlicks على إيجاد ما يستحق المشاهدة: أفلام ومسلسلات من كل أنحاء العالم، إلى جانب كتالوج للمسلسلات والأفلام التونسية، مع لمسات شخصية مثل «متابعة المشاهدة» والاقتراحات والقوائم وتنبيهات الإصدارات.',
    sections: [
      {
        heading: 'كيف يعمل',
        bullets: [
          'العناوين والملصقات وطاقم التمثيل والتقييمات مصدرها قاعدة بيانات الأفلام TMDB. يستخدم TunisiaFlicks واجهة TMDB البرمجية لكنه غير معتمد أو موثق من TMDB.',
          'المقاطع الدعائية هي فيديوهات يوتيوب مضمّنة من يوتيوب.',
          'مشغلات الفيديو ومصادر التنزيل تقدمها خدمات خارجية مستقلة. لا يستضيف TunisiaFlicks أي ملفات فيديو ولا يرفعها ولا يخزنها.',
          'الكتالوج التونسي مبني من قوائم متاحة للعموم ويحيل إلى الصفحات الأصلية.',
        ],
      },
      {
        heading: 'حسابك',
        paragraphs: [
          'الحساب مجاني واختياري. يحفظ المفضلة والمحفوظات وسجل المشاهدة والقوائم والملفات الشخصية والتنبيهات ويزامنها بين أجهزتك. يمكنك تنزيل بياناتك أو حذفها في أي وقت من صفحة ملفك الشخصي.',
        ],
      },
      {
        heading: 'تواصل معنا',
        paragraphs: [
          'نرحب دائمًا بأفكارك وملاحظاتك وأسئلتك عبر صفحة التواصل. ويمكن لأصحاب الحقوق الإبلاغ عن المحتوى عبر صفحة حقوق النشر (DMCA).',
        ],
      },
    ],
  },
  privacy: {
    title: 'سياسة الخصوصية',
    description: 'ما البيانات التي يجمعها TunisiaFlicks، ولماذا، وما هي خياراتك.',
    intro: 'نجمع أقل قدر ممكن من البيانات لتشغيل الخدمة، ولا نبيع بياناتك أبدًا، ويمكنك تصديرها أو حذفها متى شئت.',
    sections: [
      {
        heading: 'ما الذي نجمعه',
        bullets: [
          'بيانات الحساب: اسمك وبريدك الإلكتروني وصورتك الشخصية وكلمة مرور مشفّرة بشكل آمن (وليس كلمة المرور نفسها). عند تسجيل الدخول عبر Google نتلقى منها اسمك وبريدك وصورتك.',
          'نشاطك على TunisiaFlicks: المفضلة والمحفوظات وسجل المشاهدة والقوائم والملفات الشخصية والعناوين التي تتابعها وإعدادات التنبيهات.',
          'إذا فعّلت الإشعارات: العنوان الذي يمنحه متصفحك لإيصالها (اشتراك الإشعارات)، ولغتك والإشعارات التي اخترتها. إيقافها يحذفه.',
          'بيانات تقنية: يُستخدم عنوان IP لفترة قصيرة لحماية تسجيل الدخول والنماذج من الإساءة (تحديد عدد المحاولات) ولا يُحتفظ به لأكثر من يوم.',
          'ملفات تعريف الارتباط: ملف جلسة لإبقائك مسجلًا، وملفات صغيرة لحفظ اللغة والملف الشخصي النشط. لا نستخدم ملفات تعريف ارتباط إعلانية.',
          'الإحصاءات: إحصاءات صفحات مجهولة الهوية وبدون ملفات تعريف ارتباط (Vercel Web Analytics) لمعرفة الصفحات المستخدمة.',
        ],
      },
      {
        heading: 'كيف نستخدمها',
        bullets: [
          'لتقديم ميزات حسابك (المزامنة والاقتراحات والتنبيهات وملخصك السنوي).',
          'لإرسال الرسائل التي تطلبها: إعادة تعيين كلمة المرور وتأكيد البريد وتنبيهات الإصدارات.',
          'لعرض توجهات عامة مجهولة الهوية («الأكثر مشاهدة على TunisiaFlicks»): مجرد عدد الحسابات التي شاهدت عملًا ما، وفقط بعد أن تشاهده عدة حسابات مختلفة.',
          'للحفاظ على أمان الخدمة وإصلاح المشاكل.',
        ],
      },
      {
        heading: 'مع من نشاركها',
        paragraphs: [
          'لا نبيع بياناتك ولا نؤجرها. تتم معالجتها فقط من قبل مزودي الخدمات الذين يشغّلون الموقع: الاستضافة (Vercel) وقاعدة البيانات (MongoDB Atlas) وخدمة البريد الإلكتروني. عند الضغط على تشغيل، يكون المشغّل الذي اخترته خدمة خارجية لها سياسة خصوصيتها، وكذلك مقاطع يوتيوب الدعائية.',
        ],
      },
      {
        heading: 'خياراتك وحقوقك',
        bullets: [
          'التصدير: نزّل نسخة من بياناتك من صفحة ملفك الشخصي.',
          'التصحيح: عدّل اسمك وبريدك وصورتك من صفحة ملفك الشخصي.',
          'الحذف: احذف حسابك وكل بياناته من صفحة ملفك الشخصي. الحذف نهائي.',
          'يمكنك أيضًا إرسال أسئلتك أو طلباتك عبر صفحة التواصل.',
        ],
      },
      {
        heading: 'الأطفال',
        paragraphs: [
          'الحسابات موجهة لمن هم في سن 13 عامًا فما فوق. يمكن للأولياء إنشاء ملفات أطفال لا تعرض إلا العناوين المصنفة للأطفال.',
        ],
      },
      {
        heading: 'التغييرات',
        paragraphs: ['إذا تغيرت هذه السياسة سيتغير التاريخ في أعلى الصفحة أيضًا، وسنعلن عن التغييرات المهمة على الموقع.'],
      },
    ],
  },
  terms: {
    title: 'شروط الاستخدام',
    description: 'قواعد استخدام TunisiaFlicks.',
    intro: 'باستخدامك TunisiaFlicks فإنك توافق على هذه الشروط. إذا كنت لا توافق عليها، يرجى عدم استخدام الخدمة.',
    sections: [
      {
        heading: 'الخدمة',
        paragraphs: [
          'TunisiaFlicks كتالوج مجاني لاكتشاف الأفلام والمسلسلات. معلومات العناوين مصدرها TMDB. لا يستضيف TunisiaFlicks ملفات فيديو ولا يرفعها ولا يخزنها: المشغلات والبث ومصادر التنزيل المعروضة على الموقع تقدمها جهات خارجية مستقلة، ولا نتحكم في محتواها أو توفرها.',
        ],
      },
      {
        heading: 'حسابك',
        bullets: [
          'قدّم معلومات صحيحة وحافظ على سرية كلمة مرورك. أنت مسؤول عن النشاط على حسابك.',
          'حساب واحد لكل شخص؛ الملفات الشخصية مخصصة لأفراد أسرتك.',
          'قد نعلّق الحسابات التي تخالف هذه الشروط.',
        ],
      },
      {
        heading: 'الاستخدام المقبول',
        bullets: [
          'لا تستخدم الخدمة لأي غرض غير قانوني أو لانتهاك حقوق الآخرين.',
          'لا تهاجم الخدمة أو تُثقلها أو تستخرج بياناتها آليًا أو تحاول اختراقها.',
          'يجب ألا تكون القوائم العامة وأي محتوى تنشره مسيئًا أو مضللًا أو منتهكًا للحقوق، ويحق لنا حذفه.',
        ],
      },
      {
        heading: 'محتوى الجهات الخارجية',
        paragraphs: [
          'تؤدي الروابط والمشغلات المضمّنة والمقاطع الدعائية ومصادر التنزيل إلى خدمات لا نديرها. استخدمها على مسؤوليتك ووفق القانون المعمول به في بلدك. يمكن لأصحاب الحقوق الإبلاغ عن المحتوى عبر صفحة حقوق النشر وسنتخذ الإجراء اللازم عند تلقي إشعارات صحيحة.',
        ],
      },
      {
        heading: 'إخلاء المسؤولية وحدودها',
        paragraphs: [
          'تُقدَّم الخدمة «كما هي» دون أي ضمانات. وفي الحدود التي يسمح بها القانون، لا يتحمل TunisiaFlicks مسؤولية أي أضرار غير مباشرة ناتجة عن استخدامها أو عن محتوى وخدمات الجهات الخارجية.',
        ],
      },
      {
        heading: 'التغييرات والتواصل',
        paragraphs: [
          'قد نحدّث هذه الشروط؛ ويشير التاريخ في أعلى الصفحة إلى آخر نسخة. نرحب بأسئلتكم عبر صفحة التواصل.',
        ],
      },
    ],
  },
  dmca: {
    title: 'حقوق النشر (DMCA)',
    description: 'كيف يمكن لأصحاب الحقوق الإبلاغ عن محتوى على TunisiaFlicks.',
    intro: 'يحترم TunisiaFlicks حقوق المبدعين. لا نستضيف ملفات فيديو على خوادمنا: تعرض صفحاتنا معلومات من TMDB وتحيل إلى محتوى تستضيفه جهات خارجية مستقلة أو تضمّنه. إذا كنت تعتقد أن صفحة على TunisiaFlicks تحيل إلى محتوى ينتهك حقوقك أو تضمّنه، أرسل لنا إشعارًا وسنحذف الرابط أو المحتوى المضمّن.',
    sections: [
      {
        heading: 'ما يجب أن يتضمنه الإشعار',
        bullets: [
          'اسمك وبيانات التواصل معك (بريد إلكتروني يمكننا الرد عليه).',
          'العمل المحمي بحقوق النشر الذي تعتقد أنه تم انتهاكه.',
          'العنوان (الرابط) الدقيق لصفحة أو صفحات TunisiaFlicks التي يظهر فيها المحتوى.',
          'تصريح بأنك تعتقد بحسن نية أن هذا الاستخدام غير مرخص من صاحب الحقوق أو وكيله أو القانون.',
          'تصريح بأن المعلومات الواردة في الإشعار دقيقة، وأنك، تحت طائلة المسؤولية القانونية، صاحب الحقوق أو مخوّل بالتصرف نيابة عنه.',
          'توقيعك المادي أو الإلكتروني (كتابة اسمك الكامل كافية).',
        ],
      },
      {
        heading: 'ماذا يحدث بعد ذلك',
        paragraphs: [
          'نراجع الإشعارات بسرعة، عادة خلال أيام عمل قليلة، ونحذف الروابط أو المحتوى المضمّن المُبلغ عنه أو نعطّله عندما يكون الإشعار صحيحًا. وبما أن الملفات نفسها مستضافة في مكان آخر، ننصحك أيضًا بإبلاغ جهة الاستضافة مباشرة.',
          'إذا كنت تعتقد أن محتوى حُذف عن طريق الخطأ، يمكنك إرسال إشعار مضاد عبر النموذج نفسه مع التفاصيل أعلاه. قد تُغلق الحسابات التي تنشر محتوى منتهكًا بشكل متكرر.',
        ],
      },
    ],
  },
}

const docs: Partial<Record<Locale, Record<LegalPageId, LegalDoc>>> = { en, ar }

/** Arabic-script locales without their own text use the Arabic version; everything else English. */
export function getLegalDoc(page: LegalPageId, locale: Locale): LegalDoc {
  return (docs[locale] ?? (locale === 'en' ? en : ar))[page]
}
