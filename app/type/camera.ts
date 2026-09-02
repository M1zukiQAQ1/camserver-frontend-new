// Shape of /api/sites as served by the backend (Jackson lower-cases the UID getter).
export interface Camera {
  uid: number
  cameraId: string | null
  siteName: string
  timeZone: string | null
  longitude: number | null
  latitude: number | null
}
