// Filmed in Tunisia (/filmed-in-tunisia): the real places on Tunisian soil where well-known films
// were shot, from Tatooine in the south to the Tunis of Férid Boughedir, on a map of the country.
// Hand-picked and kept to what's well documented (TMDB has no filming locations); a mistake is
// reported through /contact. Shared by server and client code; pure, so it's unit-tested.

type Text = { en: string, fr: string, ar: string }

export type FilmedFilm = {
  /** TMDB movie id. */
  tmdb: number
  /** What was filmed here, for this film. */
  scene: Text
}

export type FilmedPlace = {
  id: string
  name: Text
  /** The town or region it's in. */
  area: Text
  lat: number
  lon: number
  films: FilmedFilm[]
  /** How to get there, in a line. */
  visit: Text
}

export const PLACES: FilmedPlace[] = [
  {
    id: 'matmata',
    name: { en: 'Hotel Sidi Driss', fr: 'Hôtel Sidi Driss', ar: 'نزل سيدي إدريس' },
    area: { en: 'Matmata', fr: 'Matmata', ar: 'مطماطة' },
    lat: 33.5425, lon: 9.9677,
    films: [
      { tmdb: 11, scene: { en: 'Luke Skywalker’s home on Tatooine: the dining room and the courtyard of the Lars homestead are this troglodyte hotel.', fr: 'La maison de Luke Skywalker sur Tatooine : la salle à manger et la cour des Lars, c’est cet hôtel troglodyte.', ar: 'بيت لوك سكاي ووكر على تاتوين: غرفة الطعام وفناء بيت عائلة لارز هما هذا النزل المحفور في الأرض.' } },
      { tmdb: 1894, scene: { en: 'The crew came back 25 years later: Anakin returns to the same homestead.', fr: 'L’équipe est revenue 25 ans plus tard : Anakin retourne dans la même ferme.', ar: 'عاد فريق التصوير بعد 25 عامًا: يعود أناكين إلى البيت نفسه.' } },
    ],
    visit: { en: 'In Matmata, about 45 km south-west of Gabès. It’s still a hotel: you can sleep there.', fr: 'À Matmata, à environ 45 km au sud-ouest de Gabès. C’est toujours un hôtel : on peut y dormir.', ar: 'في مطماطة، على بعد 45 كم تقريبًا جنوب غرب قابس. ما زال نزلًا: يمكنك المبيت فيه.' },
  },
  {
    id: 'lars-homestead',
    name: { en: 'The Lars homestead', fr: 'La ferme des Lars', ar: 'بيت عائلة لارز' },
    area: { en: 'Chott el Jerid, near Nefta', fr: 'Chott el-Jérid, près de Nefta', ar: 'شط الجريد، قرب نفطة' },
    lat: 33.9944, lon: 7.8558,
    films: [
      { tmdb: 11, scene: { en: 'The white dome on the salt flat where Luke watches the twin suns set.', fr: 'Le dôme blanc sur le lac salé, d’où Luke regarde se coucher les deux soleils.', ar: 'القبّة البيضاء على السبخة، حيث يتأمل لوك غروب الشمسين.' } },
      { tmdb: 1894, scene: { en: 'Rebuilt for Anakin’s return home.', fr: 'Reconstruite pour le retour d’Anakin.', ar: 'أُعيد بناؤها لعودة أناكين.' } },
    ],
    visit: { en: 'On the salt flat west of Tozeur, towards Nefta. Tours from Tozeur stop there.', fr: 'Sur le chott à l’ouest de Tozeur, vers Nefta. Les excursions depuis Tozeur s’y arrêtent.', ar: 'على السبخة غرب توزر في اتجاه نفطة. تتوقف عندها الرحلات المنطلقة من توزر.' },
  },
  {
    id: 'mos-espa',
    name: { en: 'Mos Espa', fr: 'Mos Espa', ar: 'موس إسبا' },
    area: { en: 'Ong Jemel, near Nefta', fr: 'Ong Jemel, près de Nefta', ar: 'عنق الجمل، قرب نفطة' },
    lat: 33.9947, lon: 7.7666,
    films: [
      { tmdb: 1893, scene: { en: 'The whole spaceport town where young Anakin lives was built here, and much of it still stands in the sand.', fr: 'Toute la ville-port où vit le jeune Anakin a été construite ici, et une grande partie tient encore debout dans le sable.', ar: 'بُنيت هنا مدينة الميناء الفضائي التي يعيش فيها أناكين الصغير، وما زال معظمها قائمًا وسط الرمال.' } },
      { tmdb: 409, scene: { en: 'The desert around the Ong Jemel rock was used for the film’s Sahara.', fr: 'Le désert autour du rocher d’Ong Jemel a servi de Sahara au film.', ar: 'الصحراء المحيطة بصخرة عنق الجمل كانت صحراء الفيلم.' } },
    ],
    visit: { en: 'About 30 km north-west of Tozeur, by 4x4: every desert tour from Tozeur goes there.', fr: 'À environ 30 km au nord-ouest de Tozeur, en 4x4 : toutes les excursions dans le désert depuis Tozeur y passent.', ar: 'على بعد 30 كم تقريبًا شمال غرب توزر، بسيارة رباعية الدفع: كل الرحلات الصحراوية من توزر تمرّ بها.' },
  },
  {
    id: 'sidi-bouhlel',
    name: { en: 'Sidi Bouhlel canyon', fr: 'Canyon de Sidi Bouhlel', ar: 'وادي سيدي بوهلال' },
    area: { en: 'Near Tozeur', fr: 'Près de Tozeur', ar: 'قرب توزر' },
    lat: 34.0, lon: 8.02,
    films: [
      { tmdb: 11, scene: { en: 'The “Star Wars canyon”: R2-D2 is captured by the Jawas and Luke is attacked by Tusken Raiders here.', fr: 'Le « canyon Star Wars » : R2-D2 y est capturé par les Jawas et Luke attaqué par les Hommes des sables.', ar: '«وادي حرب النجوم»: هنا يأسر الجاوا الروبوت R2-D2 ويهاجم رجال الرمال لوك.' } },
      { tmdb: 85, scene: { en: 'Indiana Jones’s first adventure was filmed in this canyon too.', fr: 'La première aventure d’Indiana Jones a aussi été tournée dans ce canyon.', ar: 'صُوِّرت أولى مغامرات إنديانا جونز في هذا الوادي أيضًا.' } },
    ],
    visit: { en: 'A short 4x4 trip from Tozeur, often on the same tour as Ong Jemel.', fr: 'Une courte sortie en 4x4 depuis Tozeur, souvent avec Ong Jemel.', ar: 'رحلة قصيرة بسيارة رباعية الدفع من توزر، غالبًا ضمن جولة عنق الجمل.' },
  },
  {
    id: 'tataouine',
    name: { en: 'Ksar Ouled Soltane', fr: 'Ksar Ouled Soltane', ar: 'قصر أولاد سلطان' },
    area: { en: 'Tataouine', fr: 'Tataouine', ar: 'تطاوين' },
    lat: 32.7886, lon: 10.5172,
    films: [
      { tmdb: 1893, scene: { en: 'The stacked granaries of the ksour around Tataouine (here and Ksar Hadada) became the slave quarters of Mos Espa. Tatooine itself is named after the town.', fr: 'Les greniers superposés des ksour de Tataouine (ici et à Ksar Hadada) sont devenus les quartiers d’esclaves de Mos Espa. Tatooine doit son nom à la ville.', ar: 'صارت غرف الخزن المتراكبة في قصور تطاوين (هنا وفي قصر حدادة) أحياء العبيد في موس إسبا. وكوكب تاتوين نفسه سُمّي على اسم المدينة.' } },
    ],
    visit: { en: 'About 20 km south-east of Tataouine; Ksar Hadada is near Ghomrassen, north of the town.', fr: 'À environ 20 km au sud-est de Tataouine ; Ksar Hadada est près de Ghomrassen, au nord de la ville.', ar: 'على بعد 20 كم تقريبًا جنوب شرق تطاوين؛ وقصر حدادة قرب غمراسن شمال المدينة.' },
  },
  {
    id: 'ajim',
    name: { en: 'Ajim', fr: 'Ajim', ar: 'أجيم' },
    area: { en: 'Djerba', fr: 'Djerba', ar: 'جربة' },
    lat: 33.722, lon: 10.75,
    films: [
      { tmdb: 11, scene: { en: 'Mos Eisley’s streets, and Obi-Wan Kenobi’s house on the edge of the dunes.', fr: 'Les rues de Mos Eisley, et la maison d’Obi-Wan Kenobi au bord des dunes.', ar: 'شوارع موس آيسلي، وبيت أوبي وان كينوبي على حافة الكثبان.' } },
    ],
    visit: { en: 'On Djerba’s south-west coast, where the ferry from Jorf lands.', fr: 'Sur la côte sud-ouest de Djerba, là où arrive le bac de Jorf.', ar: 'على الساحل الجنوبي الغربي لجربة، حيث ترسو العبّارة القادمة من الجرف.' },
  },
  {
    id: 'kairouan',
    name: { en: 'The medina of Kairouan', fr: 'La médina de Kairouan', ar: 'مدينة القيروان العتيقة' },
    area: { en: 'Kairouan', fr: 'Kairouan', ar: 'القيروان' },
    lat: 35.678, lon: 10.1,
    films: [
      { tmdb: 85, scene: { en: 'Cairo in the film: Indiana Jones chases Marion’s kidnappers, basket after basket, through these streets.', fr: 'Le Caire du film : Indiana Jones poursuit les ravisseurs de Marion, panier après panier, dans ces rues.', ar: 'القاهرة في الفيلم: في هذه الأزقّة يطارد إنديانا جونز خاطفي ماريون، سلّة بعد سلّة.' } },
    ],
    visit: { en: 'In the heart of Kairouan, about 1 h 30 from Sousse.', fr: 'Au cœur de Kairouan, à environ 1 h 30 de Sousse.', ar: 'في قلب القيروان، على بعد ساعة ونصف تقريبًا من سوسة.' },
  },
  {
    id: 'monastir',
    name: { en: 'The Ribat of Monastir', fr: 'Le ribat de Monastir', ar: 'رباط المنستير' },
    area: { en: 'Monastir', fr: 'Monastir', ar: 'المنستير' },
    lat: 35.7765, lon: 10.8325,
    films: [
      { tmdb: 583, scene: { en: 'Jerusalem for Monty Python: the fortress walls and the town around them.', fr: 'Jérusalem pour les Monty Python : les remparts du ribat et la ville autour.', ar: 'القدس عند مونتي بايثون: أسوار الرباط والمدينة من حولها.' } },
    ],
    visit: { en: 'On Monastir’s seafront, by the old town. The ribat is open to visitors.', fr: 'Sur le front de mer de Monastir, près de la vieille ville. Le ribat se visite.', ar: 'على واجهة المنستير البحرية قرب المدينة العتيقة. الرباط مفتوح للزوار.' },
  },
  {
    id: 'halfaouine',
    name: { en: 'Halfaouine', fr: 'Halfaouine', ar: 'الحلفاوين' },
    area: { en: 'Tunis medina', fr: 'Médina de Tunis', ar: 'مدينة تونس العتيقة' },
    lat: 36.8065, lon: 10.1665,
    films: [
      { tmdb: 44281, scene: { en: 'Férid Boughedir’s film is named after this quarter: its terraces, its hammam and its streets are the film.', fr: 'Le film de Férid Boughedir porte le nom de ce quartier : ses terrasses, son hammam et ses rues sont le film.', ar: 'يحمل فيلم فريد بوغدير اسم هذا الحيّ: سطوحه وحمّامه وأزقّته هي الفيلم.' } },
    ],
    visit: { en: 'North of the Tunis medina, around Bab Souika.', fr: 'Au nord de la médina de Tunis, autour de Bab Souika.', ar: 'شمال مدينة تونس العتيقة، حول باب سويقة.' },
  },
  {
    id: 'la-goulette',
    name: { en: 'La Goulette', fr: 'La Goulette', ar: 'حلق الوادي' },
    area: { en: 'Tunis', fr: 'Tunis', ar: 'تونس' },
    lat: 36.818, lon: 10.305,
    films: [
      { tmdb: 121493, scene: { en: 'Boughedir’s summer of three families, Muslim, Jewish and Christian, in the port town where they lived side by side.', fr: 'L’été de trois familles, musulmane, juive et chrétienne, dans la ville portuaire où elles vivaient côte à côte.', ar: 'صيف ثلاث عائلات، مسلمة ويهودية ومسيحية، في المدينة الساحلية التي عاشت فيها جنبًا إلى جنب.' } },
    ],
    visit: { en: 'By the TGM train from Tunis, about 20 minutes.', fr: 'En TGM depuis Tunis, environ 20 minutes.', ar: 'بقطار TGM من تونس، في 20 دقيقة تقريبًا.' },
  },
  {
    id: 'djerba',
    name: { en: 'Djerba’s villages', fr: 'Les villages de Djerba', ar: 'قرى جربة' },
    area: { en: 'Djerba', fr: 'Djerba', ar: 'جربة' },
    lat: 33.8, lon: 10.93,
    films: [
      { tmdb: 265761, scene: { en: 'Moufida Tlatli’s women of Djerba, weaving carpets while their men work in Tunis.', fr: 'Les femmes de Djerba de Moufida Tlatli, qui tissent des tapis pendant que leurs hommes travaillent à Tunis.', ar: 'نساء جربة عند مفيدة التلاتلي، ينسجن الزرابي بينما يعمل رجالهن في العاصمة.' } },
    ],
    visit: { en: 'All over the island, from Houmt Souk to the inland villages.', fr: 'Partout sur l’île, de Houmt Souk aux villages de l’intérieur.', ar: 'في أنحاء الجزيرة، من حومة السوق إلى القرى الداخلية.' },
  },
  {
    id: 'mahdia',
    name: { en: 'Mahdia', fr: 'Mahdia', ar: 'المهدية' },
    area: { en: 'Mahdia', fr: 'Mahdia', ar: 'المهدية' },
    lat: 35.504, lon: 11.062,
    films: [
      { tmdb: 378697, scene: { en: 'Hedi is sent to Mahdia’s empty off-season hotels a week before his wedding, and meets Rim.', fr: 'Hedi est envoyé dans les hôtels vides de Mahdia hors saison, une semaine avant son mariage, et y rencontre Rim.', ar: 'يُرسَل الهادي إلى نزل المهدية الخالية خارج الموسم قبل زفافه بأسبوع، فيلتقي ريم.' } },
    ],
    visit: { en: 'On the east coast, about 1 h south of Monastir.', fr: 'Sur la côte est, à environ 1 h au sud de Monastir.', ar: 'على الساحل الشرقي، على بعد ساعة تقريبًا جنوب المنستير.' },
  },
]

