<script setup lang="ts">
import type { CameraImage } from '~/type/cameraImage'
import type { PlateSolveCrop, PlateSolveResult, PlateSolveStar } from '~/type/plateSolve'
import { formatDateTime } from '~/utils/formatDateTime'
import { getImageFileName } from '~/utils/getImageFileName'
import { getImagePeriod } from '~/utils/getImagePeriod'

type ArchiveFileInfo = {
  fileName: string
  exists: boolean
  gzipped: boolean
  format: 'plain' | 'gzip' | 'rice' | null
  storedAs: string | null
  sizeBytes: number
  modifiedAt: string | null
}

const route = useRoute()
const apiBase = useApiBase()
const imgId = computed(() => String(route.params.imgId))
const imageFailed = ref(false)
const plateSolve = ref<PlateSolveResult | null>(null)
const plateSolvePending = ref(false)
const plateSolveError = ref('')
const overlayVisible = ref(true)
const showUnconfirmedCandidates = ref(false)
const selectedStar = ref<PlateSolveStar | null>(null)
const isPlateSolveFullscreen = ref(false)
const hasAutoZoomedPlateSolve = ref(false)
let plateSolvePollTimer: ReturnType<typeof setInterval> | undefined

const MAX_RELIABLE_CATALOG_MATCH_ERROR_ARCSEC = 180

const ZODIAC_STAR_ALIASES: Record<string, string[]> = {
  alfAri: ['* alf ari', 'alpha ari', 'hamal'],
  betAri: ['* bet ari', 'beta ari', 'sheratan'],
  gamAri: ['* gam ari', 'gamma ari', 'mesarthim'],
  alfTau: ['* alf tau', 'alpha tau', 'aldebaran'],
  betTau: ['* bet tau', 'beta tau', 'elnath'],
  zetTau: ['* zet tau', 'zeta tau'],
  gamTau: ['* gam tau', 'gamma tau'],
  epsTau: ['* eps tau', 'epsilon tau', 'ain'],
  alfGem: ['* alf gem', 'alpha gem', 'castor'],
  betGem: ['* bet gem', 'beta gem', 'pollux'],
  gamGem: ['* gam gem', 'gamma gem', 'alhena'],
  delGem: ['* del gem', 'delta gem', 'wasat'],
  epsGem: ['* eps gem', 'epsilon gem', 'mebsuta'],
  alfCnc: ['* alf cnc', 'alpha cnc', 'acubens'],
  betCnc: ['* bet cnc', 'beta cnc', 'altarf'],
  gamCnc: ['* gam cnc', 'gamma cnc', 'asellus borealis'],
  delCnc: ['* del cnc', 'delta cnc', 'asellus australis'],
  alfLeo: ['* alf leo', 'alpha leo', 'regulus'],
  betLeo: ['* bet leo', 'beta leo', 'denebola'],
  gamLeo: ['* gam leo', 'gamma leo', 'algieba'],
  delLeo: ['* del leo', 'delta leo', 'zosma'],
  epsLeo: ['* eps leo', 'epsilon leo', 'ras elased australis'],
  zetLeo: ['* zet leo', 'zeta leo', 'adhafera'],
  etaLeo: ['* eta leo', 'eta leo'],
  theLeo: ['* tet leo', '* the leo', 'theta leo', 'chertan'],
  alfVir: ['* alf vir', 'alpha vir', 'spica'],
  gamVir: ['* gam vir', 'gamma vir', 'porrima'],
  delVir: ['* del vir', 'delta vir', 'minelauva'],
  epsVir: ['* eps vir', 'epsilon vir', 'vindemiatrix'],
  zetVir: ['* zet vir', 'zeta vir', 'heze'],
  alfLib: ['* alf lib', 'alpha lib', 'zubenelgenubi'],
  betLib: ['* bet lib', 'beta lib', 'zubeneschamali'],
  gamLib: ['* gam lib', 'gamma lib'],
  sigLib: ['* sig lib', 'sigma lib'],
  alfSco: ['* alf sco', 'alpha sco', 'antares'],
  betSco: ['* bet sco', 'beta sco', 'acrabb'],
  delSco: ['* del sco', 'delta sco', 'dschubba'],
  epsSco: ['* eps sco', 'epsilon sco', 'larawag'],
  lamSco: ['* lam sco', 'lambda sco', 'shaula'],
  tetSco: ['* tet sco', '* the sco', 'theta sco', 'sargas'],
  alfSgr: ['* alf sgr', 'alpha sgr', 'rukbat'],
  betSgr: ['* bet sgr', 'beta sgr', 'arkab'],
  gamSgr: ['* gam sgr', 'gamma sgr', 'alnasl'],
  delSgr: ['* del sgr', 'delta sgr', 'kaus media'],
  epsSgr: ['* eps sgr', 'epsilon sgr', 'kaus australis'],
  lamSgr: ['* lam sgr', 'lambda sgr', 'kaus borealis'],
  sigSgr: ['* sig sgr', 'sigma sgr', 'nunki'],
  zetSgr: ['* zet sgr', 'zeta sgr', 'ascella'],
  alfCap: ['* alf cap', 'alpha cap', 'algedi'],
  betCap: ['* bet cap', 'beta cap', 'dabih'],
  gamCap: ['* gam cap', 'gamma cap', 'nashira'],
  delCap: ['* del cap', 'delta cap', 'deneb algedi'],
  alfAqr: ['* alf aqr', 'alpha aqr', 'sadalmelik'],
  betAqr: ['* bet aqr', 'beta aqr', 'sadalsuud'],
  gamAqr: ['* gam aqr', 'gamma aqr', 'sadachbia'],
  zetAqr: ['* zet aqr', 'zeta aqr'],
  alfPsc: ['* alf psc', 'alpha psc', 'alrescha'],
  etaPsc: ['* eta psc', 'eta psc', 'alpherg'],
  gamPsc: ['* gam psc', 'gamma psc'],
  omePsc: ['* ome psc', 'omega psc'],
  iotPsc: ['* iot psc', 'iota psc']
}

