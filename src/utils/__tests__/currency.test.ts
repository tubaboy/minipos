import { describe, it, expect } from '@jest/globals';
import { formatCurrency, calculateCartTotal } from '@/utils/currency';

describe('currency utils', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      expect(formatCurrency(10)).toBe('$10.00');
      expect(formatCurrency(10.5)).toBe('$10.50');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format negative numbers correctly', () => {
      expect(formatCurrency(-5.5)).toBe('-$5.50');
    });
  });

  describe('calculateCartTotal', () => {
    it('should calculate total for empty cart', () => {
      expect(calculateCartTotal([])).toBe(0);
    });

    it('should calculate total for single item', () => {
      expect(calculateCartTotal([{ price: 10, quantity: 2 }])).toBe(20);
    });

    it('should calculate total for multiple items', () => {
      expect(
        calculateCartTotal([
          { price: 10, quantity: 2 },
          { price: 5, quantity: 3 },
        ])
      ).toBe(35);
    });
  });
});
