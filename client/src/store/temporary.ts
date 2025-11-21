import { atomWithLocalStorage } from '~/store/utils';

// NJ: We are forcing all chats to be temporary, so default to `true` (and we disable toggling)
const isTemporary = atomWithLocalStorage('isTemporary', true);

export default {
  isTemporary,
};