const ZODIAC_SEGMENTS = [
  ['Aries', 'alfAri', 'betAri'], ['Aries', 'betAri', 'gamAri'],
  ['Taurus', 'betTau', 'zetTau'], ['Taurus', 'zetTau', 'alfTau'], ['Taurus', 'alfTau', 'epsTau'], ['Taurus', 'epsTau', 'gamTau'],
  ['Gemini', 'alfGem', 'epsGem'], ['Gemini', 'epsGem', 'gamGem'], ['Gemini', 'gamGem', 'delGem'], ['Gemini', 'delGem', 'betGem'],
  ['Cancer', 'alfCnc', 'delCnc'], ['Cancer', 'delCnc', 'gamCnc'], ['Cancer', 'delCnc', 'betCnc'],
  ['Leo', 'alfLeo', 'etaLeo'], ['Leo', 'etaLeo', 'gamLeo'], ['Leo', 'gamLeo', 'zetLeo'], ['Leo', 'zetLeo', 'epsLeo'], ['Leo', 'alfLeo', 'theLeo'], ['Leo', 'theLeo', 'delLeo'], ['Leo', 'delLeo', 'betLeo'],
  ['Virgo', 'alfVir', 'zetVir'], ['Virgo', 'zetVir', 'gamVir'], ['Virgo', 'gamVir', 'delVir'], ['Virgo', 'delVir', 'epsVir'],
  ['Libra', 'alfLib', 'betLib'], ['Libra', 'betLib', 'gamLib'], ['Libra', 'alfLib', 'sigLib'],
  ['Scorpius', 'betSco', 'delSco'], ['Scorpius', 'delSco', 'alfSco'], ['Scorpius', 'alfSco', 'epsSco'], ['Scorpius', 'epsSco', 'tetSco'], ['Scorpius', 'tetSco', 'lamSco'],
  ['Sagittarius', 'gamSgr', 'delSgr'], ['Sagittarius', 'delSgr', 'epsSgr'], ['Sagittarius', 'delSgr', 'lamSgr'], ['Sagittarius', 'lamSgr', 'sigSgr'], ['Sagittarius', 'sigSgr', 'zetSgr'], ['Sagittarius', 'alfSgr', 'betSgr'],
  ['Capricornus', 'alfCap', 'betCap'], ['Capricornus', 'betCap', 'delCap'], ['Capricornus', 'delCap', 'gamCap'], ['Capricornus', 'gamCap', 'alfCap'],
  ['Aquarius', 'alfAqr', 'betAqr'], ['Aquarius', 'alfAqr', 'gamAqr'], ['Aquarius', 'gamAqr', 'zetAqr'],
  ['Pisces', 'alfPsc', 'etaPsc'], ['Pisces', 'etaPsc', 'gamPsc'], ['Pisces', 'gamPsc', 'omePsc'], ['Pisces', 'omePsc', 'iotPsc']
] as const

type ZodiacLinePoint = {
  id: number
  x: number
  y: number
}

type ZodiacLineSegment = {
  id: string
  constellation: string
  from: ZodiacLinePoint
  to: ZodiacLinePoint
}

const {
  data: image,
  pending,
  error
} = await useFetch<CameraImage>(() => `${apiBase}/api/query/${imgId.value}`, {
  key: `gallery-image-${imgId.value}`
})

const imageFileName = computed(() => image.value ? getImageFileName(image.value.imgPath) ?? '' : '')

const imageUrl = computed(() => imageFileName.value ? `${apiBase}/api/images/${imageFileName.value}.jpg` : '')

const { data: fitsInfo } = useLazyFetch<ArchiveFileInfo>(
  () => `${apiBase}/api/archive/files/${imageFileName.value}.fits`,
  {
    key: `gallery-fits-${imgId.value}`,
    immediate: Boolean(imageFileName.value),
    watch: [imageFileName]
  }
)

const hasFits = computed(() => Boolean(fitsInfo.value?.exists && fitsInfo.value.sizeBytes > 0))

// Rice-archived frames are downloaded as stored (.fits.fz is itself a valid FITS file);
// anything else is offered gzip-compressed, which the backend produces on the fly if needed.
const fitsIsRice = computed(() => fitsInfo.value?.format === 'rice')
const fitsDownloadUrl = computed(() => imageFileName.value
  ? `${apiBase}/api/images/${imageFileName.value}.fits${fitsIsRice.value ? '.fz' : '.gz'}`
  : '')
const fitsFormatLabel = computed(() => fitsIsRice.value ? ' · Rice' : fitsInfo.value?.gzipped ? ' · gzip' : '')

const fitsSizeLabel = computed(() => {
  const bytes = fitsInfo.value?.sizeBytes ?? 0
  if (!bytes) {
    return ''
  }

  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
})

const capturedAt = computed(() => image.value ? formatDateTime(image.value.timestamp) : '')

useHead({
  title: computed(() => image.value ? `${image.value.siteName} · ${capturedAt.value}` : 'Image')
})

watch(imageUrl, () => {
  imageFailed.value = false
})

const period = computed(() => image.value ? getImagePeriod(image.value.timestamp) : '')

type FrameParam = {
  label: string
  value: string | number
  icon: string
}

const formatCompactNumber = (value: number) => Number(value.toFixed(2)).toString()

// The capture script stores exposure time in microseconds.
const exposureLabel = computed(() => {
  const micros = image.value?.exposure ?? 0

  if (micros >= 1_000_000) {
    return `${formatCompactNumber(micros / 1_000_000)} s`
  }

  if (micros >= 1_000) {
    return `${formatCompactNumber(micros / 1_000)} ms`
  }

  return `${micros} µs`
})

// Tiles above the image: when and where the frame was captured.
const captureParams = computed<FrameParam[]>(() => image.value
  ? [
      { label: 'Captured', value: capturedAt.value, icon: 'i-lucide-clock' },
      { label: 'Period', value: period.value, icon: 'i-lucide-sun-moon' },
      { label: 'Time zone', value: image.value.timeZone || 'Unknown', icon: 'i-lucide-globe' },
      { label: 'Camera', value: image.value.cameraId || 'Unknown', icon: 'i-lucide-camera' }
    ]
  : []
)

// Tiles below the image: sensor settings and the archived raw frame.
const sensorParams = computed<FrameParam[]>(() => image.value
  ? [
      { label: 'Exposure', value: exposureLabel.value, icon: 'i-lucide-timer' },
      { label: 'Gain', value: image.value.gain, icon: 'i-lucide-gauge' },
      { label: 'Bit depth', value: `${image.value.bit}-bit`, icon: 'i-lucide-binary' },
      { label: 'Temperature', value: `${image.value.temperature.toFixed(1)} °C`, icon: 'i-lucide-thermometer' },
      { label: 'Humidity', value: `${image.value.humidity.toFixed(1)} %`, icon: 'i-lucide-droplets' },
      {
        label: 'FITS frame',
        value: fitsInfo.value
          ? (hasFits.value ? `${fitsSizeLabel.value}${fitsFormatLabel.value}` : 'Not available')
          : 'Checking',
        icon: 'i-lucide-file-archive'
      }
    ]
  : []
)

