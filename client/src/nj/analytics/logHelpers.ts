import { logEvent } from '~/nj/analytics/logEvent';
import { ErrorTypes, TMessage } from 'librechat-data-provider';

// A place for our logging logic (to keep it separate from LibreChat files & minimize merge conflicts)

export function logCopyEvent(isCreatedByUser: boolean) {
  logEvent(isCreatedByUser ? 'copy_prompt_text' : 'copy_response_text');
}

export function logSubmitPrompt(message: TMessage, hasError: boolean) {
  const eventName = hasError ? 'submit_prompt_server_error' : 'submit_prompt_success';

  const extraParameters = {
    input_length: message.text.length,
    object_type: message.files?.map((file) => file.type) ?? '',

    // Note that files often don't have this data unless the user is resubmitting... should fix
    // this problem somehow eventually.
    object_length: message.files?.map((file) => file['text']?.length) ?? '',
    object_size: message.files?.map((file) => file.bytes) ?? '',
  };

  logEvent(eventName, extraParameters);
}

export function logIfPromptLengthError(error: object) {
  if (error['type'] !== ErrorTypes.INPUT_LENGTH) {
    return;
  }

  // Parse the input length out of the error info, if we can
  const extraParameters = {};
  const info: string = error['info'];
  if (info) {
    const parsed_length = parseInt(info.split(' / ')[0]);
    if (!isNaN(parsed_length)) {
      extraParameters['input_length'] = parsed_length;
    }
  }

  logEvent('submit_prompt_client_error_prompt_length', extraParameters);
}
