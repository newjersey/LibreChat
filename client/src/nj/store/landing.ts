import { atomWithLocalStorage } from '~/store/utils';

/** Whether the extra info collapsible is open on the landing page */
export const landingHelpOpen = atomWithLocalStorage('landingHelpOpen', false);