const isPlateSolving = computed(() =>
  plateSolvePending.value
  || plateSolve.value?.status === 'QUEUED'
  || plateSolve.value?.status === 'RUNNING'
)

const plateSolveProgress = computed(() => plateSolve.value?.progress ?? null)

const plateSolveProgressPercent = computed(() =>
  Math.max(0, Math.min(100, plateSolveProgress.value?.percent ?? (isPlateSolving.value ? 5 : 0)))
)

const plateSolveProgressPhase = computed(() =>
  plateSolveProgress.value?.phase ?? (isPlateSolving.value ? 'Starting WCS solver' : 'Idle')
)

const plateSolveProgressDetail = computed(() =>
  plateSolveProgress.value?.detail ?? (isPlateSolving.value ? 'Waiting for backend progress.' : '')
)

const plateSolveProgressLogTail = computed(() => plateSolveProgress.value?.logTail ?? [])

const plateSolveProgressBarStyle = computed(() => ({
  width: `${plateSolveProgressPercent.value}%`
}))

const shouldShowPlateSolveProgress = computed(() =>
  isPlateSolving.value || Boolean(plateSolveProgress.value)
)

const solveAnimationStatus = computed(() =>
  `${plateSolveProgressPhase.value} · ${plateSolveProgressPercent.value}%`
)

const hasPlateSolveResult = computed(() =>
  Boolean(plateSolve.value?.stars?.length)
)

const shouldShowPlateSolveOverlay = computed(() =>
  hasPlateSolveResult.value && overlayVisible.value
)

const plateSolveStageStyle = computed(() => ({
  transform: 'none'
}))

const zodiacStarByKey = computed(() => {
  const stars = plateSolve.value?.stars.filter(hasReliableCatalogMatch) ?? []
  const matches = new Map<string, PlateSolveStar>()

  for (const key of Object.keys(ZODIAC_STAR_ALIASES)) {
    const star = bestMatchingZodiacStar(key, stars)
    if (star) {
      matches.set(key, star)
    }
  }

  return matches
})

const zodiacStarIds = computed(() =>
  new Set([...zodiacStarByKey.value.values()].map(star => star.id))
)

const zodiacLineSegments = computed<ZodiacLineSegment[]>(() => {
  const crop = plateSolve.value?.crop

  if (!crop) {
    return []
  }

  const segments: ZodiacLineSegment[] = []

  for (const [constellation, fromKey, toKey] of ZODIAC_SEGMENTS) {
    const fromStar = zodiacStarByKey.value.get(fromKey)
    const toStar = zodiacStarByKey.value.get(toKey)

    if (!fromStar || !toStar) {
      continue
    }

    segments.push({
      id: `${constellation}-${fromKey}-${toKey}`,
      constellation,
      from: pointForStar(fromStar, crop),
      to: pointForStar(toStar, crop)
    })
  }

  return segments
})

const shouldShowZodiacLines = computed(() =>
  shouldShowPlateSolveOverlay.value && zodiacLineSegments.value.length > 0
)

const overlayToggleLabel = computed(() =>
  overlayVisible.value ? 'Hide Overlay' : 'Show Overlay'
)

const overlayToggleIcon = computed(() =>
  overlayVisible.value ? 'i-lucide-eye-off' : 'i-lucide-eye'
)

const candidateToggleLabel = computed(() =>
  showUnconfirmedCandidates.value ? 'Hide Candidates' : 'Show Candidates'
)

const candidateToggleIcon = computed(() =>
  showUnconfirmedCandidates.value ? 'i-lucide-circle-off' : 'i-lucide-circle-dashed'
)

const catalogMatchedStars = computed(() =>
  plateSolve.value?.stars.filter(hasReliableCatalogMatch) ?? []
)

const rawCandidateStars = computed(() =>
  plateSolve.value?.stars.filter(star => !hasReliableCatalogMatch(star)) ?? []
)

const plateSolveSummary = computed(() => {
  if (!plateSolve.value) {
    return 'No plate solve has been run for this image.'
  }

  if (plateSolve.value.status === 'SOLVED') {
    return `Solved WCS; snapped ${catalogMatchedStars.value.length} catalog IDs to detected centroids and kept ${rawCandidateStars.value.length} raw candidates hidden by default.`
  }

  if (plateSolve.value.status === 'SOLVER_UNAVAILABLE') {
    return `${plateSolve.value.stars.length} point candidates detected locally; install local Astrometry.net indexes for RA/Dec solving.`
  }

  return plateSolve.value.message
})

const visiblePlateSolveStars = computed(() => {
  const stars = plateSolve.value?.stars ?? []
  const zodiacIds = zodiacStarIds.value

  return stars.filter(star =>
    hasReliableCatalogMatch(star)
    || zodiacIds.has(star.id)
    || star.id === selectedStar.value?.id
    || (showUnconfirmedCandidates.value && (isPlateSolveFullscreen.value || star.brightness >= 180))
  )
})

const plateSolveParams = computed(() => {
  if (!plateSolve.value) {
    return []
  }

  const solution = plateSolve.value.solution

  return [
    { label: 'Solve status', value: plateSolve.value.status },
    { label: 'Catalog matches', value: catalogMatchedStars.value.length },
    { label: 'Raw candidates', value: rawCandidateStars.value.length },
    { label: 'Field RA', value: formatNumber(solution?.fieldCenterRaDeg, 'deg') },
    { label: 'Field Dec', value: formatNumber(solution?.fieldCenterDecDeg, 'deg') },
    { label: 'Field width', value: formatNumber(solution?.fieldWidthDeg, 'deg') },
    { label: 'Field height', value: formatNumber(solution?.fieldHeightDeg, 'deg') }
  ]
})

const selectedStarParams = computed(() => {
  if (!selectedStar.value) {
    return []
  }

  const params: Array<{ label: string, value: number | string }> = [
    { label: 'RA', value: formatNumber(selectedStar.value.raDeg, 'deg') },
    { label: 'Dec', value: formatNumber(selectedStar.value.decDeg, 'deg') },
    { label: 'Magnitude', value: formatNumber(selectedStar.value.magnitude) }
  ]

  const matchError = formatCatalogMatchError(selectedStar.value)
  if (matchError) {
    params.push({ label: 'Match error', value: matchError })
  }

  params.push(
    { label: 'Position source', value: formatStarPositionSource(selectedStar.value) },
    { label: 'Brightness', value: selectedStar.value.brightness }
  )

  return params
})

