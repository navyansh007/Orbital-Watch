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
import type { GeoPoint } from './types';


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

/**
 * The footprint boundary as an explicit ring of points on the sphere.
 *
 * Renderers typically offer an "ellipse" primitive, but those are approximated
 * in a local tangent plane and degenerate once the radius is a large fraction
 * of the globe — a geostationary footprint spans some 81 degrees of arc and
 * collapses. Walking the boundary with the spherical destination-point formula
 * is exact at any radius.
 */
export function footprintRing(
  center: GeoPoint,
  altitudeKm: number,
  minElevationDeg = 0,
  segments = 180,
): GeoPoint[] {
  const halfAngle = coverageHalfAngleRad(altitudeKm, minElevationDeg);
  if (!(halfAngle > 0)) return [];

  const lat1 = degToRad(center.latitudeDeg);
  const lon1 = degToRad(center.longitudeDeg);
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinRadius = Math.sin(halfAngle);
  const cosRadius = Math.cos(halfAngle);

  const ring: GeoPoint[] = [];

  for (let i = 0; i < segments; i += 1) {
    const bearing = (2 * Math.PI * i) / segments;

    const lat2 = Math.asin(sinLat1 * cosRadius + cosLat1 * sinRadius * Math.cos(bearing));
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * sinRadius * cosLat1,
        cosRadius - sinLat1 * Math.sin(lat2),
      );

    ring.push({
      latitudeDeg: radToDeg(lat2),
      // Keep longitudes in [-180, 180] so consumers never see a wrapped value.
      longitudeDeg: radToDeg(Math.atan2(Math.sin(lon2), Math.cos(lon2))),
    });
  }

  return ring;
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}
