/**
 * Footprint geometry: how much of the Earth's surface a satellite can see.
 *
 * This is pure spherical geometry — the satellite's horizon. For a satellite at
 * altitude `h` above a sphere of radius `R`, the great-circle angle from the
 * sub-satellite point to the horizon is
 *
 *     lambda = acos(R / (R + h))
 *
 * which is the half-angle of the visible cap. Requiring a minimum elevation
 * `e` above the local horizon (as a ham operator or ground station would)
 * shrinks it to
 *
 *     lambda = acos( (R / (R + h)) * cos(e) ) - e
 *
 * Coverage is reported as a surface radius, `R * lambda`, because that is the
 * number that makes sense drawn on a globe.
 */

/** Mean Earth radius, in kilometres (IUGG mean radius). */
export const EARTH_RADIUS_KM = 6371.0088;

/**
 * Great-circle half-angle of the coverage cap, in radians.
 *
 * @param altitudeKm     Satellite height above the surface.
 * @param minElevationDeg Minimum elevation above the local horizon for the
 *                        satellite to count as visible. 0 gives the true
 *                        geometric horizon.
 */
export function coverageHalfAngleRad(altitudeKm: number, minElevationDeg = 0): number {
  if (!(altitudeKm > 0)) return 0;

  const elevationRad = degToRad(minElevationDeg);
  const ratio = (EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm)) * Math.cos(elevationRad);

  // Above ~90 deg elevation nothing is visible; clamp for numerical safety.
  return Math.max(0, Math.acos(Math.min(1, Math.max(-1, ratio))) - elevationRad);
}

/**
 * Radius of the footprint measured along the Earth's surface, in kilometres.
 * This is the radius to hand to Cesium for the footprint ellipse.
 */
export function footprintRadiusKm(altitudeKm: number, minElevationDeg = 0): number {
  return EARTH_RADIUS_KM * coverageHalfAngleRad(altitudeKm, minElevationDeg);
}

/** Area of the visible spherical cap, in square kilometres. */
export function footprintAreaKm2(altitudeKm: number, minElevationDeg = 0): number {
  const halfAngle = coverageHalfAngleRad(altitudeKm, minElevationDeg);
  return 2 * Math.PI * EARTH_RADIUS_KM ** 2 * (1 - Math.cos(halfAngle));
}

/** Share of the Earth's surface inside the footprint, 0–1. */
export function footprintCoverageFraction(altitudeKm: number, minElevationDeg = 0): number {
  return footprintAreaKm2(altitudeKm, minElevationDeg) / (4 * Math.PI * EARTH_RADIUS_KM ** 2);
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
