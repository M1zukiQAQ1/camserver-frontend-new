// Shapes of GET /api/sky/{imgId}, GET /api/sky/{imgId}/streaks and GET /api/nightly on the backend.
// Pixel coordinates are in the original image.

export type SkyStatus = 'OK' | 'NOT_SOLVED' | 'FIT_FAILED'

export interface SkyMagnitudeBin {
  from: number
  to: number
  expected: number
  detected: number
}

export interface SkyQuality {
  /** detected / expected for stars down to magnitudeLimit; null with too few expected stars */
  clearFraction: number | null
  expected: number
  detected: number
  magnitudeLimit: number
  maxAngleDeg: number
  limitingMagnitude: number | null
  bins: SkyMagnitudeBin[]
}

export type SkyPoint = [number, number]

export interface SkyConstellation {
  id: string
  name: string
  label: SkyPoint | null
  lines: SkyPoint[][]
}

export interface SkyBody {
  name: string
  x: number
  y: number
  raDeg: number
  decDeg: number
  detected: boolean
}

export interface SkyStarLabel {
  name: string
  x: number
  y: number
  magnitude: number
}

export interface SkyOverlayData {
  constellations: SkyConstellation[]
  bodies: SkyBody[]
  stars: SkyStarLabel[]
}

export interface SkyView {
  imgId: number
  status: SkyStatus
  message: string | null
  fit: { stars: number, rmsPx: number, maxAngleDeg: number } | null
  quality: SkyQuality | null
  overlay: SkyOverlayData | null
}

export interface Streak {
  x1: number
  y1: number
  x2: number
  y2: number
  lengthPx: number
  widthPx: number
  contrast: number
}

export interface StreakView {
  imgId: number
  status: 'OK' | 'DAYTIME' | 'NO_IMAGE'
  message: string | null
  width: number
  height: number
  streaks: Streak[]
}

export interface NightFrame {
  imgId: number
  at: string
}

export interface Night {
  cameraId: string
  siteName: string | null
  /** local date of the evening the night began, e.g. 2026-11-08 */
  date: string
  timeZone: string
  start: string
  end: string
  frames: NightFrame[]
  keogram: string
  keogramWidth: number
  keogramHeight: number
  timelapse: string | null
  timelapseNote: string | null
  /** whether the video frames carry the site name, UTC time and coordinates */
  timelapseLabelled?: boolean
  builtAt: string
}

/** Where the video of one night stands (GET or POST /api/nightly/{cameraId}/{date}). */
export interface NightVideoStatus {
  state: 'ready' | 'queued' | 'building' | 'none' | 'unavailable'
  message: string | null
  night: Night | null
}
