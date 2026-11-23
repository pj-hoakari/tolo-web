// @vitest-environment jsdom

import { beforeEach, expect, it } from "vitest";
import {
  clearMeasurementRecords,
  markMeasurementsSent,
  readMeasurementRecords,
  recordMeasurements,
} from "./measurementRecords";
import type { WindowMeasurement } from "./measurements";

beforeEach(() => localStorage.clear());

const measurement: WindowMeasurement = {
  observationPointId: "entrance",
  windowStart: new Date("2026-11-16T00:00:00Z"),
  windowEnd: new Date("2026-11-16T00:00:30Z"),
  countIn: 3,
  countOut: 1,
};
const owner = (storageScope: string) => ({
  eventId: "event",
  edgeDeviceId: "device",
  storageScope,
});
const names = new Map([["entrance", "Entry"]]);

it("keeps another account's observations hidden without deleting them", () => {
  recordMeasurements(owner("alice"), [measurement], names);
  expect(readMeasurementRecords(owner("bob"))).toEqual([]);
  expect(readMeasurementRecords(owner("alice"))).toHaveLength(1);
  recordMeasurements(owner("bob"), [measurement], names);
  clearMeasurementRecords(owner("bob"));
  expect(readMeasurementRecords(owner("bob"))).toEqual([]);
  expect(readMeasurementRecords(owner("alice"))).toHaveLength(1);
});

it("marks a server acknowledgement only in the sender's account", () => {
  recordMeasurements(owner("alice"), [measurement], names);
  recordMeasurements(owner("bob"), [measurement], names);
  markMeasurementsSent(owner("alice"), [measurement]);
  expect(readMeasurementRecords(owner("alice"))[0].sent).toBe(true);
  expect(readMeasurementRecords(owner("bob"))[0].sent).toBe(false);
});

it("does not migrate observations whose legacy owner is unknown", () => {
  const legacyKey = "tolo:observation-measurements:event:device";
  const legacyRecords = JSON.stringify([{ countIn: 7 }]);
  localStorage.setItem(legacyKey, legacyRecords);
  expect(readMeasurementRecords(owner("alice"))).toEqual([]);
  recordMeasurements(owner("alice"), [measurement], names);
  const scopedKey = `tolo:staff:alice:${legacyKey}`;
  expect(localStorage.getItem(scopedKey)).toBe(
    JSON.stringify(readMeasurementRecords(owner("alice"))),
  );
  clearMeasurementRecords(owner("alice"));
  expect(localStorage.getItem(legacyKey)).toBe(legacyRecords);
});
