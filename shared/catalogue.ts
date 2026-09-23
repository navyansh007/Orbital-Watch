/**
 * The objects Orbital Watch tracks.
 *
 * Shared by the browser and the edge functions so the catalogue numbers have a
 * single source of truth.
 */
export type TrackedSatelliteId = 'iss' | 'goes';

export type TrackedSatellite = {
  id: TrackedSatelliteId;
  /**
   * NORAD catalogue number. Preferred over name lookups: it is the stable
   * identifier, whereas catalogue names get revised and a name query that
   * stops matching silently returns nothing.
   */
  catalogNumber: number;
  label: string;
};

export const TRACKED_SATELLITES: readonly TrackedSatellite[] = [
  { id: 'iss', catalogNumber: 25544, label: 'ISS (ZARYA)' },
  { id: 'goes', catalogNumber: 60133, label: 'GOES 19' },
];

/**
 * How long orbital elements are cached, in seconds.
 *
 * CelesTrak only checks its element files for updates every two hours, and most
 * objects are updated two or three times a day. Six hours is therefore well
 * inside the useful life of a TLE — SGP4 error grows on the order of a couple
 * of kilometres per day — while keeping us far below the download rate that
 * gets a client blocked.
 */
export const TLE_CACHE_SECONDS = 6 * 60 * 60;
