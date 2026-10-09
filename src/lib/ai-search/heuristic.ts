// The simple parser: what Ask falls back on when the model can't be used (the daily budget is
// spent, a limit is reached, the model is down). A phrase table in English, French, Arabic,
// Derja and Arabizi (about 150 entries) plus a few patterns (decades, years, "like X", "under 90
// minutes"). Its answer has the model's shape (RawPlan), so the rest of the pipeline is shared.
// No AI is involved, so its results never carry the AI mark.
import { normalizeQuery, withoutArticle } from './normalize'
import type { GenreKey, SortKey } from './vocab'
import type { Kind, RawPlan } from './types'

type Effect =
  | { genre: GenreKey }
  | { kind: Kind }
  | { country: string }
  | { sort: SortKey, rating?: number }
  | { runtimeMax: number }
  | { runtimeMin: number }
  | { keyword: string }
  | { place: string }
  | { recent: true }
  | { classic: true }
  | { stop: true }
  | { skip: true }

// [phrases (written naturally, normalized at load), effect]
const TABLE: [string, Effect][] = [
  // genres
  ['comedy|comedies|funny|hilarious|laugh|laughs|comic|feel good|cozy|comforting|reconfortant|reconfortante|مريح|مريحة|يرتح|comedie|comedies|drole|droles|marrant|marrants|rigolo|humour|كوميدي|كوميدية|كوميديا|مضحك|مضحكة|مضحكين|يضحك|تضحك|ضحك|mod7ik|mode7|dhe7k|ydha7ek', { genre: 'comedy' }],
  ['horror|scary|creepy|frightening|terrifying|horreur|peur|effrayant|effrayants|flippant|رعب|مرعب|مرعبة|مخيف|مخيفة|يخوف|تخوف|ra3b|mo5if', { genre: 'horror' }],
  ['romance|romantic|romcom|love story|love stories|romantique|romantiques|amour|histoire d amour|histoires d amour|رومانسي|رومانسية|حب|غرام|قصة حب|قصص حب|romansi|7ob', { genre: 'romance' }],
  ['action|explosive|اكشن|أكشن|حركة|akchn|akshen|action films', { genre: 'action' }],
  ['adventure|adventures|aventure|aventures|مغامرة|مغامرات', { genre: 'adventure' }],
  ['thriller|thrillers|suspense|tense|gripping|إثارة|تشويق|مشوق|مشوقة', { genre: 'thriller' }],
  ['drama|dramas|dramatic|sad|tearjerker|emotional|drame|drames|triste|tristes|دراما|درامي|درامية|حزين|حزينة', { genre: 'drama' }],
  ['animated|animation|cartoon|cartoons|dessin anime|dessins animes|رسوم متحركة|كرتون|انمي|kartoun', { genre: 'animation' }],
  ['documentary|documentaries|documentaire|documentaires|وثائقي|وثائقية|وثائقيات', { genre: 'documentary' }],
  ['sci fi|scifi|science fiction|futuristic|خيال علمي', { genre: 'scifi' }],
  ['fantasy|fantastique|magical|فانتازيا|خيالي|خيالية', { genre: 'fantasy' }],
  ['mystery|mysteries|whodunit|detective|mystere|enquete|غموض|لغز|بوليسي|بوليسية', { genre: 'mystery' }],
  ['crime|gangster|gangsters|policier|policiers|policiere|policieres|polar|جريمة|جرائم|عصابات', { genre: 'crime' }],
  ['war|guerre|حرب|حروب', { genre: 'war' }],
  ['western|westerns|cowboy|cowboys', { genre: 'western' }],
  ['family|families|kids|children|famille|familial|familiaux|enfants|عائلي|عائلية|عائلة|العائلة|العايلة|عايلة|اطفال|صغار|3ayla|sghar', { genre: 'family' }],
  ['historical|history|historique|historiques|تاريخي|تاريخية', { genre: 'history' }],
  ['musical|musicals|comedie musicale|موسيقي|موسيقية', { genre: 'music' }],
  // openers that carry no filter (before 'show' means series)
  ['show me|give me|find me|tell me|i want|looking for|in the mood for|what to watch|set in|qui se passe', { skip: true }],
  // films or series
  ['movie|movies|film|films|filme|فيلم|افلام|أفلام|aflem|aflam', { kind: 'movie' }],
  ['series|serie|show|shows|tv show|tv shows|tv series|miniseries|feuilleton|مسلسل|مسلسلات|msalsel|msalsla|k drama|kdrama|k dramas', { kind: 'tv' }],
  ['sitcom|sitcoms', { genre: 'comedy' }],
  // where from
  ['korean|korea|coreen|coreens|coreenne|coreennes|coree|كوري|كورية|كوريا|kouri', { country: 'KR' }],
  ['turkish|turkey|turc|turcs|turque|turques|تركي|تركية|تركيا|torki', { country: 'TR' }],
  ['egyptian|egypt|egyptien|egyptiens|egyptienne|egyptiennes|مصري|مصرية|مصر|masri', { country: 'EG' }],
  ['tunisian|tunisia|tunisien|tunisiens|tunisienne|tunisiennes|تونسي|تونسية|تونس|tounsi|tounsia', { country: 'TN' }],
  ['french|france|francais|francaise|francaises|فرنسي|فرنسية', { country: 'FR' }],
  ['japanese|japan|japonais|japonaise|japonaises|ياباني|يابانية|anime', { country: 'JP' }],
  ['indian|india|bollywood|indien|indiens|indienne|هندي|هندية', { country: 'IN' }],
  ['american|hollywood|usa|americain|americains|americaine|امريكي|امريكية|أمريكي|أمريكية', { country: 'US' }],
  ['british|britannique|britanniques|بريطاني|بريطانية', { country: 'GB' }],
  ['spanish|spain|espagnol|espagnols|espagnole|اسباني|اسبانية|إسباني', { country: 'ES' }],
  ['italian|italy|italien|italiens|italienne|ايطالي|ايطالية|إيطالي', { country: 'IT' }],
  ['chinese|china|chinois|chinoise|صيني|صينية', { country: 'CN' }],
  ['german|germany|allemand|allemands|allemande|الماني|المانية|ألماني', { country: 'DE' }],
  ['moroccan|morocco|marocain|marocains|marocaine|مغربي|مغربية', { country: 'MA' }],
  ['algerian|algeria|algerien|algeriens|algerienne|جزائري|جزائرية|dzayri', { country: 'DZ' }],
  ['syrian|syrien|syriens|syrienne|سوري|سورية', { country: 'SY' }],
  ['lebanese|libanais|libanaise|لبناني|لبنانية', { country: 'LB' }],
  ['saudi|saoudien|saoudienne|سعودي|سعودية', { country: 'SA' }],
  ['iranian|persian|iranien|iraniens|ايراني|ايرانية|إيراني', { country: 'IR' }],
  ['mexican|mexicain|mexicains|مكسيكي', { country: 'MX' }],
  ['arab|arabe|arabes|عربي|عربية|3arbi', { country: 'arab' }],
  ['maghreb|maghrebin|maghrebins|north african|مغاربي|مغاربية', { country: 'maghreb' }],
  ['gulf|khaleeji|khaliji|خليجي|خليجية', { country: 'gulf' }],
  ['nordic|scandinavian|scandinave|scandinaves', { country: 'nordic' }],
  ['latin american|latino|latinos', { country: 'latin_america' }],
  // quality and order
  ['best|top|greatest|acclaimed|award winning|masterpiece|masterpieces|of all time|meilleur|meilleurs|meilleure|meilleures|culte|de tous les temps|افضل|أفضل|احسن|أحسن|على الاطلاق|في التاريخ|a7sen|ahsen', { sort: 'top', rating: 7 }],
  ['popular|trending|famous|populaire|populaires|مشهور|مشهورة|مشهورين|mashhour', { sort: 'pop' }],
  ['recent|latest|new|newest|recents|recentes|nouveau|nouveaux|nouvelle|nouvelles|جديد|جديدة|حديث|حديثة|jdid', { recent: true }],
  ['classic|classics|old|oldies|classique|classiques|ancien|anciens|قديم|قديمة|كلاسيكي|كلاسيكية|9dim', { classic: true }],
  // length
  ['short|shorter|quick|court|courts|courte|plus court|قصير|قصيرة|أقصر|اقصر|9sir', { runtimeMax: 100 }],
  ['long|longer|epic|epics|longs|طويل|طويلة|twil', { runtimeMin: 140 }],
  // themes (TMDB keyword names)
  ['time travel|voyage dans le temps|السفر عبر الزمن|السفر في الزمن', { keyword: 'time travel' }],
  ['heist|heists|robbery|casse|braquage|سرقة|سطو', { keyword: 'heist' }],
  ['zombie|zombies|زومبي', { keyword: 'zombie' }],
  ['vampire|vampires|مصاصي الدماء|مصاص دماء', { keyword: 'vampire' }],
  ['superhero|superheroes|super heros|ابطال خارقين|أبطال خارقين', { keyword: 'superhero' }],
  ['robot|robots|روبوت|روبوتات', { keyword: 'robot' }],
  ['alien|aliens|extraterrestre|extraterrestres|كائنات فضائية', { keyword: 'alien' }],
  ['dinosaur|dinosaurs|dinosaure|dinosaures|ديناصورات', { keyword: 'dinosaur' }],
  ['serial killer|tueur en serie|قاتل متسلسل', { keyword: 'serial killer' }],
  ['revenge|vengeance|انتقام', { keyword: 'revenge' }],
  ['true story|based on a true story|histoire vraie|قصة حقيقية', { keyword: 'based on true story' }],
  ['ww2|world war 2|world war ii|seconde guerre mondiale|الحرب العالمية الثانية', { keyword: 'world war ii' }],
  ['christmas|noel|عيد الميلاد', { keyword: 'christmas' }],
  ['ramadan|رمضان|رمضانية', { keyword: 'ramadan' }],
  ['prison|سجن', { keyword: 'prison' }],
  ['spy|spies|espion|espions|espionnage|جاسوس|جواسيس', { keyword: 'spy' }],
  ['pirate|pirates|قراصنة', { keyword: 'pirate' }],
  ['ghost|ghosts|fantome|fantomes|اشباح|أشباح', { keyword: 'ghost' }],
  ['twist|plot twist|twist ending|retournement|نهاية غير متوقعة|بنهاية غير متوقعة|غير متوقعة|ما تتوقعهاش|بنهاية ما تتوقعهاش', { keyword: 'twist ending' }],
  ['high school|lycee', { keyword: 'high school' }],
  ['coming of age', { keyword: 'coming of age' }],
  ['road trip', { keyword: 'road trip' }],
  ['martial arts|kung fu|arts martiaux|فنون قتالية', { keyword: 'martial arts' }],
  ['sport|sports|رياضة', { keyword: 'sports' }],
  ['football|soccer|كرة القدم|koura', { keyword: 'football (soccer)' }],
  ['boxing|boxe|ملاكمة', { keyword: 'boxing' }],
  ['magic|magie|سحر', { keyword: 'magic' }],
  ['shark|sharks|requin|requins', { keyword: 'shark' }],
  ['survival|survie', { keyword: 'survival' }],
  ['dystopia|dystopian|dystopie', { keyword: 'dystopia' }],
  ['artificial intelligence|ذكاء اصطناعي', { keyword: 'artificial intelligence (a.i.)' }],
  ['friendship|amitie|صداقة', { keyword: 'friendship' }],
  ['biopic|biopics|biography|biographie|سيرة ذاتية', { keyword: 'biography' }],
  ['space|espace|الفضاء', { keyword: 'space' }],
  // where it's set
  ['paris|باريس', { place: 'paris, france' }],
  ['new york|nyc|نيويورك', { place: 'new york city' }],
  ['london|londres|لندن', { place: 'london, england' }],
  ['europe|اوروبا|أوروبا', { place: 'europe' }],
  ['desert|صحراء|الصحراء', { place: 'desert' }],
  ['cairo|le caire|القاهرة', { place: 'cairo, egypt' }],
  // words that carry no filter
  [[
    'a an the some something anything i im i d want wanna watch to me show me give find recommend suggest please with without for of in on at and or but',
    'not too very really that is are be good great nice cool tonight today day night rainy whole all one ones stuff kind type set about from my we us',
    'looking mood would it its this these those any more less than so just get see what should can could made',
    'je j veux voudrais aimerais un une des le la les de du d l a au aux avec sans pour quelque chose voir regarder ce soir qui se passe dans en et ou mais',
    'pas trop tres bien bon bonne ma mon on toute toutes tous sur jour pluie quelque',
    'ابي ابغي اريد أريد نحب حاب نشوف شوف عطيني اعطني اعطيني شي شيء حاجة فما فيه في من على مع و او أو ولا ما باش بش متاع نتاع برشا الليلة ليلة يوم ليوم ممطر مطر فيه هذه هذا لهذه لكل كل عن لكن اما أما بنهاية تجري احداثه أحداثه للعايلة الكل للّيلة صاير على شيء لـ ل',
    'n7eb nheb nhb 7ab chouf nchouf 3tini a3tini haja 7aja fama famma fil fi mta3 w wala barcha lel lil',
  ].join(' '), { stop: true }],
]

