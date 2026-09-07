export const ITEM_STATUSES = ['AUTO_REJECTED', 'PENDING', 'IN_PROGRESS', 'DONE'] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/** Recordings of this length or shorter are not worth an annotator's time. */
export const MAX_AUTO_REJECT_SEC = 15

export function routeByDuration(
  durationSec: number,
): Extract<ItemStatus, 'AUTO_REJECTED' | 'PENDING'> {
  return durationSec > MAX_AUTO_REJECT_SEC ? 'PENDING' : 'AUTO_REJECTED'
}