const selectedStarIdentifiers = computed(() =>
  selectedStar.value && hasReliableCatalogMatch(selectedStar.value)
    ? selectedStar.value.identifiers ?? []
    : []
)

const selectedStarLinks = computed(() =>
  selectedStar.value && hasReliableCatalogMatch(selectedStar.value)
    ? selectedStar.value.links ?? []
    : []
)

const selectedStarIsOnlyPixelDetection = computed(() =>
  Boolean(selectedStar.value && !selectedStar.value.skyCoordinateSolved)
)

const selectedStarHasNoCatalogMatch = computed(() =>
  Boolean(selectedStar.value?.skyCoordinateSolved && !selectedStarIdentifiers.value.length)
)

const cropBoxStyle = computed(() => {
  const crop = plateSolve.value?.crop

  if (!crop) {
    return undefined
  }

  return {
    left: `${(crop.x / crop.originalWidth) * 100}%`,
    top: `${(crop.y / crop.originalHeight) * 100}%`,
    width: `${(crop.width / crop.originalWidth) * 100}%`,
    height: `${(crop.height / crop.originalHeight) * 100}%`
  }
})

const startPlateSolve = async () => {
  plateSolveError.value = ''
  plateSolvePending.value = true
  overlayVisible.value = true
  showUnconfirmedCandidates.value = false
  hasAutoZoomedPlateSolve.value = false

  try {
    plateSolve.value = await $fetch<PlateSolveResult>(`${apiBase}/api/plate-solve/${imgId.value}`, {
      method: 'POST'
    })

    if (isTerminalPlateSolveStatus(plateSolve.value.status)) {
      plateSolvePending.value = false
      return
    }

    if (isActivePlateSolveStatus(plateSolve.value.status)) {
      startPlateSolvePolling()
    }
  } catch (error) {
    plateSolveError.value = error instanceof Error ? error.message : 'Unable to start plate solve.'
    plateSolvePending.value = false
  }
}

const startPlateSolvePolling = () => {
  stopPlateSolvePolling()
  plateSolvePollTimer = setInterval(async () => {
    await refreshPlateSolveStatus()
  }, 1200)
}

const stopPlateSolvePolling = () => {
  if (plateSolvePollTimer) {
    clearInterval(plateSolvePollTimer)
    plateSolvePollTimer = undefined
  }
}

const togglePlateSolveOverlay = () => {
  if (!hasPlateSolveResult.value) {
    return
  }

  overlayVisible.value = !overlayVisible.value
}

const toggleUnconfirmedCandidates = () => {
  if (!hasPlateSolveResult.value) {
    return
  }

  showUnconfirmedCandidates.value = !showUnconfirmedCandidates.value
}

const selectStar = (star: PlateSolveStar) => {
  selectedStar.value = star
}

const closeSelectedStar = () => {
  selectedStar.value = null
}

const refreshPlateSolveStatus = async () => {
  try {
    plateSolve.value = await $fetch<PlateSolveResult>(`${apiBase}/api/plate-solve/${imgId.value}`)

    if (isTerminalPlateSolveStatus(plateSolve.value.status)) {
      plateSolvePending.value = false
      stopPlateSolvePolling()
    } else if (isActivePlateSolveStatus(plateSolve.value.status)) {
      plateSolvePending.value = true
      if (!plateSolvePollTimer) {
        startPlateSolvePolling()
      }
    } else {
      plateSolvePending.value = false
      stopPlateSolvePolling()
    }
  } catch (error) {
    plateSolveError.value = error instanceof Error ? error.message : 'Unable to read plate solve status.'
    plateSolvePending.value = false
    stopPlateSolvePolling()
  }
}

const isTerminalPlateSolveStatus = (status: string) =>
  status === 'SOLVED'
  || status === 'SOLVER_UNAVAILABLE'
  || status === 'FAILED'

const isActivePlateSolveStatus = (status: string) =>
  status === 'QUEUED'
  || status === 'RUNNING'

const starStyle = (star: PlateSolveStar) => {
  const crop = plateSolve.value?.crop

  if (!crop) {
    return {}
  }

  return {
    left: `${(star.x / crop.originalWidth) * 100}%`,
    top: `${(star.y / crop.originalHeight) * 100}%`
  }
}

const starMarkerClass = (star: PlateSolveStar) => ({
  'star-marker-identified': hasReliableCatalogMatch(star),
  'star-marker-unidentified': star.skyCoordinateSolved && !hasReliableCatalogMatch(star),
  'star-marker-pixel-only': !star.skyCoordinateSolved,
  'star-marker-selected': selectedStar.value?.id === star.id,
  'star-marker-zodiac': zodiacStarIds.value.has(star.id)
})

const starStatusLabel = (star: PlateSolveStar) => {
  if (hasReliableCatalogMatch(star)) {
    return 'Identified star'
  }

  if (star.skyCoordinateSolved) {
    return 'Unmatched candidate'
  }

  return 'Candidate point'
}

const starDetailSubtitle = (star: PlateSolveStar) => {
  if (hasReliableCatalogMatch(star)) {
    return 'Reliable catalog match and sky position'
  }

  if (star.skyCoordinateSolved) {
    return 'Sky position projected; no reliable catalog ID'
  }

  return 'Pixel detection only'
}

const starLabel = (star: PlateSolveStar) => {
  if (hasReliableCatalogMatch(star) && (selectedStar.value?.id === star.id || zodiacStarIds.value.has(star.id))) {
    return star.name || star.identifiers?.[0]?.label || ''
  }

  if (selectedStar.value?.id === star.id) {
    return starStatusLabel(star)
  }

  return ''
}

const starDisplayName = (star: PlateSolveStar) =>
  hasReliableCatalogMatch(star)
    ? star.name || star.identifiers?.[0]?.label || `Star ${star.id}`
    : `${starStatusLabel(star)} ${star.id}`

const starAriaLabel = (star: PlateSolveStar) =>
  `Show ${starDisplayName(star)} details`

const formatNumber = (value: number | null | undefined, suffix = '') => {
  if (value === null || value === undefined) {
    return 'Pending'
  }

  return `${value.toFixed(4)}${suffix ? ` ${suffix}` : ''}`
}

