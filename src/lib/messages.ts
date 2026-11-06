// Messages a sync leaves on the Semsync page that the page shows differently from problems.

const ADDING = 'Adding ';

/**
 * A big first sync goes in over two runs, so Google isn't sent hundreds of changes at once. This says what's still to
 * come and when, calmly: it isn't a problem, and the next run (within 20 minutes) finishes it by itself.
 */
export function addingMessage(remaining: number): string {
  return remaining === 1
    ? `${ADDING}one more event to your calendar. It'll be there within 20 minutes.`
    : `${ADDING}the last ${remaining} events to your calendar. They'll be there within 20 minutes.`;
}

/** Whether a sync message is only the "still adding" note, which the page shows as progress, not a warning. */
export const isAddingMessage = (message: string | null | undefined) =>
  !!message && message.startsWith(ADDING) && message.endsWith('within 20 minutes.') && !message.includes('. A');
