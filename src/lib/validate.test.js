
import { isValidEmail } from './validate.js';

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('john.doe@sub.domain.co.uk')).toBe(true);
    expect(isValidEmail('another+tag@email.net')).toBe(true);
  });

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('invalid@')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@domain')).toBe(false);
    expect(isValidEmail('user@.com')).toBe(false);
    expect(isValidEmail('user@domain.')).toBe(false);
    expect(isValidEmail('user@domain.c')).toBe(false); // TLD must be at least 2 characters
  });

  it('should trim leading/trailing spaces', () => {
    expect(isValidEmail(' test@example.com ')).toBe(true);
    expect(isValidEmail('  another@domain.com')).toBe(true);
    expect(isValidEmail('last@domain.com   ')).toBe(true);
  });

  it('should handle mixed casing correctly', () => {
    expect(isValidEmail('TeSt@ExAmPlE.CoM')).toBe(true);
    expect(isValidEmail('uSeR@dOmAiN.nEt')).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('   ')).toBe(false);
  });

  it('should return false for emails longer than 254 characters', () => {
    const longEmail = 'a'.repeat(240) + '@example.com'; // 240 + 1 + 11 = 252 chars
    expect(isValidEmail(longEmail)).toBe(true);
    const veryLongEmail = 'a'.repeat(241) + '@example.com'; // 241 + 1 + 11 = 253 chars (trim, lowercased adds to length)
    expect(isValidEmail(veryLongEmail)).toBe(true);
    const superLongEmail = 'a'.repeat(242) + '@example.com'; // 242 + 1 + 11 = 254 chars (ok)
    expect(isValidEmail(superLongEmail)).toBe(true);
    const tooSuperLongEmail = 'a'.repeat(243) + '@example.com'; // 243 + 1 + 11 = 255 chars (too long)
    expect(isValidEmail(tooSuperLongEmail)).toBe(false);
  });

  it('should return false for non-string inputs', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail({})).toBe(false);
    expect(isValidEmail([])).toBe(false);
    expect(isValidEmail(true)).toBe(false);
  });
});