const hasReliableCatalogMatch = (star: PlateSolveStar) =>
  Boolean((star.name || star.identifiers?.length)
    && matchDistanceArcsec(star) <= MAX_RELIABLE_CATALOG_MATCH_ERROR_ARCSEC)

const matchDistanceArcsec = (star: PlateSolveStar) =>
  star.catalogMatchDistanceArcsec ?? Number.POSITIVE_INFINITY

const formatCatalogMatchError = (star: PlateSolveStar) => {
  if (hasReliableCatalogMatch(star) && star.catalogMatchDistanceArcsec === 0) {
    return ''
  }

  if (hasReliableCatalogMatch(star)) {
    return formatNumber(star.catalogMatchDistanceArcsec, 'arcsec')
  }

  if (star.catalogMatchDistanceArcsec !== null && star.catalogMatchDistanceArcsec !== undefined) {
    return 'Unreliable'
  }

  return 'Pending'
}

const formatStarPositionSource = (star: PlateSolveStar) => {
  if (hasReliableCatalogMatch(star) && star.catalogMatchDistanceArcsec === 0) {
    return 'Detected centroid'
  }

  if (star.skyCoordinateSolved) {
    return 'WCS projection'
  }

  return 'Pixel detection'
}

const pointForStar = (star: PlateSolveStar, crop: PlateSolveCrop): ZodiacLinePoint => ({
  id: star.id,
  x: (star.x / crop.originalWidth) * 100,
  y: (star.y / crop.originalHeight) * 100
})

const percentCoordinate = (value: number) => `${value}%`

const bestMatchingZodiacStar = (key: string, stars: PlateSolveStar[]) => {
  const aliases = ZODIAC_STAR_ALIASES[key]?.map(normalizeStarText) ?? []

  return stars
    .filter((star) => {
      const text = normalizeStarText(starSearchText(star))
      return aliases.some(alias => alias && text.includes(alias))
    })
    .sort(compareZodiacCandidates)[0] ?? null
}

const compareZodiacCandidates = (first: PlateSolveStar, second: PlateSolveStar) =>
  (first.magnitude ?? 99) - (second.magnitude ?? 99)
  || second.brightness - first.brightness

const starSearchText = (star: PlateSolveStar) => [
  star.name,
  ...(star.identifiers?.flatMap(identifier => [
    identifier.catalog,
    identifier.value,
    identifier.label
  ]) ?? [])
].filter(Boolean).join(' ')

const normalizeStarText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '')

const openPlateSolveFullscreen = () => {
  if (!image.value) {
    return
  }

  isPlateSolveFullscreen.value = true
}

const closePlateSolveFullscreen = () => {
  isPlateSolveFullscreen.value = false
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closePlateSolveFullscreen()
  }
}

const autoZoomPlateSolve = () => {
  if (hasAutoZoomedPlateSolve.value || plateSolve.value?.status !== 'SOLVED') {
    return
  }

  hasAutoZoomedPlateSolve.value = true
  openPlateSolveFullscreen()
}

onMounted(() => {
  refreshPlateSolveStatus()
  window.addEventListener('keydown', handleKeydown)
})

watch(plateSolve, (next) => {
  if (next?.status === 'SOLVED') {
    autoZoomPlateSolve()
  }

  if (!selectedStar.value) {
    return
  }

  selectedStar.value = next?.stars?.find(star => star.id === selectedStar.value?.id) ?? null
})

watch(imgId, () => {
  isPlateSolveFullscreen.value = false
  hasAutoZoomedPlateSolve.value = false
  selectedStar.value = null
})

