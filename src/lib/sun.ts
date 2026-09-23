/**
 * Where the Sun is directly overhead right now.
 *
 * Used to frame the globe on load: with real lighting enabled, pointing the
 * camera anywhere else can open the app on the night side, which reads as a
 * broken black sphere rather than an Earth.
 */
import { degreesLat, degreesLong, gstime, jday, sunPos } from 'satellite.js';

export type SubsolarPoint = {
  latitudeDeg: number;
  longitudeDeg: number;
};

export function subsolarPoint(at: Date): SubsolarPoint {
  const julianDay = jday(
    at.getUTCFullYear(),
    at.getUTCMonth() + 1,
    at.getUTCDate(),
    at.getUTCHours(),
    at.getUTCMinutes(),
    at.getUTCSeconds(),
  );

  const { rtasc, decl } = sunPos(julianDay);

  // Right ascension is measured against the stars; subtracting Greenwich
  // sidereal time rotates it into Earth-fixed longitude.
  const hourAngle = rtasc - gstime(at);

  return {
    latitudeDeg: degreesLat(decl),
    // atan2 of the sine/cosine wraps the angle back into [-pi, pi].
    longitudeDeg: degreesLong(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle))),
  };
}
