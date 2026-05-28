export interface CameraImage {
  imgId: string
  cameraId: string
  siteName: string // Use for identify cameras
  timestamp: string
  bit: number
  gain: number
  exposure: number
  imgPath: string
  temperature: number
  humidity: number
  timeZone: string
}
