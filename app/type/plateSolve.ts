export type PlateSolveStatus
  = | 'NOT_STARTED'
    | 'QUEUED'
    | 'RUNNING'
    | 'SOLVED'
    | 'SOLVER_UNAVAILABLE'
    | 'FAILED'

export type PlateSolveCrop = {
  x: number
  y: number
  width: number
  height: number
  originalWidth: number
  originalHeight: number
}

export type PlateSolveSolution = {
  solved: boolean
  fieldCenterRaDeg?: number | null
  fieldCenterDecDeg?: number | null
  fieldWidthDeg?: number | null
  fieldHeightDeg?: number | null
  siteLatitudeDeg?: number | null
  siteLongitudeDeg?: number | null
  wcsFile?: string | null
  solverLog?: string | null
}

export type PlateSolveProgress = {
  phase: string
  percent: number
  detail: string
  logTail: string[]
  startedAt: string
  updatedAt: string
  solverCommand: string
}

export type PlateSolveStarIdentifier = {
  catalog: string
  value: string
  label: string
  url: string
}

export type PlateSolveStarLink = {
  label: string
  url: string
}

export type PlateSolveStar = {
  id: number
  x: number
  y: number
  cropX: number
  cropY: number
  brightness: number
  raDeg?: number | null
  decDeg?: number | null
  name?: string | null
  magnitude?: number | null
  catalogMatchDistanceArcsec?: number | null
  identifiers?: PlateSolveStarIdentifier[]
  links?: PlateSolveStarLink[]
  skyCoordinateSolved: boolean
}

export type PlateSolveResult = {
  imgId: number
  status: PlateSolveStatus
  message: string
  cached: boolean
  generatedAt: string
  crop?: PlateSolveCrop | null
  solution?: PlateSolveSolution | null
  progress?: PlateSolveProgress | null
  stars: PlateSolveStar[]
}
