export function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmedLowercased = value.trim().toLowerCase();
  if (!trimmedLowercased) {
    return false;
  }
  if (trimmedLowercased.length > 254) {
    return false;
  }
  // Deliberately permissive regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(trimmedLowercased);
}
