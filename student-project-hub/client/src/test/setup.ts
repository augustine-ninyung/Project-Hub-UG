import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom lacks these browser APIs used by components.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
// Always stubbed: jsdom's own version only accepts jsdom Blobs, but under
// Vitest 4 test files are Node's File objects. Previews don't render here anyway.
URL.createObjectURL = () => 'blob:preview';
URL.revokeObjectURL = () => {};
