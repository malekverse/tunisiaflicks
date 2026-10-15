// The landing page's opening shot, in three.js: the TunisiaFlicks "A" as red glass, its three
// strokes flying in and locking together, in front of a curved cinema screen made of today's
// trending posters. The room is dark; the pointer is a projector beam that lights the posters it
// passes over, and the glass refracts them (MeshPhysicalMaterial transmission: the wall is in the
// same scene, so the glass really bends it).
//
// Plain three.js, no React: the component (Hero.tsx) loads this module only on a capable device
// and drives it through the handle below. One draw call for the whole wall (an instanced mesh over
// a poster atlas); rendering stops when the hero is off screen or the tab is hidden.
import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { MARK_STROKES, MARK_VIEWBOX } from '@/src/components/brand/BrandMark'

export type HeroQuality = 'high' | 'low'

export type HeroScene = {
  /** Pointer in -1..1 (x towards the end side in LTR), or null when it left / on touch. */
  setPointer(x: number, y: number): void
  /** Scroll through the pinned hero, 0..1. */
  setProgress(progress: number): void
  /** Renders only while active (on screen, tab visible). */
  setActive(active: boolean): void
  resize(): void
  dispose(): void
  /** Resolves when the posters are on the wall (the first frame worth showing). */
  ready: Promise<void>
}

type Options = {
  /** Poster addresses (CORS-enabled: TMDB's CDN). */
  posters: string[]
  quality: HeroQuality
  /** Reduced motion: no fly-in, no idle drift; frames only when something changes. */
  still: boolean
  /** Right-to-left page: the glass sits on the other side of the headline. */
  rtl: boolean
}

// ---- the wall ------------------------------------------------------------------------------------

const RING_RADIUS = 12
const POSTER_W = 1.5
const POSTER_H = 2.25
const GAP = 0.24
const ROWS = 5
const ATLAS_COLS = 8
const ATLAS_ROWS = 5
/** The wall shows after this long even if few posters have arrived (they fill in on screen). */
const READY_AFTER_MS = 1500
/** New posters are uploaded to the GPU at most this often (each upload is the whole atlas). */
const UPLOAD_EVERY_MS = 250

