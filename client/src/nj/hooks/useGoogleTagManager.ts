import { useEffect } from 'react';
import TagManager from 'react-gtm-module';
import type { TStartupConfig } from 'librechat-data-provider';

/**
 * Enables GTM (if provided).
 *
 * Extracted from useAppStartup (for pages where we only need GTM, not all the other stuff).
 */
export default function useGoogleTagManager({ startupConfig }: { startupConfig?: TStartupConfig }) {
  useEffect(() => {
    if (startupConfig?.analyticsGtmId != null && typeof window.google_tag_manager === 'undefined') {
      const tagManagerArgs = {
        gtmId: startupConfig.analyticsGtmId,
      };
      TagManager.initialize(tagManagerArgs);
    }
  }, [startupConfig?.analyticsGtmId]);
}