const PHRASES = new Map<string, Effect>()
let longest = 1
for (const [phrases, effect] of TABLE) {
  const list = 'stop' in effect ? phrases.split(/\s+/) : phrases.split('|')
  for (const phrase of list) {
    const key = normalizeQuery(phrase)
    if (!key) continue
    // The first entry wins: a word listed twice keeps its first meaning.
    if (!PHRASES.has(key)) PHRASES.set(key, effect)
    longest = Math.max(longest, key.split(' ').length)
  }
}

/** How many phrases the parser knows (the unit tests keep it near 150 entries). */
export const PHRASE_COUNT = PHRASES.size
export const TABLE_SIZE = TABLE.length

const DECADE_WORDS: Record<string, number> = {
  fifties: 1950, sixties: 1960, seventies: 1970, eighties: 1980, nineties: 1990,
  الخمسينات: 1950, الستينات: 1960, السبعينات: 1970, الثمانينات: 1980, التسعينات: 1990,
  خمسينات: 1950, ستينات: 1960, سبعينات: 1970, ثمانينات: 1980, تسعينات: 1990, الالفينات: 2000,
}
const FROM_WORDS = new Set(['after', 'since', 'from', 'depuis', 'apres', 'بعد', 'منذ', 'من'])
const TO_WORDS = new Set(['before', 'until', 'avant', 'jusqu', 'قبل', 'حتى'])
const UNDER = new Set(['under', 'less', 'shorter', 'max', 'maximum', 'moins', 'اقل', 'اقصر'])
const OVER = new Set(['over', 'more', 'longer', 'plus', 'اكثر', 'اطول'])
const MINUTE_WORDS = new Set(['min', 'mins', 'minute', 'minutes', 'mn', 'دقيقه', 'دقائق', 'دقيقة'])
const HOUR_WORDS = new Set(['h', 'hour', 'hours', 'heure', 'heures', 'ساعه', 'ساعات', 'ساعتين'])
const LIKE_TRIGGERS = [['similar', 'to'], ['like'], ['comme'], ['genre', 'de'], ['مثل'], ['كيف'], ['kif'], ['kima'], ['كما']]
const LIKE_LEADS = new Set(['', 'movie', 'movies', 'film', 'films', 'series', 'show', 'shows', 'something', 'anything', 'stuff', 'one', 'chose', 'فيلم', 'افلام', 'مسلسل', 'شي', 'شيء', 'حاجه', 'haja', '7aja', 'aflem'].map(normalizeQuery))
const LIKE_ENDS = new Set(['but', 'mais', 'ama', 'اما', 'لكن', 'with', 'avec', 'from', 'des', 'in', 'en', 'set', 'for', 'pour', 'and', 'et', 'و', 'مع', 'من', 'في', 'm3a'])

