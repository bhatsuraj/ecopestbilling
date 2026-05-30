// Shared password strength rule:
//   • Minimum 8 characters
//   • At least one letter (a-z or A-Z)
//   • At least one digit (0-9)
//   • At least one special character from @!#$%^&*()
export const PASSWORD_SPECIALS = '@!#$%^&*()';
export const PASSWORD_RULE_TEXT =
  'Password must be at least 8 characters and include letters, numbers, and a special character (e.g. @ ! #).';

// eslint-disable-next-line no-useless-escape
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@!#$%^&*()]).{8,}$/;

export function isStrongPassword(value) {
  return PASSWORD_RE.test(value || '');
}
