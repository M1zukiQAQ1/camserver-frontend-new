export interface CameraImage {
    imgId: string
    cameraId: string
    timestamp: Date
    bit: number
    gain: number
    exposure: number
    imgPath: string
    temperature: number
    humidity: number
    timeZone: string
}