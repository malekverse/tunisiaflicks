// Unit tests for matching the Tunisian catalogue's series to Tunisian TV's (src/lib/tunisian-match):
// the names the source blog and the channels give a series, reduced to the same keys, and only
// confident matches accepted. No database:
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { episodesFor, matchTvSeries, nameKeys, partOf, type TvMatchCandidate } from '@/src/lib/tunisian-match'

test('nameKeys: no series word, part, number, punctuation or article; one key per script', () => {
  assert.deepEqual(nameKeys('مسلسل رڨوج الجزء الأول Ragouj'), ['رقوج', 'ragouj'])
  assert.deepEqual(nameKeys('Ragouj 2 مسلسل رقوج الكنز'), ['رقوج كنز', 'ragouj'])
  assert.deepEqual(nameKeys('مسلسل الفوندو الجزء الاول Foundou'), ['فوندو', 'foundou'])
  assert.deepEqual(nameKeys('el fetna مسلسل الفتنة'), ['فتنه', 'fetna'])
  assert.deepEqual(nameKeys('Arriére el goddem أريار القدام '), ['اريار قدام', 'arriere goddem'])
  assert.deepEqual(nameKeys('Sahbek Rajel مسلسل صاحبك راجل 2'), ['صاحبك راجل', 'sahbek rajel'])
  assert.deepEqual(nameKeys(' مسلسل باب الرزق '), ['باب رزق'])
  assert.deepEqual(nameKeys('مسلسل أولاد مفيدة'), ['اولاد مفيده'])
  assert.deepEqual(nameKeys('Saison 2 - Ouled Moufida !'), ['ouled moufida'])
  // The channels' names: the same keys.
  assert.deepEqual(nameKeys('باب بنات'), nameKeys('مسلسل باب البنات'))
  assert.deepEqual(nameKeys('(HD 2026) قمرة سيدي المحروس'), ['قمره سيدي محروس'])
  assert.deepEqual(nameKeys('Bab El Bnet'), nameKeys('Bab Bnet'))
  // Nothing left, or too little to say anything.
  assert.deepEqual(nameKeys('مسلسل'), [])
  assert.deepEqual(nameKeys('S02 EP'), [])
  assert.deepEqual(nameKeys(''), [])
})

test('partOf: the part a name asks for, in either script', () => {
  assert.equal(partOf('مسلسل رڨوج الجزء الأول Ragouj'), 1)
  assert.equal(partOf('مسلسل الفوندو الجزء الاول Foundou'), 1)
  assert.equal(partOf('مسلسل الفوندو الجزء الثاني'), 2)
  assert.equal(partOf('Ragouj 2 مسلسل رقوج الكنز'), 2)
  assert.equal(partOf('Ouled Moufida Saison 3'), 3)
  assert.equal(partOf('Ouled Moufida S04'), 4)
  assert.equal(partOf('مسلسل الجزء 5'), 5)
  assert.equal(partOf('مسلسل حياة'), null)
  // A year is no part.
  assert.equal(partOf('(HD 2026) قمرة سيدي المحروس'), null)
})

const tv = (id: string, title: string, titleAlt: string | null, seasons: Record<string, number>): TvMatchCandidate => ({ id, title, titleAlt, seasons })

const CATALOGUE = [
  tv('watania-1:حياه', 'حياة', null, { 1: 10 }),
  tv('watania-1:باب-بنات', 'باب بنات', null, { 1: 15 }),
  tv('watania-1:المطبعه', 'المطبعة', null, { 1: 10 }),
  tv('attessia:كلاش', 'كلاش', null, { 1: 8 }),
  tv('elhiwar:ragouj', 'Ragouj', 'رقوج', { 1: 20, 2: 18 }),
  tv('nessma:warthet-el-nar', 'Warthet El Nar', 'ورثة النار', { 1: 3 }),
  tv('watania-2:الزعيم', 'الزعيم', null, { 1: 1 }),
  tv('watania-1:باب-الرزق', 'باب', null, { 1: 30 }),
]

test('matchTvSeries: the same name in either script, with episodes to watch', () => {
  assert.equal(matchTvSeries('مسلسل حياة ', CATALOGUE)?.id, 'watania-1:حياه')
  assert.equal(matchTvSeries('مسلسل باب البنات', CATALOGUE)?.id, 'watania-1:باب-بنات')
  assert.equal(matchTvSeries('مسلسل المطبعة ', CATALOGUE)?.id, 'watania-1:المطبعه')
  assert.equal(matchTvSeries('مسلسل كلاش', CATALOGUE)?.id, 'attessia:كلاش')
  assert.equal(matchTvSeries('مسلسل رڨوج الجزء الأول Ragouj', CATALOGUE)?.id, 'elhiwar:ragouj')
  // Season 2 by its Latin name ("رقوج الكنز" is that season's own title).
  assert.equal(matchTvSeries('Ragouj 2 مسلسل رقوج الكنز', CATALOGUE)?.id, 'elhiwar:ragouj')
  assert.equal(matchTvSeries('Warthet El Nar', CATALOGUE)?.id, 'nessma:warthet-el-nar')
})

test('matchTvSeries: only confident matches', () => {
  // A name that only starts the same is another series.
  assert.equal(matchTvSeries(' مسلسل باب الرزق ', CATALOGUE), null)
  assert.equal(matchTvSeries('مسلسل الزعيم التونسي ', CATALOGUE), null)
  // A single upload is no series.
  assert.equal(matchTvSeries('مسلسل الزعيم', CATALOGUE), null)
  // A part the channel never uploaded.
  assert.equal(matchTvSeries('Ragouj 3', CATALOGUE), null)
  assert.equal(matchTvSeries('مسلسل غيبوبة ', CATALOGUE), null)
  assert.equal(matchTvSeries('مسلسل', CATALOGUE), null)
  assert.equal(matchTvSeries('مسلسل حياة', []), null)
})

test('matchTvSeries: a series on two channels plays from the one with more episodes', () => {
  const rerun = [tv('watania-2:حياه', 'حياة', null, { 1: 4 }), ...CATALOGUE]
  assert.equal(matchTvSeries('مسلسل حياة', rerun)?.id, 'watania-1:حياه')
})

test('episodesFor: the part asked for, else every season', () => {
  const ragouj = CATALOGUE[4]
  assert.equal(episodesFor(ragouj, null), 38)
  assert.equal(episodesFor(ragouj, 2), 18)
  assert.equal(episodesFor(ragouj, 3), 0)
})
