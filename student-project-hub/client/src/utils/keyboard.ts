/** True when a key event comes from somewhere the user types (so shortcuts stay out of the way). */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') !== null
  );
}
