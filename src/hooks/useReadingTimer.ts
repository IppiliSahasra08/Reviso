'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CHECKPOINT_INTERVAL_MS = 60_000 // periodic write-through, caps data loss to <60s
const TICK_INTERVAL_MS = 1_000 // UI-facing elapsedSeconds tick

export interface UseReadingTimerResult {
  /** Live elapsed seconds for this document, ticking once per second while active. */
  elapsedSeconds: number
  /** True while the tab is visible and a session is running. */
  isActive: boolean
  /** Resumes timing (also called automatically on mount / tab becoming visible). */
  startSession: () => void
  /** Pauses timing and flushes the final duration to review_log. */
  endSession: () => void
}

/**
 * Tracks reading time for a document using the Page Visibility API: timing
 * runs only while the tab is actually visible, so backgrounded tabs don't
 * inflate review durations. Progress is checkpointed to a single
 * `review_log` row (created lazily on first start, then updated in place)
 * every 60s, on every visibility change, and on unmount — so a crash or
 * closed tab loses at most the last checkpoint interval, not the session.
 *
 * This hook's review_log rows are always written with review_completed:
 * false — they're passive telemetry. An explicit "mark as reviewed" action
 * should write its own completed review_log row (see mark_document_reviewed).
 */
export function useReadingTimer(documentId: string): UseReadingTimerResult {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isActive, setIsActive] = useState(false)

  const accumulatedSecondsRef = useRef(0) // seconds banked from completed segments
  const segmentStartRef = useRef<number | null>(null) // Date.now() of the current running segment
  const startedAtRef = useRef<string | null>(null) // ISO timestamp of the session's very first start

  const logRowIdRef = useRef<string | null>(null)
  const logRowPromiseRef = useRef<Promise<string | null> | null>(null)

  const currentTotalSeconds = useCallback(() => {
    const segmentSeconds = segmentStartRef.current
      ? Math.floor((Date.now() - segmentStartRef.current) / 1000)
      : 0
    return accumulatedSecondsRef.current + segmentSeconds
  }, [])

  // Lazily creates the review_log row for this session, memoized so
  // concurrent flushes don't race and insert duplicates.
  const getOrCreateLogRow = useCallback(async (): Promise<string | null> => {
    if (logRowIdRef.current) return logRowIdRef.current
    if (logRowPromiseRef.current) return logRowPromiseRef.current

    const supabase = createClient()

    logRowPromiseRef.current = (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      const startedAt = startedAtRef.current ?? new Date().toISOString()
      startedAtRef.current = startedAt

      const { data, error: insertError } = await supabase
        .from('review_log')
        .insert({
          user_id: user.id,
          document_id: documentId,
          started_at: startedAt,
          ended_at: startedAt,
          duration_seconds: 0,
          pages_read: 0,
          review_completed: false,
        })
        .select('id')
        .single()

      if (insertError || !data) return null
      logRowIdRef.current = data.id as string
      return logRowIdRef.current
    })()

    return logRowPromiseRef.current
  }, [documentId])

  // Writes the current total duration to the log row. Fire-and-forget by
  // design — a checkpoint that blocks on the network defeats the purpose
  // of protecting against an abrupt tab close.
  const flush = useCallback(() => {
    const totalSeconds = currentTotalSeconds()
    const supabase = createClient()

    void getOrCreateLogRow().then((rowId) => {
      if (!rowId) return
      void supabase
        .from('review_log')
        .update({ ended_at: new Date().toISOString(), duration_seconds: totalSeconds })
        .eq('id', rowId)
    })
  }, [currentTotalSeconds, getOrCreateLogRow])

  const startSession = useCallback(() => {
    if (segmentStartRef.current !== null) return // already running
    segmentStartRef.current = Date.now()
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString()
    setIsActive(true)
    void getOrCreateLogRow()
  }, [getOrCreateLogRow])

  const endSession = useCallback(() => {
    if (segmentStartRef.current === null) return // already paused
    accumulatedSecondsRef.current += Math.floor((Date.now() - segmentStartRef.current) / 1000)
    segmentStartRef.current = null
    setIsActive(false)
    setElapsedSeconds(accumulatedSecondsRef.current)
    flush()
  }, [flush])

  // Auto-start/pause with tab visibility, auto-start on mount if already visible.
  useEffect(() => {
    if (typeof document === 'undefined') return

    if (document.visibilityState === 'visible') startSession()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        startSession()
      } else {
        endSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      endSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  // 60s checkpoint while active, so long sessions don't lose more than a
  // minute of progress if the tab disappears without a clean unmount.
  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(flush, CHECKPOINT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isActive, flush])

  // 1s UI tick — display only, not persisted.
  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => setElapsedSeconds(currentTotalSeconds()), TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isActive, currentTotalSeconds])

  return { elapsedSeconds, isActive, startSession, endSession }
}