onBeforeUnmount(() => {
  stopPlateSolvePolling()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <UContainer class="py-8 lg:py-10">
    <div class="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div class="min-w-0">
        <p class="astro-eyebrow">
          Frame analysis
        </p>
        <h1 class="mt-2 text-4xl font-black leading-none tracking-normal text-white md:text-5xl">
          {{ image?.siteName || 'Image Details' }}
        </h1>
        <p
          v-if="image"
          class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400"
        >
          <span class="inline-flex items-center gap-1.5">
            <UIcon
              name="i-lucide-clock"
              class="size-4 text-sky-200/80"
            />
            {{ capturedAt }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <UIcon
              name="i-lucide-hash"
              class="size-4 text-sky-200/80"
            />
            Image {{ image.imgId }}
          </span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          :loading="isPlateSolving"
          :disabled="isPlateSolving || imageFailed"
          icon="i-lucide-sparkles"
          color="primary"
          @click="startPlateSolve"
        >
          Plate Solve
        </UButton>

        <UDropdownMenu
          :items="[
            {
              label: 'JPEG preview',
              icon: 'i-lucide-image',
              to: imageUrl,
              target: '_blank',
              disabled: !imageUrl || imageFailed
            },
            {
              label: hasFits ? `FITS frame (${fitsIsRice ? '.fz, Rice' : '.gz'}, ${fitsSizeLabel})` : 'FITS frame unavailable',
              icon: 'i-lucide-file-archive',
              to: fitsDownloadUrl,
              target: '_blank',
              disabled: !hasFits
            }
          ]"
          :content="{ align: 'start' }"
        >
          <UButton
            :disabled="!image"
            icon="i-lucide-download"
            color="neutral"
            variant="subtle"
            trailing-icon="i-lucide-chevron-down"
          >
            Download
          </UButton>
        </UDropdownMenu>

        <UButton
          to="/gallery"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="subtle"
        >
          Gallery
        </UButton>
      </div>
    </div>

    <div
      v-if="pending"
      class="grid min-h-80 place-items-center"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-sky-200"
      />
    </div>

    <UAlert
      v-else-if="error || !image"
      class="astro-panel p-2"
      color="error"
      variant="subtle"
      title="Image not found."
      description="Go back to the gallery and choose another image."
    />

    <div
      v-else
      class="space-y-6"
    >
      <dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          v-for="param in captureParams"
          :key="param.label"
          class="param-tile astro-panel-strong"
        >
          <dt class="param-label">
            <UIcon
              :name="param.icon"
              class="size-3.5 text-sky-200/80"
            />
            {{ param.label }}
          </dt>
          <dd
            class="param-value"
            :title="String(param.value)"
          >
            {{ param.value }}
          </dd>
        </div>
      </dl>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <section
          class="astro-panel min-w-0 overflow-hidden"
          aria-label="Captured frame"
        >
          <div class="image-viewport flex min-h-[50vh] items-center justify-center bg-black p-2">
            <figure
              class="plate-solve-stage relative max-h-[76vh] max-w-full"
              :style="plateSolveStageStyle"
            >
              <div
                v-if="imageFailed"
                class="grid aspect-[4/3] w-[min(100%,720px)] place-items-center p-8 text-center text-slate-400"
              >
                <div class="flex flex-col items-center gap-3">
                  <UIcon
                    name="i-lucide-image-off"
                    class="size-10"
                  />
                  <p class="text-sm font-semibold text-slate-200">
                    Image data unavailable
                  </p>
                  <p class="max-w-xs text-xs leading-5">
                    This frame's file is missing or empty on the server, so it cannot be displayed or plate-solved.
                  </p>
                </div>
              </div>
              <img
                v-else
                :src="imageUrl"
                :alt="`${image.siteName} all sky capture ${capturedAt}`"
                class="block max-h-[75vh] max-w-full object-contain"
                @error="imageFailed = true"
              >

              <div
                v-if="isPlateSolving"
                class="solve-animation absolute inset-0 overflow-hidden"
              >
                <div class="solve-grid" />
                <div class="solve-beam" />
                <div class="solve-orbit solve-orbit-a" />
                <div class="solve-orbit solve-orbit-b" />
                <div class="solve-status">
                  <span>{{ solveAnimationStatus }}</span>
                  <span class="solve-status-track">
                    <span
                      class="solve-status-fill"
                      :style="plateSolveProgressBarStyle"
                    />
                  </span>
                </div>
              </div>

              <div
                v-if="shouldShowPlateSolveOverlay"
                class="absolute inset-0"
              >
                <svg
                  v-if="shouldShowZodiacLines"
                  class="zodiac-lines pointer-events-none absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  <line
                    v-for="segment in zodiacLineSegments"
                    :key="segment.id"
                    class="zodiac-line"
                    :x1="percentCoordinate(segment.from.x)"
                    :y1="percentCoordinate(segment.from.y)"
                    :x2="percentCoordinate(segment.to.x)"
                    :y2="percentCoordinate(segment.to.y)"
                  />
                </svg>

                <div
                  v-if="cropBoxStyle"
                  class="pointer-events-none absolute border border-emerald-300/60"
                  :style="cropBoxStyle"
                />
                <button
                  v-for="star in visiblePlateSolveStars"
                  :key="star.id"
                  type="button"
                  :aria-label="starAriaLabel(star)"
                  class="star-marker"
                  :class="starMarkerClass(star)"
                  :style="starStyle(star)"
                  @click.stop="selectStar(star)"
                >
                  <span
                    v-if="starLabel(star)"
                    class="star-label"
                  >
                    {{ starLabel(star) }}
                  </span>
                </button>
              </div>
            </figure>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <p
              class="min-w-0 flex-1 truncate font-mono text-xs text-slate-400"
              :title="imageFileName"
            >
              {{ imageFileName }}
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                size="sm"
                :disabled="!hasPlateSolveResult"
                :icon="overlayToggleIcon"
                color="neutral"
                variant="subtle"
                @click="togglePlateSolveOverlay"
              >
                {{ overlayToggleLabel }}
              </UButton>

              <UButton
                size="sm"
                :disabled="!hasPlateSolveResult"
                :icon="candidateToggleIcon"
                color="neutral"
                variant="subtle"
                @click="toggleUnconfirmedCandidates"
              >
                {{ candidateToggleLabel }}
              </UButton>

              <UButton
                size="sm"
                :disabled="imageFailed"
                icon="i-lucide-maximize-2"
                color="neutral"
                variant="subtle"
                @click="openPlateSolveFullscreen"
              >
                Full Screen
              </UButton>
            </div>
          </div>
        </section>

        <aside class="space-y-4">
          <div class="astro-panel p-4">
            <div class="flex items-start gap-2">
              <UIcon
                name="i-lucide-radar"
                class="mt-0.5 size-4 text-sky-200"
              />
              <div>
                <h2 class="text-sm font-extrabold text-white">
                  Plate Solve
                </h2>
                <p class="mt-1 text-xs leading-5 text-slate-400">
                  {{ plateSolveSummary }}
                </p>
              </div>
            </div>

            <div
              v-if="shouldShowPlateSolveProgress"
              class="mt-4 rounded-md border border-white/10 bg-white/[0.035] p-3"
            >
              <div class="flex items-center justify-between gap-3 text-xs font-bold text-slate-200">
                <span>{{ plateSolveProgressPhase }}</span>
                <span class="tabular-nums">{{ plateSolveProgressPercent }}%</span>
              </div>

              <div class="solve-progress-track mt-2">
                <div
                  class="solve-progress-fill"
                  :style="plateSolveProgressBarStyle"
                />
              </div>

              <p
                v-if="plateSolveProgressDetail"
                class="mt-2 text-xs leading-5 text-slate-400"
              >
                {{ plateSolveProgressDetail }}
              </p>

              <pre
                v-if="plateSolveProgressLogTail.length"
                class="solve-log mt-3"
              >{{ plateSolveProgressLogTail.join('\n') }}</pre>
            </div>

            <dl
              v-if="plateSolveParams.length"
              class="mt-4"
            >
              <div
                v-for="param in plateSolveParams"
                :key="param.label"
                class="border-t border-white/10 py-2"
              >
                <dt class="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {{ param.label }}
                </dt>
                <dd class="mt-1 break-words text-sm text-slate-200">
                  {{ param.value }}
                </dd>
              </div>
            </dl>

            <div
              v-if="selectedStar"
              class="mt-4 border-t border-white/10 pt-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-extrabold text-white">
                    {{ starDisplayName(selectedStar) }}
                  </h3>
                  <p class="mt-1 text-xs text-slate-400">
                    {{ starDetailSubtitle(selectedStar) }}
                  </p>
                </div>

                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Close star details"
                  @click="closeSelectedStar"
                />
              </div>

              <dl class="mt-3">
                <div
                  v-for="param in selectedStarParams"
                  :key="param.label"
                  class="border-t border-white/10 py-2 first:border-t-0"
                >
                  <dt class="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {{ param.label }}
                  </dt>
                  <dd class="mt-1 break-words text-sm text-slate-200">
                    {{ param.value }}
                  </dd>
                </div>
              </dl>

              <UAlert
                v-if="selectedStarIsOnlyPixelDetection"
                class="mt-3"
                color="warning"
                variant="subtle"
                title="Pixel detection only"
                description="RA, Dec, catalog IDs, and links appear after the local plate solver produces a WCS solution."
              />

              <UAlert
                v-else-if="selectedStarHasNoCatalogMatch"
                class="mt-3"
                color="neutral"
                variant="subtle"
                title="Unmatched point candidate"
                description="This point has a projected sky coordinate, but no reliable catalog match. It may be cloud texture, noise, or another non-stellar artifact."
              />

              <div
                v-if="selectedStarIdentifiers.length"
                class="mt-3 flex flex-wrap gap-2"
              >
                <a
                  v-for="identifier in selectedStarIdentifiers"
                  :key="`${identifier.catalog}-${identifier.value}`"
                  class="star-link"
                  :href="identifier.url"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ identifier.label }}
                  <UIcon
                    name="i-lucide-external-link"
                    class="size-3"
                  />
                </a>
              </div>

              <div
                v-if="selectedStarLinks.length"
                class="mt-3 grid gap-2"
              >
                <a
                  v-for="link in selectedStarLinks"
                  :key="link.url"
                  class="star-link justify-between"
                  :href="link.url"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ link.label }}
                  <UIcon
                    name="i-lucide-external-link"
                    class="size-3"
                  />
                </a>
              </div>
            </div>
          </div>

          <UAlert
            v-if="plateSolveError"
            class="astro-panel p-2"
            color="error"
            variant="subtle"
            title="Plate solve failed"
            :description="plateSolveError"
          />
        </aside>
      </div>

      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div
          v-for="param in sensorParams"
          :key="param.label"
          class="param-tile astro-panel-strong"
        >
          <dt class="param-label">
            <UIcon
              :name="param.icon"
              class="size-3.5 text-sky-200/80"
            />
            {{ param.label }}
          </dt>
          <dd
            class="param-value"
            :title="String(param.value)"
          >
            {{ param.value }}
          </dd>
        </div>
      </dl>
    </div>

    <Teleport to="body">
      <div
        v-if="isPlateSolveFullscreen && image"
        class="solve-fullscreen"
        role="dialog"
        aria-modal="true"
        aria-label="Plate solve fullscreen view"
      >
        <div class="solve-fullscreen-toolbar">
          <div class="min-w-0">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">
              Plate solve view
            </p>
            <p class="mt-1 truncate text-sm font-semibold text-white">
              {{ image.siteName }} · {{ capturedAt }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              :disabled="!hasPlateSolveResult"
              :icon="overlayToggleIcon"
              color="neutral"
              variant="subtle"
              @click="togglePlateSolveOverlay"
            >
              {{ overlayToggleLabel }}
            </UButton>

            <UButton
              :disabled="!hasPlateSolveResult"
              :icon="candidateToggleIcon"
              color="neutral"
              variant="subtle"
              @click="toggleUnconfirmedCandidates"
            >
              {{ candidateToggleLabel }}
            </UButton>

            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="subtle"
              @click="closePlateSolveFullscreen"
            >
              Exit
            </UButton>
          </div>
        </div>

        <div class="solve-fullscreen-stage">
          <figure class="solve-fullscreen-figure">
            <img
              :src="imageUrl"
              :alt="`${image.siteName} all sky capture ${capturedAt}`"
              class="solve-fullscreen-image"
            >

            <div
              v-if="shouldShowPlateSolveOverlay"
              class="absolute inset-0"
            >
              <svg
                v-if="shouldShowZodiacLines"
                class="zodiac-lines pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <line
                  v-for="segment in zodiacLineSegments"
                  :key="segment.id"
                  class="zodiac-line"
                  :x1="percentCoordinate(segment.from.x)"
                  :y1="percentCoordinate(segment.from.y)"
                  :x2="percentCoordinate(segment.to.x)"
                  :y2="percentCoordinate(segment.to.y)"
                />
              </svg>

              <div
                v-if="cropBoxStyle"
                class="pointer-events-none absolute border border-emerald-300/60"
                :style="cropBoxStyle"
              />
              <button
                v-for="star in visiblePlateSolveStars"
                :key="star.id"
                type="button"
                :aria-label="starAriaLabel(star)"
                class="star-marker"
                :class="starMarkerClass(star)"
                :style="starStyle(star)"
                @click.stop="selectStar(star)"
              >
                <span
                  v-if="starLabel(star)"
                  class="star-label"
                >
                  {{ starLabel(star) }}
                </span>
              </button>
            </div>
          </figure>
        </div>

        <div
          v-if="selectedStar"
          class="solve-fullscreen-star-panel"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-extrabold text-white">
                {{ starDisplayName(selectedStar) }}
              </h3>
              <p class="mt-1 text-xs text-slate-400">
                {{ starDetailSubtitle(selectedStar) }}
              </p>
            </div>

            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Close star details"
              @click="closeSelectedStar"
            />
          </div>

          <dl class="mt-3">
            <div
              v-for="param in selectedStarParams"
              :key="param.label"
              class="border-t border-white/10 py-2 first:border-t-0"
            >
              <dt class="text-xs font-bold uppercase tracking-wider text-slate-500">
                {{ param.label }}
              </dt>
              <dd class="mt-1 break-words text-sm text-slate-200">
                {{ param.value }}
              </dd>
            </div>
          </dl>

          <div
            v-if="selectedStarIdentifiers.length"
            class="mt-3 flex flex-wrap gap-2"
          >
            <a
              v-for="identifier in selectedStarIdentifiers"
              :key="`${identifier.catalog}-${identifier.value}`"
              class="star-link"
              :href="identifier.url"
              target="_blank"
              rel="noreferrer"
            >
              {{ identifier.label }}
              <UIcon
                name="i-lucide-external-link"
                class="size-3"
              />
            </a>
          </div>

          <div
            v-if="selectedStarLinks.length"
            class="mt-3 grid gap-2"
          >
            <a
              v-for="link in selectedStarLinks"
              :key="link.url"
              class="star-link justify-between"
              :href="link.url"
              target="_blank"
              rel="noreferrer"
            >
              {{ link.label }}
              <UIcon
                name="i-lucide-external-link"
                class="size-3"
              />
            </a>
          </div>
        </div>
      </div>
    </Teleport>
  </UContainer>
</template>

<style scoped>
.param-tile {
  min-width: 0;
  padding: 0.85rem 1rem;
}

.param-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: rgb(100 116 139);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.param-value {
  margin-top: 0.35rem;
  overflow: hidden;
  color: white;
  font-size: 0.95rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-viewport {
  touch-action: pan-x pan-y;
}

.plate-solve-stage {
  transform-origin: center;
  transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.solve-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  background:
    radial-gradient(circle at 50% 42%, rgb(14 165 233 / 0.16), transparent 34rem),
    rgb(2 6 23 / 0.98);
}

.solve-fullscreen-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
}

.solve-fullscreen-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: 0.5rem;
  background: black;
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.5);
}