const WALL_VERTEX = /* glsl */ `
  attribute vec2 aCell;
  attribute float aSeed;
  varying vec2 vUv;
  varying vec2 vCell;
  varying float vSeed;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vCell = aCell;
    vSeed = aSeed;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const WALL_FRAGMENT = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec2 uGrid;
  uniform float uWarm;
  uniform float uTime;
  uniform vec2 uBeam;
  uniform float uFade;
  uniform float uGlow;
  uniform vec3 uGlass;
  varying vec2 vUv;
  varying vec2 vCell;
  varying float vSeed;
  varying vec3 vWorld;

  float roundedBox(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    // Rounded poster corners (10px on a ~240px poster).
    vec2 p = (vUv - 0.5) * vec2(${POSTER_W.toFixed(2)}, ${POSTER_H.toFixed(2)});
    float d = roundedBox(p, vec2(${(POSTER_W / 2).toFixed(3)}, ${(POSTER_H / 2).toFixed(3)}), 0.07);
    if (d > 0.0) discard;

    vec2 uv = (vCell + vUv) / uGrid;
    vec3 color = texture2D(uAtlas, uv).rgb;

    // Where this poster is, seen from the room's centre: its angle around the ring and its height.
    float angle = atan(vWorld.x, -vWorld.z);
    float height = vWorld.y;

    // The projector warms up from the centre outwards, each poster with its own flicker.
    float delay = abs(angle) * 0.55 + vSeed * 0.25;
    float on = smoothstep(delay, delay + 0.35, uWarm);
    float flicker = 1.0 - (1.0 - on) * 0.6 * step(0.5, fract(sin(uTime * 40.0 + vSeed * 91.0) * 43758.5));

    // The beam: a soft spot around where the pointer aims (the shader works in linear light, so
    // these numbers look about twice as bright on screen).
    float beam = exp(-pow((angle - uBeam.x) / 0.26, 2.0) - pow((height - uBeam.y) / 2.0, 2.0));

    // The dark room: a faint spill everywhere, posters away from the eye line and the centre fall
    // into shadow.
    float room = 0.05 * exp(-pow(height / 4.0, 2.0)) * exp(-pow(angle / 0.9, 2.0));

    // The red glass throws its colour on the posters behind it.
    float glass = exp(-pow((angle - uGlass.x) / 0.22, 2.0) - pow((height - uGlass.y) / 1.6, 2.0)) * uGlow;

    float light = (room + beam * 0.9) * on * flicker * uFade;
    vec3 lit = color * light + color * vec3(1.0, 0.12, 0.06) * glass * 0.35 * on * uFade;

    // A whisper of edge, so unlit posters still read as frames in the dark.
    float edge = smoothstep(-0.03, 0.0, d) * 0.06 * on * uFade;
    gl_FragColor = vec4(lit + edge, 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * The wall's posters on one texture: cells of 2:3 in a grid, read by each instance's aCell. The
 * texture exists at once (dark frames) and each poster is drawn in as it arrives, so the wall never
 * waits for the slowest one. The addresses are the ones the page's flat wall already loaded with
 * CORS (PicImg asks TMDB with crossorigin), so they usually come straight from the cache.
 */
function buildAtlas(urls: string[], quality: HeroQuality, signal: AbortSignal) {
  const cellW = quality === 'high' ? 256 : 176
  const cellH = Math.round(cellW * 1.5)
  const canvas = document.createElement('canvas')
  canvas.width = cellW * ATLAS_COLS
  canvas.height = cellH * ATLAS_ROWS
  const context = canvas.getContext('2d')!
  context.fillStyle = '#0a0a0a'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.anisotropy = 4

  const wanted = urls.slice(0, ATLAS_COLS * ATLAS_ROWS)
  let drawn = 0
  let dirty = false
  // Resolves once enough of the wall is up to be worth showing (half of it), or after a moment
  // whatever has arrived: the rest keeps filling in on screen.
  let resolveReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => { resolveReady = resolve })
  const enough = Math.max(1, Math.ceil(wanted.length / 2))
  const timer = window.setTimeout(() => resolveReady(), READY_AFTER_MS)
  signal.addEventListener('abort', () => window.clearTimeout(timer))

  wanted.forEach((url, index) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      if (signal.aborted) return
      const x = (index % ATLAS_COLS) * cellW
      const y = Math.floor(index / ATLAS_COLS) * cellH
      try {
        context.drawImage(image, x, y, cellW, cellH)
      } catch {
        return // A poster that can't be drawn stays a dark frame.
      }
      dirty = true
      drawn++
      if (drawn >= enough) resolveReady()
    }
    image.src = url
  })

  return {
    texture,
    ready,
    /** Uploads the posters drawn since the last call; true when something changed. */
    flush() {
      if (!dirty) return false
      dirty = false
      texture.needsUpdate = true
      return true
    },
  }
}

function buildWall(count: number) {
  const columns = Math.round((Math.PI * 2 * RING_RADIUS) / (POSTER_W + GAP))
  const step = (Math.PI * 2) / columns
  const geometry = new THREE.PlaneGeometry(POSTER_W, POSTER_H)
  const instances = columns * ROWS
  const cells = new Float32Array(instances * 2)
  const seeds = new Float32Array(instances)
  const material = new THREE.ShaderMaterial({
    vertexShader: WALL_VERTEX,
    fragmentShader: WALL_FRAGMENT,
    uniforms: {
      uAtlas: { value: null },
      uGrid: { value: new THREE.Vector2(ATLAS_COLS, ATLAS_ROWS) },
      uWarm: { value: 0 },
      uTime: { value: 0 },
      uBeam: { value: new THREE.Vector2(0, 0) },
      uFade: { value: 1 },
      uGlow: { value: 0 },
      uGlass: { value: new THREE.Vector2(0, 0) },
    },
  })
  const mesh = new THREE.InstancedMesh(geometry, material, instances)
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const scale = new THREE.Vector3(1, 1, 1)
  const up = new THREE.Vector3(0, 1, 0)
  const rowPitch = POSTER_H + GAP
  let index = 0
  for (let column = 0; column < columns; column++) {
    const angle = column * step
    // Every other column sits half a poster lower: a looser, less spreadsheet-like wall.
    const offset = (column % 2) * rowPitch * 0.5
    for (let row = 0; row < ROWS; row++) {
      const y = (row - (ROWS - 1) / 2) * rowPitch - offset + rowPitch * 0.25
      position.set(Math.sin(angle) * RING_RADIUS, y, -Math.cos(angle) * RING_RADIUS)
      rotation.setFromAxisAngle(up, -angle)
      matrix.compose(position, rotation, scale)
      mesh.setMatrixAt(index, matrix)
      // Neighbours never share a poster: stride through the atlas.
      const poster = count > 0 ? (column * 7 + row * 3) % count : 0
      cells[index * 2] = poster % ATLAS_COLS
      cells[index * 2 + 1] = ATLAS_ROWS - 1 - Math.floor(poster / ATLAS_COLS)
      seeds[index] = ((column * 12.9898 + row * 78.233) % 1 + 1) % 1
      index++
    }
  }
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2))
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  mesh.instanceMatrix.needsUpdate = true
  mesh.frustumCulled = false
  return { mesh, material, geometry }
}

// ---- the glass A ---------------------------------------------------------------------------------

function buildMark(quality: HeroQuality) {
  const [, , width, height] = MARK_VIEWBOX.split(' ').map(Number)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">${MARK_STROKES.map((d) => `<path d="${d}"/>`).join('')}</svg>`
  const data = new SVGLoader().parse(svg)
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    metalness: 0,
    roughness: 0.06,
    transmission: 1,
    thickness: 1.1,
    ior: 1.5,
    dispersion: quality === 'high' ? 4 : 0,
    attenuationColor: new THREE.Color('#ff1405'),
    attenuationDistance: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    envMapIntensity: 1.35,
  })
  const strokes = data.paths.map((path) => {
    const shapes = path.toShapes()
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: 14,
      bevelEnabled: true,
      bevelThickness: 3.2,
      bevelSize: 1.6,
      bevelSegments: quality === 'high' ? 6 : 3,
      curveSegments: 1,
    })
    // SVG units, y down: centre on the mark, flip, and scale to ~2.4 world units tall.
    geometry.translate(-width / 2, -(6 + height / 2), -7)
    const scale = 2.4 / height
    // Flipping y and z together is a half turn, not a mirror: the faces keep their winding.
    geometry.scale(scale, -scale, -scale)
    geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, material)
    return mesh
  })
  const group = new THREE.Group()
  strokes.forEach((stroke) => group.add(stroke))
  return { group, strokes, material }
}

