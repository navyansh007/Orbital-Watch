/**
 * Interpretation of NOAA's planetary K-index.
 *
 * Thresholds follow NOAA SWPC's published G-scale: Kp 5 = G1 through Kp 9 = G5.
 * Below Kp 5 there is no storm level, so we report the descriptive band only.
 */
export type GeomagneticTone = 'quiet' | 'unsettled' | 'minor' | 'strong' | 'severe';

export type GeomagneticLevel = {
  label: string;
  /** NOAA storm level (G1–G5), or null below storm threshold. */
  storm: string | null;
  tone: GeomagneticTone;
};

export function classifyKp(kp: number): GeomagneticLevel {
  if (kp >= 9) return { label: 'Extreme storm', storm: 'G5', tone: 'severe' };
  if (kp >= 8) return { label: 'Severe storm', storm: 'G4', tone: 'severe' };
  if (kp >= 7) return { label: 'Strong storm', storm: 'G3', tone: 'strong' };
  if (kp >= 6) return { label: 'Moderate storm', storm: 'G2', tone: 'strong' };
  if (kp >= 5) return { label: 'Minor storm', storm: 'G1', tone: 'minor' };
  if (kp >= 4) return { label: 'Active', storm: null, tone: 'unsettled' };
  if (kp >= 3) return { label: 'Unsettled', storm: null, tone: 'unsettled' };
  return { label: 'Quiet', storm: null, tone: 'quiet' };
}

/** Formats a Kp value the way NOAA reports it — integers plain, estimates to 2dp. */
export function formatKp(kp: number): string {
  return Number.isInteger(kp) ? kp.toFixed(0) : kp.toFixed(2);
}
