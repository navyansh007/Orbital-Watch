/** Shared domain types for Orbital Watch. */

export type SatelliteId = 'iss' | 'goes';

export type SatelliteDefinition = {
  id: SatelliteId;
  /** Exact CelesTrak catalogue name, passed through to /api/tle. */
  celestrakName: string;
  /** Short label for the HUD. */
  label: string;
  orbitClass: 'LEO' | 'GEO';
  /** CSS colour used for this satellite's marker, trail and footprint. */
  color: string;
  blurb: string;
};

/** A propagated state vector, in the units the HUD displays. */
export type SatelliteState = {
  timestamp: Date;
  latitudeDeg: number;
  longitudeDeg: number;
  /** Height above the WGS-84 ellipsoid, in kilometres. */
  altitudeKm: number;
  /** Scalar speed, in kilometres per second. */
  velocityKmS: number;
};

/** A single overhead pass of a satellite as seen from a ground site. */
export type PassPrediction = {
  /** First moment the satellite clears the minimum elevation. */
  startsAt: Date;
  /** Moment of maximum elevation. */
  peaksAt: Date;
  endsAt: Date;
  maxElevationDeg: number;
};

export type GroundSite = {
  latitudeDeg: number;
  longitudeDeg: number;
  /** Height above the ellipsoid, in kilometres. */
  altitudeKm: number;
};

/** Normalised response from /api/spaceweather. */
export type SpaceWeather = {
  /** NOAA planetary K-index, 0–9. */
  kp: number;
  observedAt: string;
  source: string;
};
