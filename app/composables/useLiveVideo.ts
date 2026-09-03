import type { MaybeRefOrGetter } from 'vue'

export type LiveVideoPlayerState
  = 'idle' | 'unsupported' | 'connecting' | 'buffering' | 'playing' | 'offline' | 'paused' | 'error'

type MediaSourceConstructor = {
  new (): MediaSource
  isTypeSupported: (type: string) => boolean
}

type Connection = {
  abort: AbortController
  mediaSource?: MediaSource
  sourceBuffer?: SourceBuffer
  objectUrl?: string
  pending: Uint8Array[]
  pendingBytes: number
}

/** Seek to the live edge when playback falls further behind the newest data than this. */
const LIVE_LAG_LIMIT_SECONDS = 2.5
/** Stay this far behind the newest data so playback does not stall on every fragment. */
const LIVE_EDGE_OFFSET_SECONDS = 0.4
/** Buffered video older than this (behind the playhead) is trimmed to keep memory flat. */
const KEEP_BEHIND_SECONDS = 20
const OFFLINE_RETRY_MS = 3000
const MAX_RETRY_MS = 10000
const DEFAULT_CODECS = 'avc1.64001F'

/**
 * Plays the seeing-monitor live video: one long HTTP response of fragmented MP4 that is fed into
 * a Media Source Extensions SourceBuffer as it arrives. Reconnects when the camera drops out,
 * keeps playback near the live edge, and pauses while the tab is hidden.
 */