.solve-fullscreen-figure {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  margin: 0;
}

.solve-fullscreen-image {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 6.5rem);
  object-fit: contain;
}

.solve-fullscreen .star-marker {
  width: 10px;
  height: 10px;
}

.solve-fullscreen .star-marker-zodiac {
  width: 13px;
  height: 13px;
}

.solve-fullscreen-star-panel {
  position: absolute;
  right: 1rem;
  top: 5.25rem;
  width: min(22rem, calc(100vw - 2rem));
  max-height: calc(100vh - 6.5rem);
  overflow: auto;
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: 0.5rem;
  background: rgb(2 6 23 / 0.88);
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.42);
  padding: 1rem;
}

.solve-animation {
  background:
    radial-gradient(circle at center, rgb(34 197 94 / 0.08), transparent 46%),
    linear-gradient(90deg, transparent, rgb(16 185 129 / 0.18), transparent);
}

.solve-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgb(52 211 153 / 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgb(52 211 153 / 0.12) 1px, transparent 1px);
  background-size: 42px 42px;
  animation: solve-grid-drift 4s linear infinite;
}

.solve-beam {
  position: absolute;
  inset: -35%;
  background: conic-gradient(from 0deg, transparent 0deg, rgb(34 211 238 / 0.32) 24deg, transparent 52deg);
  animation: solve-rotate 2.4s linear infinite;
}