/** A studio of soft light panels for the glass to reflect: a wide screen, a red exit sign, a top strip. */
function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#020202')
  const panel = (w: number, h: number, color: THREE.Color, position: [number, number, number], lookAt: [number, number, number] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
    mesh.position.set(...position)
    mesh.lookAt(...lookAt)
    scene.add(mesh)
  }
  panel(10, 3.2, new THREE.Color(1, 1, 1).multiplyScalar(2.2), [0, 1.2, 6])
  panel(3.2, 1.2, new THREE.Color(1, 0.08, 0.02).multiplyScalar(6), [-5, 2.4, 2])
  panel(1.2, 6, new THREE.Color(1, 0.94, 0.86).multiplyScalar(3), [5.5, 0, 1])
  panel(12, 0.5, new THREE.Color(1, 1, 1).multiplyScalar(1.6), [0, 6, 0])
  panel(14, 6, new THREE.Color(0.35, 0.34, 0.36), [0, 0, -9])
  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(scene, 0.035)
  pmrem.dispose()
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      ;(object.material as THREE.Material).dispose()
    }
  })
  return target
}

// ---- easing --------------------------------------------------------------------------------------

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** Frame-rate independent approach of `current` to `target`. */
const damp = (current: number, target: number, lambda: number, dt: number) => current + (target - current) * (1 - Math.exp(-lambda * dt))

/** Where each stroke starts before locking into the A: [position, rotation (x, y, z)]. */
const FLY_IN: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
  [[3.4, 2.2, -3], [0.6, -1.4, 0.9]],
  [[-3.6, -1.6, -2], [-0.8, 1.6, -0.6]],
  [[0.6, -3.2, 2.2], [1.2, 0.4, -1.1]],
]

