declare global {
  interface Window {
    dataLayer: Array<object>;
  }
}

export function logEvent(eventName: string) {
  if (window.dataLayer != null) {
    window.dataLayer.push({ event: eventName });
  } else {
    console.log('In production, the following event would be logged to Google Analytics:', {
      eventName,
    });
  }
}
