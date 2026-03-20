import { constAtom } from '~/nj/utils/constAtom';
import { act, renderHook } from '@testing-library/react';
import { useAtom } from 'jotai';

describe('constAtom', () => {
  test('returns value', () => {
    const atom = constAtom(5);
    const { result } = renderHook(() => useAtom(atom));
    expect(result.current[0]).toBe(5);
  });

  test('ignores setter', () => {
    const atom = constAtom('hello');
    const { result } = renderHook(() => useAtom(atom));
    act(() => result.current[1]('goodbye'));
    expect(result.current[0]).toBe('hello');
  });
});
