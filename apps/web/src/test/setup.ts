import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};

afterEach(() => {
  cleanup();
});
