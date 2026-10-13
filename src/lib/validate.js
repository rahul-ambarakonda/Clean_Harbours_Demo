
export function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) {
    return false;
  }
  // This regex is deliberately permissive.
  // We are not implementing RFC 5322.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(trimmed);
}