// "No horror", "sans horreur", "بدون رعب": the genre right after one of these is excluded.
const NEGATIONS = new Set(['no', 'without', 'sans', 'pas', 'aucun', 'بدون', 'بلا', 'غير', 'منغير', 'bla', 'bidoun'].map(normalizeQuery))

const year = (token: string) => (/^(?:19|20)\d\d$/.test(token) ? Number(token) : null)

/**
 * The parser's plan for a request: what it recognised, the words it couldn't use (`unmatched`),
 * and whether it understood everything (`complete`).
 */
export function quickPlan(q: string, now = new Date()): RawPlan & { complete: boolean } {
  const text = normalizeQuery(q)
  const tokens = text ? text.split(' ') : []
  const used = tokens.map(() => false)
  const plan: RawPlan = {
    intent: 'discover', title: null, kind: 'any', genres: [], without: [], keywords: [], places: [], countries: [], languages: [], people: [],
    like: null, years: null, runtime: null, minRating: null, sort: 'rel', unmatched: [],
  }
  const span = (from: number, to: number) => tokens.slice(from, to).join(' ')
  const mark = (from: number, to: number) => { for (let k = from; k < to; k++) used[k] = true }
  const thisYear = now.getUTCFullYear()

  // "like Inception (but shorter)": the words after the comparison, up to a joining word.
  for (let i = 0; i < tokens.length && !plan.like; i++) {
    for (const trigger of LIKE_TRIGGERS) {
      if (trigger.some((word, k) => tokens[i + k] !== word)) continue
      const lead = i === 0 ? '' : tokens[i - 1]
      if (!LIKE_LEADS.has(lead)) continue
      const start = i + trigger.length
      let end = start
      while (end < tokens.length && !LIKE_ENDS.has(tokens[end])) end++
      if (end > start && end - start <= 6) {
        plan.like = { title: span(start, end), year: null, span: span(i, end) }
        mark(i, end)
      }
      break
    }
  }

  // Decades: 90s, 1990s, "années 90", "التسعينات", "nineties".
  const decadeOf = (digit: string) => (Number(digit) >= 3 ? 1900 : 2000) + Number(digit) * 10
  for (let i = 0; i < tokens.length && !plan.years; i++) {
    if (used[i]) continue
    const token = tokens[i]
    let decade: number | null = null
    let size = 1
    const short = /^(19|20)?(\d)0s$/.exec(token)
    if (short) decade = short[1] ? Number(`${short[1]}${short[2]}0`) : decadeOf(short[2])
    else if (DECADE_WORDS[token] !== undefined) decade = DECADE_WORDS[token]
    else if ((token === 'annees' || token === 'سنوات') && i + 1 < tokens.length) {
      const next = tokens[i + 1]
      const two = /^(\d)0$/.exec(next)
      if (two) decade = decadeOf(two[1])
      else if (/^(?:19|20)\d0$/.test(next)) decade = Number(next)
      else if (next === 'الالفين' || next === 'الالفينات') decade = 2000
      size = 2
    }
    if (decade == null) continue
    plan.years = { from: decade, to: Math.min(decade + 9, thisYear + 1), span: span(i, i + size) }
    mark(i, i + size)
  }

  // Years: "after 2015", "before 2000", "2010 2015", a single year.
  for (let i = 0; i < tokens.length && !plan.years; i++) {
    const value = year(tokens[i])
    if (value == null || used[i] || value > thisYear + 1) continue
    const previous = i > 0 ? tokens[i - 1] : ''
    const nextYear = i + 1 < tokens.length ? year(tokens[i + 1]) : null
    if (nextYear != null && nextYear >= value) {
      plan.years = { from: value, to: nextYear, span: span(i, i + 2) }
      mark(i, i + 2)
    } else if (FROM_WORDS.has(previous)) {
      plan.years = { from: value, to: null, span: span(i - 1, i + 1) }
      mark(i - 1, i + 1)
    } else if (TO_WORDS.has(previous)) {
      plan.years = { from: null, to: value, span: span(i - 1, i + 1) }
      mark(i - 1, i + 1)
    } else {
      plan.years = { from: value, to: value, span: tokens[i] }
      mark(i, i + 1)
    }
  }

  // Length: "under 90 minutes", "less than 2 hours", "over 2 hours".
  for (let i = 0; i < tokens.length && !plan.runtime; i++) {
    const direction = UNDER.has(tokens[i]) ? 'max' : OVER.has(tokens[i]) ? 'min' : null
    if (!direction) continue
    let j = i + 1
    if (tokens[j] === 'than' || tokens[j] === 'de' || tokens[j] === 'من') j++
    const amount = /^\d{1,3}$/.test(tokens[j] ?? '') ? Number(tokens[j]) : null
    if (amount == null) continue
    const unit = tokens[j + 1] ?? ''
    const minutes = HOUR_WORDS.has(unit) || (!MINUTE_WORDS.has(unit) && amount <= 4) ? amount * 60 : amount
    const end = HOUR_WORDS.has(unit) || MINUTE_WORDS.has(unit) ? j + 2 : j + 1
    if (minutes < 20 || minutes > 400) continue
    plan.runtime = direction === 'max' ? { min: null, max: minutes, span: span(i, end) } : { min: minutes, max: null, span: span(i, end) }
    mark(i, end)
  }

  // The phrase table, longest phrases first.
  const country = new Set<string>()
  for (let size = longest; size >= 1; size--) {
    for (let i = 0; i + size <= tokens.length; i++) {
      if (used.slice(i, i + size).some(Boolean)) continue
      const words = span(i, i + size)
      // One Arabic word may carry its article or a joined preposition ('الوثائقية', 'بالعربي').
      const effect = PHRASES.get(words) ?? (size === 1 ? PHRASES.get(withoutArticle(words)) : undefined)
      if (!effect) continue
      mark(i, i + size)
      if ('stop' in effect || 'skip' in effect) continue
      if ('genre' in effect) {
        // "no horror", or "pas d'horreur" (two words before it).
        const negation = i > 0 && NEGATIONS.has(tokens[i - 1]) ? 1 : i > 1 && tokens[i - 2] === 'pas' && (tokens[i - 1] === 'd' || tokens[i - 1] === 'de') ? 2 : 0
        if (negation) {
          if (!plan.without.some((genre) => genre.id === effect.genre) && plan.without.length < 3) plan.without.push({ id: effect.genre, span: span(i - negation, i + size) })
          mark(i - negation, i)
        } else if (!plan.genres.some((genre) => genre.id === effect.genre) && plan.genres.length < 3) {
          plan.genres.push({ id: effect.genre, span: words })
        }
      } else if ('kind' in effect) {
        plan.kind = plan.kind === 'any' || plan.kind === effect.kind ? effect.kind : 'any'
      } else if ('country' in effect) {
        if (!country.has(effect.country)) { country.add(effect.country); plan.countries.push({ code: effect.country, span: words }) }
      } else if ('sort' in effect) {
        plan.sort = effect.sort
        if (effect.rating && plan.minRating == null) plan.minRating = { value: effect.rating, span: words }
      } else if ('runtimeMax' in effect) {
        if (!plan.runtime) plan.runtime = { min: null, max: effect.runtimeMax, span: words }
      } else if ('runtimeMin' in effect) {
        if (!plan.runtime) plan.runtime = { min: effect.runtimeMin, max: null, span: words }
      } else if ('keyword' in effect) {
        if (!plan.keywords.some((keyword) => keyword.term === effect.keyword) && plan.keywords.length < 4) plan.keywords.push({ term: effect.keyword, span: words })
      } else if ('place' in effect) {
        if (!plan.places.some((place) => place.name === effect.place) && plan.places.length < 3) plan.places.push({ name: effect.place, span: words })
      } else if ('recent' in effect) {
        if (!plan.years) plan.years = { from: thisYear - 3, to: null, span: words }
        if (plan.sort === 'rel') plan.sort = 'new'
      } else if ('classic' in effect) {
        if (!plan.years) plan.years = { from: null, to: 1990, span: words }
      }
    }
  }

  plan.unmatched = tokens.filter((_, i) => !used[i]).slice(0, 6)
  const understood = plan.kind !== 'any' || plan.genres.length > 0 || plan.without.length > 0 || plan.keywords.length > 0 || plan.places.length > 0 || plan.countries.length > 0
    || !!plan.like || !!plan.years || !!plan.runtime || plan.sort !== 'rel'
  return { ...plan, complete: understood && plan.unmatched.length === 0 }
}