/** The texts in the reader's language (Tunisian reads the Arabic). */
export const textIn = (text: Text, locale: string) => (locale === 'fr' ? text.fr : locale === 'ar' || locale === 'tn' ? text.ar : text.en)

/** Every film on the map, once. */
export const filmIds = (places: readonly FilmedPlace[] = PLACES) => [...new Set(places.flatMap((place) => place.films.map((film) => film.tmdb)))]

// ---- the map ---------------------------------------------------------------------------------------------

/** Tunisia's mainland and Djerba, simplified, as [lat, lon]. */
export const OUTLINE: [number, number][] = [
  [36.94, 8.62], [37.02, 8.95], [37.23, 9.22], [37.27, 9.87], [37.33, 9.85], [37.17, 10.2], [36.95, 10.21],
  [36.88, 10.33], [36.8, 10.3], [36.72, 10.42], [36.73, 10.62], [36.86, 10.82], [37.08, 11.05], [36.85, 11.11],
  [36.6, 10.95], [36.45, 10.73], [36.4, 10.6], [36.1, 10.48], [35.83, 10.64], [35.77, 10.84], [35.5, 11.07],
  [35.24, 11.13], [34.95, 10.95], [34.74, 10.77], [34.5, 10.55], [34.3, 10.07], [34.05, 10.03], [33.88, 10.11],
  [33.65, 10.42], [33.6, 10.65], [33.45, 10.9], [33.5, 11.11], [33.3, 11.15], [33.17, 11.56], [32.6, 11.5],
  [32.37, 11.2], [32.03, 10.7], [31.6, 10.35], [31.0, 10.28], [30.24, 9.53], [30.8, 9.25], [31.6, 8.95],
  [32.3, 8.35], [32.85, 7.95], [33.25, 7.75], [33.73, 7.53], [34.1, 7.53], [34.4, 7.8], [34.75, 8.25],
  [35.15, 8.37], [35.75, 8.37], [36.22, 8.33], [36.45, 8.43], [36.94, 8.62],
]
export const DJERBA: [number, number][] = [
  [33.9, 10.76], [33.88, 10.93], [33.83, 11.06], [33.7, 11.06], [33.64, 10.95], [33.68, 10.75], [33.8, 10.72], [33.9, 10.76],
]

const NORTH = 37.5
const WEST = 7.3
const SCALE = 100
/** Longitude shrinks with latitude: this keeps the country's shape at Tunisia's middle. */
const SHRINK = Math.cos((34 * Math.PI) / 180)

/** [lat, lon] → [x, y] in the map's own units (north up, west left). */
export function project(lat: number, lon: number): [number, number] {
  return [Math.round((lon - WEST) * SHRINK * SCALE * 10) / 10, Math.round((NORTH - lat) * SCALE * 10) / 10]
}

export const MAP_WIDTH = project(30, 11.8)[0]
export const MAP_HEIGHT = project(30, 0)[1]

/** An SVG path of a ring of [lat, lon]. */
export const pathOf = (ring: [number, number][]) =>
  `${ring.map(([lat, lon], index) => `${index ? 'L' : 'M'}${project(lat, lon).join(' ')}`).join('')}Z`

/** A Google Maps link to a place (the visitor's own app on a phone). */
export const mapsLink = (place: Pick<FilmedPlace, 'lat' | 'lon'>) => `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`
