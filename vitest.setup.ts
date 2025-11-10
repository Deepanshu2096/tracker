import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock TextEncoder and TextDecoder for React Router
global.TextEncoder = class {
  encode(input: string) {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
} as any;

global.TextDecoder = class {
  decode(input: Uint8Array) {
    return Buffer.from(input).toString('utf8');
  }
} as any;

// Mock scrollIntoView for Radix UI components
Element.prototype.scrollIntoView = vi.fn();

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

