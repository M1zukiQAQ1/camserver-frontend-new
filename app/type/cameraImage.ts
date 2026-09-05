export interface CameraImage {
  imgId: string
  cameraId: string
  siteName: string // Use for identify cameras
  timestamp: string // capture instant as ISO-8601 UTC, e.g. "2026-09-05T05:35:12.123Z"
  bit: number
  gain: number
  exposure: number
  imgPath: string
  temperature: number
  humidity: number
  timeZone: string // IANA zone of the site; timestamps are displayed in it
}
