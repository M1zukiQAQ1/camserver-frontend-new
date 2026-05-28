export type ImagePeriod = 'Night' | 'Day' | 'Dawn' | 'Dusk'

export const getImagePeriod = (timestamp: string | Date): ImagePeriod => {
  const date = new Date(timestamp)
  const hour = date.getHours()

  if (Number.isNaN(date.getTime())) {
    return 'Night'
  }

  if (hour >= 5 && hour < 7) {
    return 'Dawn'
  }

  if (hour >= 7 && hour < 18) {
    return 'Day'
  }

  if (hour >= 18 && hour < 20) {
    return 'Dusk'
  }

  return 'Night'
}
