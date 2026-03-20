import { atom, WritableAtom } from 'jotai';

/**
 * Returns a WritableAtom<T> that *always* returns the provided value (and throws away setter calls)
 *
 * Sometimes we want to disable togglable features (e.g. forcing temporary chat to always be on).
 * In those cases, the lowest possible lift is simply to disable the state changes altogether.
 */
export function constAtom<T>(value: T): WritableAtom<T, [T], void> {
  return atom(
    () => value,
    () => {}, // ignore all writes
  );
}
