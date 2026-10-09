// Content of the About / Privacy / Terms / DMCA pages, per UI language.
//
// Written to match how the site actually works (TMDB metadata, third-party players and download
// sources, no video files hosted by us). It is a sensible starting point, not legal advice: have it
// reviewed before relying on it. The French text lives in ./legal-fr.ts; Derja falls back to the
// Arabic text, any other language to the English one.
import { isArabicScript, type Locale } from '@/src/lib/i18n/locales'
import { fr } from '@/src/lib/legal-fr'

export type LegalSection = { heading: string, paragraphs?: string[], bullets?: string[] }
export type LegalDoc = { title: string, description: string, intro: string, sections: LegalSection[] }
export type LegalPageId = 'about' | 'privacy' | 'terms' | 'dmca'

export const LEGAL_UPDATED = '2026-10-09'

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
          'The site speaks English, French, Arabic and Tunisian Derja. Titles and summaries follow your language where TMDB has a translation.',
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
          'Your interface language (English, French, Arabic or Tunisian): kept in a cookie on this device and, when you are signed in, with your account and your notification subscriptions, so that emails and notifications reach you in it.',
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
          'We do not sell or rent your data. It is processed only by the providers that run the service: hosting (Vercel), database (MongoDB Atlas) and email delivery, and, only for what each feature below describes, AI search (Groq, only the words you type in Ask), soundtracks (Deezer) and support payments (Ko-fi). When you press play, the video player you chose is a third-party service with its own privacy policy, as are YouTube videos.',
        ],
      },
      {
        heading: 'Friends and ratings',
        paragraphs: [
          'Friends, ratings and your page are off until you turn them on. A profile can create a page with a handle and choose who sees its activity and ratings: only you, or your friends (ratings can also be shown to anyone with your link).',
          'Friends see what you watched with a delay, and only from the moment you turned sharing on. A note sent with a recommendation is limited to 140 characters; there is no chat. A block covers the whole account. Deleting a page or an account removes its friendships, invites, ratings and notifications. Kids profiles never have a page.',
        ],
      },
      {
        heading: 'E-mails',
        paragraphs: [
          'The weekly digest is opt-in, per profile, and goes to your account’s confirmed address. It has no tracking pixels and no tracked links, and every e-mail can be unsubscribed from in one click. We keep a record of each delivery for 120 days. Release-alert e-mails have their own switch for the whole account in Settings.',
        ],
      },
      {
        heading: 'Interface language',
        paragraphs: [
          'We remember your interface language (English, French, Arabic or Tunisian) in a cookie, and in your account when you are signed in, so the site opens in your language.',
        ],
      },
      {
        heading: 'Shared lists',
        paragraphs: [
          'You choose who can see each list: only you (or the people in it), your friends, or anyone with the link. Lists made before this choice existed stay visible to anyone with their link. People you invite to build a list see your name and photo next to the titles you add, and the list’s recent changes. Invitation links work for 30 days and for up to 8 people, and you can turn them off.',
          'If you delete your account, a list others build with you goes to the person who has been in it longest; your other lists are deleted, and your name is taken off lists you helped build.',
        ],
      },
      {
        heading: 'Movie nights',
        paragraphs: [
          'Only the people invited to a movie night see its name, place and note. Someone holding its link sees only the date, the host’s first name and the posters; when a place or a note is set, the host approves anyone joining through the link. Votes are visible to the night’s members, and a swipe room linked to a night shows the night’s name only to them. The calendar file is served only to the host and to the guests who are going. Nights are deleted 14 days after they end.',
        ],
      },
      {
        heading: 'Badges and streak',
        paragraphs: [
          'Badges and streak keeps, per profile, a private daily log of the days you pressed play: which titles were played that day and, for grown-up profiles only, whether it was at night (00:00–04:59) or early (05:00–08:59). No times are stored. Your browser’s time zone is used only to choose the day and is never stored. The log is kept for 13 months, and turning Badges and streak off in Settings deletes it. Others never see the night and early badges, or whether you played this week.',
        ],
      },
      {
        heading: 'Supporting us',
        paragraphs: [
          'Coffees are paid on Ko-fi, never on this site. To match a coffee to an account we keep only a keyed hash of the payer’s e-mail address, the Ko-fi transaction id, the TF- code if one was written in the message, and the date, for 400 days. Never the e-mail address itself, a name, an amount or the message. A supporter’s name appears on the support page only if they choose so.',
        ],
      },
      {
        heading: 'Ask (AI search)',
        paragraphs: [
          'When you use Ask, the words you type are sent to Groq, which runs the AI model that turns them into a search; e-mail addresses, links and phone numbers are removed first. Nothing else is sent: not your account, your profile, your IP address or what you watch. We keep what a request meant, filed under a one-way fingerprint of the words rather than the words themselves, for up to 14 days so the same question is answered faster, and daily counts with no text for 90 days.',
          'Visitors who are not signed in get a random first-party cookie (tf-gid, one year) used only for fair-use limits. Ask is not offered on Kids profiles or in TV mode.',
        ],
      },
      {
        heading: 'Videos, Tunisian TV and soundtracks',
        paragraphs: [
          'Trailers, extras and the Tunisian channels’ videos come from YouTube. Their pictures reach you through our server, so YouTube is only contacted when you press play; the video then plays from YouTube (youtube-nocookie.com), under its own privacy policy. Soundtracks come from Deezer: we keep which album matches a title, never anything about you, and a track preview plays from Deezer only when you press it. A report that an album is wrong is counted once per network address, without storing that address.',
        ],
      },
      {
        heading: 'TVs signed in from a phone',
        paragraphs: [
          'To sign a TV in, you approve the code it shows from your phone. A TV session is tied to one profile and cannot change your e-mail address, password, profiles or page. You see every signed-in TV in Settings, with its device type and when it was last used, and can sign it out there; it is signed out within 5 minutes. Pairing codes expire after 10 minutes.',
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
          'Lists you share and anything else you publish must not be offensive, misleading or infringing. We may remove such content.',
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
          'الموقع متاح بالإنجليزية والفرنسية والعربية والدارجة التونسية. تظهر الملخصات بلغتك عندما تتوفر لها ترجمة على TMDB.',
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
          'لغة الواجهة (الإنجليزية أو الفرنسية أو العربية أو التونسية): تُحفظ في ملف تعريف ارتباط على هذا الجهاز، وعند تسجيل الدخول مع حسابك واشتراكات الإشعارات، حتى تصلك الرسائل والإشعارات بها.',
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
          'لا نبيع بياناتك ولا نؤجرها. تتم معالجتها فقط من قبل مزودي الخدمات الذين يشغّلون الموقع: الاستضافة (Vercel) وقاعدة البيانات (MongoDB Atlas) وخدمة البريد الإلكتروني، وفي حدود ما تصفه الأقسام أدناه فقط: البحث بالذكاء الاصطناعي (Groq، الكلمات التي تكتبها في «اسأل» فقط)، والموسيقى التصويرية (Deezer)، ومدفوعات الدعم (Ko-fi). عند الضغط على تشغيل، يكون المشغّل الذي اخترته خدمة خارجية لها سياسة خصوصيتها، وكذلك فيديوهات يوتيوب.',
        ],
      },
      {
        heading: 'الأصدقاء والتقييمات',
        paragraphs: [
          'الأصدقاء والتقييمات وصفحتك متوقفة إلى أن تفعّلها بنفسك. يمكن لكل ملف أن ينشئ صفحة باسم مستخدم ويختار من يرى نشاطه وتقييماته: أنت وحدك، أو أصدقاؤك (ويمكن أيضًا إظهار التقييمات لكل من يملك رابطك).',
          'يرى أصدقاؤك ما شاهدته بعد مهلة، وفقط منذ أن فعّلت المشاركة. الملاحظة المرفقة بالتوصية لا تتجاوز 140 حرفًا، ولا توجد محادثة. الحظر يشمل الحساب كله. حذف الصفحة أو الحساب يحذف معه الصداقات والدعوات والتقييمات والإشعارات. ملفات الأطفال لا تملك صفحة أبدًا.',
        ],
      },
      {
        heading: 'الرسائل الإلكترونية',
        paragraphs: [
          'النشرة الأسبوعية اختيارية، لكل ملف على حدة، وتصل إلى البريد المؤكَّد لحسابك. لا تحتوي على أي متتبّع ولا روابط مُتتبَّعة، ويمكن إلغاء الاشتراك في كل رسالة بنقرة واحدة. نحتفظ بسجل كل إرسال لمدة 120 يومًا. ولرسائل تنبيهات الإصدارات مفتاح خاص بها للحساب كله في الإعدادات.',
        ],
      },
      {
        heading: 'لغة الواجهة',
        paragraphs: [
          'نتذكر لغة الواجهة التي اخترتها (الإنجليزية أو الفرنسية أو العربية أو التونسية) في ملف تعريف ارتباط، وفي حسابك عندما تكون مسجّل الدخول، حتى يُفتح الموقع بلغتك.',
        ],
      },
      {
        heading: 'القوائم المشتركة',
        paragraphs: [
          'أنت من يختار من يرى كل قائمة: أنت وحدك (أو أعضاؤها)، أو أصدقاؤك، أو كل من يملك الرابط. القوائم التي أُنشئت قبل وجود هذا الخيار تبقى ظاهرة لكل من يملك رابطها. يرى من تدعوهم لبناء قائمة معك اسمك وصورتك بجانب العناوين التي تضيفها، وآخر التغييرات في القائمة. تعمل روابط الدعوة 30 يومًا ولثمانية أشخاص على الأكثر، ويمكنك إيقافها.',
          'إذا حذفت حسابك، تنتقل القائمة التي يبنيها معك آخرون إلى أقدم عضو فيها، وتُحذف قوائمك الأخرى، ويُزال اسمك من القوائم التي ساهمت فيها.',
        ],
      },
      {
        heading: 'سهرات الأفلام',
        paragraphs: [
          'لا يرى اسم السهرة ومكانها وملاحظتها إلا المدعوون إليها. من يملك رابطها يرى التاريخ والاسم الأول للمضيف والملصقات فقط، وعندما يُحدَّد مكان أو ملاحظة يوافق المضيف على كل من ينضم عبر الرابط. الأصوات ظاهرة لأعضاء السهرة، وغرفة الاختيار المرتبطة بسهرة لا تُظهر اسمها إلا لهم. لا يُقدَّم ملف التقويم إلا للمضيف وللضيوف الحاضرين. تُحذف السهرات بعد 14 يومًا من انتهائها.',
        ],
      },
      {
        heading: 'الشارات والسلسلة',
        paragraphs: [
          'تحتفظ «الشارات والسلسلة»، لكل ملف، بسجل يومي خاص بالأيام التي ضغطت فيها على تشغيل: ما العناوين التي شُغّلت ذلك اليوم، ولملفات الكبار فقط، هل كان ذلك ليلًا (00:00–04:59) أو باكرًا (05:00–08:59). لا نخزّن أي توقيت. تُستعمل المنطقة الزمنية لمتصفحك لتحديد اليوم فقط ولا تُخزَّن. يُحفظ السجل 13 شهرًا، وإيقاف «الشارات والسلسلة» من الإعدادات يحذفه. لا يرى الآخرون أبدًا شارات الليل والصباح الباكر، ولا إن كنت شاهدت هذا الأسبوع.',
        ],
      },
      {
        heading: 'دعمنا',
        paragraphs: [
          'تُدفع القهوة على Ko-fi، لا على هذا الموقع أبدًا. لربط قهوة بحساب، لا نحتفظ إلا ببصمة مشفّرة بمفتاح لبريد الدافع الإلكتروني، ومعرّف عملية Ko-fi، ورمز TF- إن كُتب في الرسالة، والتاريخ، لمدة 400 يوم. لا نحتفظ أبدًا بالبريد نفسه ولا بالاسم ولا بالمبلغ ولا بالرسالة. لا يظهر اسم الداعم في صفحة الدعم إلا إذا اختار ذلك.',
        ],
      },
      {
        heading: '«اسأل» (البحث بالذكاء الاصطناعي)',
        paragraphs: [
          'عندما تستعمل «اسأل»، تُرسَل الكلمات التي تكتبها إلى Groq التي تشغّل نموذج الذكاء الاصطناعي الذي يحوّلها إلى بحث، بعد حذف عناوين البريد الإلكتروني والروابط وأرقام الهاتف. لا يُرسَل شيء آخر: لا حسابك ولا ملفك الشخصي ولا عنوان IP ولا ما تشاهده. نحتفظ بمعنى الطلب، مسجّلًا ببصمة أحادية الاتجاه للكلمات لا بالكلمات نفسها، مدة أقصاها 14 يومًا كي يُجاب السؤال نفسه أسرع، وبإحصاءات يومية بلا نص مدة 90 يومًا.',
          'يحصل الزوار غير المسجّلين على ملف تعريف ارتباط عشوائي من الموقع نفسه (tf-gid، لمدة سنة) لا يُستعمل إلا لحدود الاستخدام العادل. لا تتوفر «اسأل» في ملفات الأطفال ولا في وضع التلفاز.',
        ],
      },
      {
        heading: 'الفيديوهات والتلفزة التونسية والموسيقى التصويرية',
        paragraphs: [
          'تأتي الإعلانات والمقاطع الإضافية وفيديوهات القنوات التونسية من يوتيوب. تصلك صورها عبر خادمنا، فلا يُتّصل بيوتيوب إلا عند الضغط على تشغيل، ثم يُشغَّل الفيديو من يوتيوب (youtube-nocookie.com) وفق سياسة خصوصيته. تأتي الموسيقى التصويرية من Deezer: نحتفظ بالألبوم المطابق لكل عنوان، ولا شيء عنك، ولا يُشغَّل مقطع من Deezer إلا عند الضغط عليه. يُحتسب البلاغ عن ألبوم خاطئ مرة واحدة لكل عنوان شبكة، دون تخزين هذا العنوان.',
        ],
      },
      {
        heading: 'أجهزة التلفاز المتصلة من الهاتف',
        paragraphs: [
          'لربط تلفاز، توافق من هاتفك على الرمز الذي يظهر عليه. جلسة التلفاز مرتبطة بملف واحد ولا يمكنها تغيير بريدك الإلكتروني أو كلمة مرورك أو ملفاتك أو صفحتك. ترى كل تلفاز متصل في الإعدادات، مع نوع الجهاز وآخر استعمال، ويمكنك فصله من هناك، فيُفصل خلال 5 دقائق. تنتهي صلاحية رموز الربط بعد 10 دقائق.',
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
          'يجب ألا تكون القوائم التي تشاركها وأي محتوى تنشره مسيئًا أو مضللًا أو منتهكًا للحقوق، ويحق لنا حذفه.',
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

const docs: Partial<Record<Locale, Record<LegalPageId, LegalDoc>>> = { en, ar, fr }

/** A language without its own text: Arabic for Arabic-script ones (Derja), English for the others. */
export function getLegalDoc(page: LegalPageId, locale: Locale): LegalDoc {
  return (docs[locale] ?? (isArabicScript(locale) ? ar : en))[page]
}
