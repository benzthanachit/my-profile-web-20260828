declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

/**
 * Fires a GA4 event and tags the current Clarity session (so recordings can be
 * filtered by it later). Guards every call since ad blockers frequently block
 * gtag.js/clarity.js outright, leaving window.gtag/window.clarity undefined.
 */
export const trackEvent = (eventName: string, params?: Record<string, unknown>): void => {
  try {
    window.gtag?.('event', eventName, params);
  } catch (error) {
    console.error(`Failed to send GA4 event "${eventName}":`, error);
  }
  try {
    window.clarity?.('event', eventName);
  } catch (error) {
    console.error(`Failed to send Clarity event "${eventName}":`, error);
  }
};
