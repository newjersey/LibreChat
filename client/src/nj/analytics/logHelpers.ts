import { logEvent } from '~/nj/analytics/logEvent';

// A place for our logging logic (to keep it separate from LibreChat files & minimize merge conflicts)

export function logCopyEvent(isCreatedByUser: boolean) {
  logEvent(isCreatedByUser ? 'copy_prompt_text' : 'copy_response_text');
}
