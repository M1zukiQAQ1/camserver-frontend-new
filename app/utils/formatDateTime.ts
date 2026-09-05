// Capture times arrive from the API as ISO-8601 UTC instants ("2026-09-05T05:35:12.123Z") and are
// shown in the site's own zone (the IANA name on the image row). A fixed locale and an explicit
// zone keep server-rendered and client-rendered markup identical whatever zone the viewer is in.
const FALLBACK_ZONE = 'UTC'

// One cached Intl formatter per zone for a given option set; an unknown zone name falls back to UTC.
export function createZoneFormatter(options: Intl.DateTimeFormatOptions) {
  const cache = new Map<string, Intl.DateTimeFormat>()

  return (timeZone?: string | null) => {
    const zone = timeZone?.trim() || FALLBACK_ZONE
    let formatter = cache.get(zone)

    if (!formatter) {
      try {
        formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: zone })
      } catch {
        formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: FALLBACK_ZONE })
      }
      cache.set(zone, formatter)
    }

    return formatter
  }
}

const dateTimeFormatter = createZoneFormatter({
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short'
})

const dateFormatter = createZoneFormatter({
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})

// "Sep 4, 2026, 10:35 PM PDT"
export function formatDateTime(value: string | Date | null | undefined, timeZone?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : dateTimeFormatter(timeZone).format(date)
}

// "Sep 4, 2026"
export function formatDate(value: string | Date | null | undefined, timeZone?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter(timeZone).format(date)
}