.solve-orbit {
  position: absolute;
  inset: 12%;
  border: 1px solid rgb(110 231 183 / 0.45);
  border-radius: 9999px;
}

.solve-orbit-a {
  animation: solve-pulse 1.6s ease-in-out infinite;
}

.solve-orbit-b {
  inset: 24%;
  border-color: rgb(125 211 252 / 0.42);
  animation: solve-pulse 1.6s ease-in-out infinite reverse;
}

.solve-status {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  gap: 0.35rem;
  width: min(72%, 19rem);
  padding: 0.35rem 0.65rem;
  border: 1px solid rgb(167 243 208 / 0.55);
  border-radius: 0.5rem;
  color: white;
  background: rgb(2 6 23 / 0.72);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  transform: translate(-50%, -50%);
}

.solve-status-track,
.solve-progress-track {
  display: block;
  height: 0.35rem;
  overflow: hidden;
  border-radius: 9999px;
  background: rgb(15 23 42 / 0.24);
}

.solve-status-fill,
.solve-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgb(52 211 153), rgb(34 211 238));
  transition: width 220ms ease;
}

.solve-progress-track {
  background: rgb(255 255 255 / 0.08);
}

.solve-log {
  max-height: 9rem;
  overflow: auto;
  border-radius: 0.375rem;
  background: rgb(2 6 23);
  color: rgb(187 247 208);
  font-size: 0.7rem;
  line-height: 1.45;
  padding: 0.65rem;
  white-space: pre-wrap;
}

.star-marker {
  position: absolute;
  width: 9px;
  height: 9px;
  padding: 0;
  border: 1px solid rgb(148 163 184);
  border-radius: 9999px;
  color: inherit;
  background: rgb(148 163 184 / 0.08);
  box-shadow: 0 0 0 2px rgb(148 163 184 / 0.14), 0 0 10px rgb(148 163 184 / 0.48);
  cursor: pointer;
  transform: translate(-50%, -50%);
}

.star-marker-pixel-only {
  border-color: rgb(148 163 184);
  background: rgb(148 163 184 / 0.08);
  box-shadow: 0 0 0 2px rgb(148 163 184 / 0.14), 0 0 10px rgb(148 163 184 / 0.48);
}

.star-marker-unidentified {
  border-color: rgb(251 191 36);
  background: rgb(251 191 36 / 0.08);
  box-shadow: 0 0 0 2px rgb(251 191 36 / 0.12), 0 0 11px rgb(251 191 36 / 0.55);
}

.star-marker-identified {
  border-color: rgb(244 114 182);
  background: rgb(244 114 182 / 0.16);
  box-shadow: 0 0 0 2px rgb(244 114 182 / 0.18), 0 0 15px rgb(244 114 182 / 0.82);
}

.star-marker-zodiac {
  width: 11px;
  height: 11px;
  border-color: rgb(250 204 21);
  background: rgb(250 204 21 / 0.18);
  box-shadow: 0 0 0 3px rgb(250 204 21 / 0.16), 0 0 18px rgb(250 204 21 / 0.82);
}

.star-marker-selected {
  border-color: white;
  background: rgb(255 255 255 / 0.12);
  box-shadow: 0 0 0 4px rgb(255 255 255 / 0.2), 0 0 18px rgb(255 255 255 / 0.9);
}

.star-label {
  position: absolute;
  left: 10px;
  top: -10px;
  max-width: 8rem;
  color: white;
  font-size: 10px;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.8);
}

.zodiac-lines {
  z-index: 1;
}

.zodiac-line {
  fill: none;
  stroke: rgb(250 204 21 / 0.78);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.5px;
  filter: drop-shadow(0 0 2px rgb(250 204 21 / 0.9));
}

.star-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.75rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: 0.375rem;
  color: rgb(226 232 240);
  font-size: 0.75rem;
  text-decoration: none;
}

.star-link:hover {
  border-color: rgb(34 211 238 / 0.55);
  background: rgb(34 211 238 / 0.08);
}

@keyframes solve-grid-drift {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 42px 42px;
  }
}

@keyframes solve-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes solve-pulse {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.95);
  }

  50% {
    opacity: 0.85;
    transform: scale(1.03);
  }
}

@media (max-width: 640px) {
  .solve-fullscreen {
    padding: 0.75rem;
  }

  .solve-fullscreen-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .solve-fullscreen-image {
    max-height: calc(100vh - 9.5rem);
  }

  .solve-fullscreen-star-panel {
    bottom: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    top: auto;
    width: auto;
    max-height: 45vh;
  }
}
</style>
