export function observationPath(eventId: string): string {
  return `/event/${eventId}/observation`;
}

export function observationDevicePath(
  eventId: string,
  edgeDeviceId: string,
): string {
  return `${observationPath(eventId)}/${edgeDeviceId}`;
}
