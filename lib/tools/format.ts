export function formatDurationHms(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatDurationMs(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatMinutesLabel(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

export function computeProductivityScore(activeMs: number, totalMs: number, clientWorkMs = 0) {
  if (totalMs <= 0) return 0
  const numerator = activeMs + clientWorkMs
  return Math.min(100, Math.round((numerator / totalMs) * 100))
}

// Same formula as calculateSessionScores in electron/main.js; keep the two in sync.
export function computeFocusLevel(activeMs: number, totalMs: number) {
  if (totalMs <= 0) return 0
  const activeRatio = activeMs / totalMs
  const activeMinutes = activeMs / 60000

  let focus = 0
  if (activeRatio >= 0.95) focus += 50
  else if (activeRatio >= 0.9) focus += 40
  else if (activeRatio >= 0.8) focus += 30
  else if (activeRatio >= 0.7) focus += 20
  else if (activeRatio >= 0.6) focus += 10

  if (activeMinutes >= 60) focus += 30
  else if (activeMinutes >= 30) focus += 20
  else if (activeMinutes >= 15) focus += 10

  if (totalMs >= 3600000) focus += 20
  else if (totalMs >= 1800000) focus += 10

  return Math.min(100, focus)
}
