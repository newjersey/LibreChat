declare global {
  interface Window {
    dataLayer: Array<object>;
  }
}

/**
 * Logs an event with Google Tag Manager (GTM) if it's been initialized.
 */
export function logEvent(eventName: string, extraParameters: object = {}) {
  if (window.dataLayer) {
    window.dataLayer.push({ event: eventName, ...extraParameters });
  } else {
    console.log('In production, the following event would be logged to Google Analytics:', {
      eventName,
      extraParameters,
    });
  }
}