// ---- the scene -----------------------------------------------------------------------------------

export function createHeroScene(canvas: HTMLCanvasElement, { posters, quality, still, rtl }: Options): HeroScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', alpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // The glass's refraction is drawn from a smaller copy of the scene on modest devices.
  ;(renderer as THREE.WebGLRenderer & { transmissionResolutionScale?: number }).transmissionResolutionScale = quality === 'high' ? 1 : 0.5

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60)
  const environment = buildEnvironment(renderer)
  scene.environment = environment.texture

  const wall = buildWall(Math.min(posters.length, ATLAS_COLS * ATLAS_ROWS))
  const ring = new THREE.Group()
  ring.add(wall.mesh)
  scene.add(ring)

  const mark = buildMark(quality)
  const pivot = new THREE.Group()
  pivot.add(mark.group)
  scene.add(pivot)

  // A warm key light that follows the pointer: a moving glint along the glass's bevels.
  const glint = new THREE.PointLight(0xffe6d6, 18, 12, 2)
  glint.position.set(2, 2, 3)
  scene.add(glint)

  // ---- state ----
  let width = 1
  let height = 1
  let active = false
  let frame = 0
  let disposed = false
  let readyAt = -1
  let elapsed = 0
  let started = -1
  let last = 0
  let progress = 0
  let shownProgress = 0
  let pointerX = 0
  let pointerY = 0
  let pointerAt = -10
  let aimX = 0
  let aimY = 0
  let needsFrame = true
  const markBase = new THREE.Vector3()
  let markDistance = 7

  const abort = new AbortController()
  const atlas = buildAtlas(posters, quality, abort.signal)
  wall.material.uniforms.uAtlas.value = atlas.texture
  let uploadedAt = -Infinity
  const ready = atlas.ready.then(() => {
    if (disposed) return
    readyAt = elapsed
    needsFrame = true
    kick()
  })

  function layout() {
    const portrait = height > width
    camera.aspect = width / height
    // Phones in portrait get a wider lens so the ring still wraps around them.
    camera.fov = portrait ? 52 : 35
    camera.updateProjectionMatrix()
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    // The glass is placed so it fills a comfortable share of the frame, whatever its shape.
    const fitHeight = 2.4 / (2 * tan * (portrait ? 0.4 : 0.56))
    const fitWidth = 2.6 / (2 * tan * camera.aspect * (portrait ? 0.78 : 0.4))
    markDistance = Math.min(9, Math.max(4.5, Math.max(fitHeight, fitWidth)))
    const visibleH = 2 * tan * markDistance
    const visibleW = visibleH * camera.aspect
    const side = rtl ? -1 : 1
    if (portrait) markBase.set(0, visibleH * 0.17, -markDistance)
    else markBase.set(side * visibleW * 0.24, visibleH * 0.06, -markDistance)
    needsFrame = true
  }

  function resize() {
    const box = canvas.getBoundingClientRect()
    width = Math.max(1, Math.round(box.width))
    height = Math.max(1, Math.round(box.height))
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.4)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    layout()
    kick()
  }

  function render(now: number) {
    frame = 0
    if (disposed) return
    // Damping steps by the frame; the clock is real time, so a slow device still finishes the
    // fly-in on schedule (it just sees fewer frames of it).
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now
    if (started < 0) started = now - elapsed * 1000
    elapsed = (now - started) / 1000

    const loaded = readyAt >= 0
    const since = loaded ? elapsed - readyAt : 0
    const intro = still ? 1 : clamp01(since / 1.9)

    // Strokes fly in and lock together, one after another.
    mark.strokes.forEach((stroke, index) => {
      const t = still ? 1 : easeOutExpo(clamp01((since - index * 0.14) / 1.5))
      const [from, spin] = FLY_IN[index]
      stroke.position.set(from[0] * (1 - t), from[1] * (1 - t), from[2] * (1 - t))
      stroke.rotation.set(spin[0] * (1 - t), spin[1] * (1 - t), spin[2] * (1 - t))
    })
    mark.group.visible = loaded

    // The pointer aims the beam; left alone, the beam drifts by itself.
    const idle = still || elapsed - pointerAt > 2.5
    const targetX = idle ? (still ? 0.15 : Math.sin(elapsed * 0.32) * 0.55) : pointerX
    const targetY = idle ? (still ? 0.1 : Math.sin(elapsed * 0.21) * 0.35) : pointerY
    aimX = damp(aimX, targetX, idle ? 1.2 : 5, dt)
    aimY = damp(aimY, targetY, idle ? 1.2 : 5, dt)

    shownProgress = still ? progress : damp(shownProgress, progress, 9, dt)
    const p = easeInOutCubic(shownProgress)

    // The camera pushes in towards the glass as the page scrolls.
    camera.position.set(aimX * 0.25, aimY * 0.15 + p * 0.6, -p * (markDistance - 2.2))
    camera.lookAt(markBase.x * 0.35 * (1 - p), markBase.y * 0.4, -markDistance - 2)

    const float = still ? 0 : Math.sin(elapsed * 0.9) * 0.06
    pivot.position.set(markBase.x, markBase.y + float + p * 0.8, markBase.z)
    pivot.rotation.set(-aimY * 0.22 + p * 0.25, aimX * 0.42 + (still ? -0.18 : Math.sin(elapsed * 0.4) * 0.12) + p * 1.9, aimX * -0.04)
    const grow = 1 + p * 0.35
    pivot.scale.setScalar((0.9 + 0.1 * easeOutExpo(intro)) * grow)

    ring.rotation.y = (still ? 0 : elapsed * 0.012) + aimX * -0.1 + p * 0.5

    glint.position.set(markBase.x + aimX * 3, markBase.y + aimY * 2 + 1.5, markBase.z + 3)

    const uniforms = wall.material.uniforms
    uniforms.uTime.value = elapsed
    uniforms.uWarm.value = still ? 3 : Math.max(0, since - 0.25) * 1.6
    uniforms.uBeam.value.set(aimX * 0.75, aimY * 2.6)
    uniforms.uFade.value = 1 - p * 0.75
    uniforms.uGlow.value = loaded ? Math.min(1, intro * 1.2) : 0
    // Where the glass is, as the wall's shader sees it (angle around the ring, height).
    uniforms.uGlass.value.set(Math.atan2(pivot.position.x, -pivot.position.z), (pivot.position.y * RING_RADIUS) / Math.max(1, -pivot.position.z))

    // Posters that arrived since the last upload (batched: each upload is the whole atlas).
    if (now - uploadedAt > UPLOAD_EVERY_MS && atlas.flush()) uploadedAt = now

    renderer.render(scene, camera)
    needsFrame = false

    // Keep going while something moves; in still mode only on demand.
    if (active && !still) frame = requestAnimationFrame(render)
    else if (active && still && (!loaded || needsFrame || since < 12)) frame = requestAnimationFrame(render)
  }

  function kick() {
    if (!active || frame || disposed) return
    last = 0
    started = -1
    frame = requestAnimationFrame(render)
  }

  const onContextLost = (event: Event) => {
    event.preventDefault()
    active = false
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  resize()
  // Development only: window.__hero.render(time) draws a frame on demand (a hidden preview pane
  // pauses requestAnimationFrame), .pointer(x, y) aims the beam.
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __hero?: unknown }).__hero = { scene, wall, mark, renderer, camera, render, pointer: (x: number, y: number) => { pointerX = x; pointerY = y; pointerAt = elapsed } }

  return {
    ready,
    setPointer(x, y) {
      pointerX = x
      pointerY = y
      pointerAt = elapsed
      needsFrame = true
      if (still) kick()
    },
    setProgress(value) {
      progress = clamp01(value)
      needsFrame = true
      kick()
    },
    setActive(value) {
      active = value
      if (active) kick()
      else if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    },
    resize,
    dispose() {
      disposed = true
      abort.abort()
      if (frame) cancelAnimationFrame(frame)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      atlas.texture.dispose()
      wall.geometry.dispose()
      wall.material.dispose()
      mark.strokes.forEach((stroke) => stroke.geometry.dispose())
      mark.material.dispose()
      environment.dispose()
      renderer.dispose()
    },
  }
}
