export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastRan = 0;
  let timeoutId: any;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    clearTimeout(timeoutId);
    if (now - lastRan >= limit) {
      fn(...args);
      lastRan = now;
    } else {
      timeoutId = setTimeout(
        () => {
          fn(...args);
          lastRan = Date.now();
        },
        limit - (now - lastRan),
      );
    }
  };
}