export const useLiveVideo = (streamUrl: MaybeRefOrGetter<string>) => {
  const video = ref<HTMLVideoElement | null>(null)
  const state = ref<LiveVideoPlayerState>('idle')
  const message = ref('')
  const codecs = ref('')
  const bytesReceived = ref(0)
  const playerLagSeconds = ref<number | null>(null)
  const retryInSeconds = ref<number | null>(null)

  let connection: Connection | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let countdownTimer: ReturnType<typeof setInterval> | undefined
  let failures = 0
  let listenersAttached = false

  const mediaSourceCtor = (): MediaSourceConstructor | null => {
    if (typeof window === 'undefined') {
      return null
    }
    const w = window as Window & {
      ManagedMediaSource?: MediaSourceConstructor
      MediaSource?: MediaSourceConstructor
    }
    return w.ManagedMediaSource ?? w.MediaSource ?? null
  }

  const cancelRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = undefined
    }
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = undefined
    }
    retryInSeconds.value = null
  }

  const scheduleRetry = (delayMs: number) => {
    cancelRetry()
    retryInSeconds.value = Math.ceil(delayMs / 1000)
    countdownTimer = setInterval(() => {
      if (retryInSeconds.value !== null && retryInSeconds.value > 0) {
        retryInSeconds.value -= 1
      }
    }, 1000)
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      connect()
    }, delayMs)
  }

  const closeConnection = () => {
    const current = connection
    connection = null
    if (current) {
      current.abort.abort()
      current.pending = []
      current.pendingBytes = 0
      if (current.mediaSource && current.mediaSource.readyState === 'open') {
        try {
          current.mediaSource.endOfStream()
        } catch {
          // The source may already be closing; nothing to clean up.
        }
      }
      if (current.objectUrl) {
        URL.revokeObjectURL(current.objectUrl)
      }
    }
    const el = video.value
    if (el) {
      el.pause()
      el.removeAttribute('src')
      el.srcObject = null
      el.load()
    }
    playerLagSeconds.value = null
  }

  const setOffline = (text: string) => {
    state.value = 'offline'
    message.value = text
  }

  const setError = (text: string) => {
    failures += 1
    state.value = 'error'
    message.value = text
  }

  const retryDelayAfterError = () => Math.min(MAX_RETRY_MS, 1000 * 2 ** Math.min(failures - 1, 4))

  const attach = (el: HTMLVideoElement, mediaSource: MediaSource, current: Connection) =>
    new Promise<void>((resolve) => {
      const onOpen = () => {
        mediaSource.removeEventListener('sourceopen', onOpen)
        resolve()
      }
      mediaSource.addEventListener('sourceopen', onOpen)
      const managed = 'ManagedMediaSource' in window
        && mediaSource instanceof (window as Window & { ManagedMediaSource: MediaSourceConstructor }).ManagedMediaSource
      if (managed) {
        el.disableRemotePlayback = true
        el.srcObject = mediaSource
      } else {
        current.objectUrl = URL.createObjectURL(mediaSource)
        el.src = current.objectUrl
      }
    })

  const keepUpWithLive = (current: Connection) => {
    const el = video.value
    if (!el || current !== connection || el.seeking) {
      return
    }
    const buffered = el.buffered
    if (!buffered.length) {
      return
    }
    const last = buffered.length - 1
    const start = buffered.start(last)
    const end = buffered.end(last)
    const lag = end - el.currentTime
    playerLagSeconds.value = Math.round(lag * 100) / 100
    if (el.currentTime < start || el.currentTime > end || lag > LIVE_LAG_LIMIT_SECONDS) {
      el.currentTime = Math.max(start, end - LIVE_EDGE_OFFSET_SECONDS)
    }
    if (el.paused) {
      el.play().catch(() => {
        // Autoplay can be refused before the first user gesture; the next fragment retries.
      })
    }
  }

  const trim = (current: Connection, force = false) => {
    const el = video.value
    const sourceBuffer = current.sourceBuffer
    if (!el || !sourceBuffer || sourceBuffer.updating || current.mediaSource?.readyState !== 'open') {
      return
    }
    const buffered = sourceBuffer.buffered
    if (!buffered.length) {
      return
    }
    const start = buffered.start(0)
    const cutoff = el.currentTime - KEEP_BEHIND_SECONDS
    if (cutoff - start > 5 || (force && cutoff > start)) {
      try {
        sourceBuffer.remove(start, cutoff)
      } catch {
        // Removing is best effort; a failed trim only costs memory.
      }
    }
  }

  const flush = (current: Connection) => {
    const sourceBuffer = current.sourceBuffer
    if (!sourceBuffer || sourceBuffer.updating || current.pending.length === 0
      || current.mediaSource?.readyState !== 'open') {
      return
    }
    const merged = new Uint8Array(current.pendingBytes)
    let offset = 0
    for (const chunk of current.pending) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    try {
      sourceBuffer.appendBuffer(merged)
      current.pending = []
      current.pendingBytes = 0
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        trim(current, true)
        return
      }
      setError('The browser rejected the video data.')
      closeConnection()
      scheduleRetry(retryDelayAfterError())
    }
  }

  const enqueue = (current: Connection, chunk: Uint8Array) => {
    current.pending.push(chunk)
    current.pendingBytes += chunk.byteLength
    flush(current)
  }

  const attachElementListeners = (el: HTMLVideoElement) => {
    if (listenersAttached) {
      return
    }
    listenersAttached = true
    el.addEventListener('playing', () => {
      if (connection) {
        state.value = 'playing'
        message.value = ''
      }
    })
    el.addEventListener('waiting', () => {
      if (connection && state.value === 'playing') {
        state.value = 'buffering'
      }
    })
    el.addEventListener('error', () => {
      if (!connection) {
        return
      }
      const detail = el.error?.message ? ` (${el.error.message})` : ''
      setError(`Playback failed${detail}.`)
      closeConnection()
      scheduleRetry(retryDelayAfterError())
    })
  }

  const connect = async () => {
    const el = video.value
    const ctor = mediaSourceCtor()
    if (!el || !ctor) {
      return
    }
    cancelRetry()
    closeConnection()

    const current: Connection = {
      abort: new AbortController(),
      pending: [],
      pendingBytes: 0
    }
    connection = current
    state.value = 'connecting'
    message.value = ''

    try {
      const response = await fetch(toValue(streamUrl), {
        signal: current.abort.signal,
        cache: 'no-store',
        headers: { Accept: 'video/mp4' }
      })
      if (current !== connection) {
        return
      }
      if (response.status === 503) {
        let text = 'No camera is streaming right now.'
        try {
          const body = await response.json() as { message?: string }
          text = body.message || text
        } catch {
          // Keep the default message.
        }
        failures = 0
        connection = null
        setOffline(text)
        scheduleRetry(OFFLINE_RETRY_MS)
        return
      }
      if (!response.ok || !response.body) {
        connection = null
        setError(`The stream request failed (HTTP ${response.status}).`)
        scheduleRetry(retryDelayAfterError())
        return
      }

      const codecString = response.headers.get('x-live-codecs') || DEFAULT_CODECS
      const mimeType = `video/mp4; codecs="${codecString}"`
      codecs.value = codecString
      if (!ctor.isTypeSupported(mimeType)) {
        current.abort.abort()
        connection = null
        state.value = 'unsupported'
        message.value = `This browser cannot decode ${codecString} video.`
        return
      }

      const mediaSource = new ctor()
      current.mediaSource = mediaSource
      await attach(el, mediaSource, current)
      if (current !== connection) {
        return
      }
      const sourceBuffer = mediaSource.addSourceBuffer(mimeType)
      sourceBuffer.mode = 'segments'
      sourceBuffer.addEventListener('updateend', () => {
        if (current !== connection) {
          return
        }
        flush(current)
        keepUpWithLive(current)
        trim(current)
      })
      sourceBuffer.addEventListener('error', () => {
        if (current !== connection) {
          return
        }
        setError('The browser could not parse the video stream.')
        closeConnection()
        scheduleRetry(retryDelayAfterError())
      })
      current.sourceBuffer = sourceBuffer
      state.value = 'buffering'
      failures = 0

      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (current !== connection) {
          return
        }
        if (done) {
          break
        }
        if (value) {
          bytesReceived.value += value.byteLength
          enqueue(current, value)
        }
      }
      // A clean end means the camera host disconnected; wait for it to come back.
      closeConnection()
      setOffline('The camera stopped streaming.')
      scheduleRetry(OFFLINE_RETRY_MS)
    } catch (error) {
      if (current !== connection || current.abort.signal.aborted) {
        return
      }
      closeConnection()
      setError(error instanceof Error ? error.message : 'The stream connection failed.')
      scheduleRetry(retryDelayAfterError())
    }
  }

  const start = () => {
    const el = video.value
    if (!el) {
      return
    }
    if (!mediaSourceCtor()) {
      state.value = 'unsupported'
      message.value = 'This browser does not support Media Source Extensions.'
      return
    }
    attachElementListeners(el)
    failures = 0
    bytesReceived.value = 0
    connect()
  }

  const stop = () => {
    cancelRetry()
    closeConnection()
    state.value = 'idle'
    message.value = ''
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (state.value !== 'idle' && state.value !== 'unsupported') {
        cancelRetry()
        closeConnection()
        state.value = 'paused'
        message.value = 'Paused while this tab is in the background.'
      }
    } else if (state.value === 'paused') {
      start()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    start()
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    stop()
  })

  return {
    video,
    state,
    message,
    codecs,
    bytesReceived,
    playerLagSeconds,
    retryInSeconds,
    start,
    stop,
    restart: start
  }
}
