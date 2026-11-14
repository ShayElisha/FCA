import type { ContainerTrackingResult, TrackingError } from './types'

export type TrackResponse =
  | { ok: true; data: ContainerTrackingResult }
  | { ok: false; error: TrackingError }

/**
 * Demo tracker for the UI MVP.
 * Real MSC provider integration will replace this layer.
 */
export async function trackContainer(
  containerNumber: string,
): Promise<TrackResponse> {
  await delay(700)

  // Deterministic demo payload based on last digit
  const last = Number(containerNumber[containerNumber.length - 1])
  if (last === 0) {
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'מספר מכולה לא נמצא במערכת MSC, נא לוודא את הנתונים.',
      },
    }
  }

  const israelPort = last % 2 === 0 ? 'Ashdod' : 'Haifa'
  const etaDate = new Date()
  etaDate.setDate(etaDate.getDate() + 3 + (last % 5))
  etaDate.setHours(8, 0, 0, 0)

  return {
    ok: true,
    data: {
      containerNumber,
      status: last > 5 ? 'In Transit' : 'Discharged',
      currentLocation: last > 5 ? 'Mediterranean Sea' : israelPort,
      originPort: 'Genova',
      destinationPort: israelPort,
      israelPort,
      eta: etaDate.toISOString(),
      etaRaw: etaDate.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
      vesselName: 'MSC DEMO WAVE',
      voyageNumber: `IL${containerNumber.slice(-3)}R`,
      retrievedAt: new Date().toISOString(),
      demo: true,
    },
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
