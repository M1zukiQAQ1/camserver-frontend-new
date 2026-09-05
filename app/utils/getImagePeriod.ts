import { createZoneFormatter } from '~/utils/formatDateTime'

export type ImagePeriod = 'Night' | 'Day' | 'Dawn' | 'Dusk'

const hourFormatter = createZoneFormatter({ hour: 'numeric', hourCycle: 'h23' })

// Hour of the day (0-23) at the site, i.e. in the image's own time zone.
const localHour = (date: Date, timeZone?: string | null) => {
  const part = hourFormatter(timeZone).formatToParts(date).find(item => item.type === 'hour')
  const hour = part ? Number.parseInt(part.value, 10) : Number.NaN
  return Number.isNaN(hour) ? date.getUTCHours() : hour % 24
}

// Same hour bands as the backend's period filter: dawn 05-07, day 07-18, dusk 18-20, else night.
export const getImagePeriod = (timestamp: string | Date, timeZone?: string | null): ImagePeriod => {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return 'Night'
  }

  const hour = localHour(date, timeZone)

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
