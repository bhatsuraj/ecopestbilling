/**
 * Firebase Authentication Helper Utilities
 * 
 * Provides better error handling, retry logic, and user-friendly error messages
 * for Firebase authentication operations.
 */

/**
 * Parse Firebase error codes into user-friendly messages
 * @param {Error} error - Firebase error object
 * @returns {string} - User-friendly error message
 */
export function getFirebaseErrorMessage(error) {
  const errorCode = error?.code || '';
  const errorMessage = error?.message || 'An unknown error occurred';

  // Map Firebase error codes to user-friendly messages
  const errorMessages = {
    // Network errors
    'auth/network-request-failed': `Unable to connect to authentication service. This usually happens when:
    
    ⚠️ Your domain needs to be authorized in Firebase Console
    
    To fix this:
    1. Go to Firebase Console → Authentication → Settings → Authorized domains
    2. Add this domain: ${window.location.origin}
    3. Save and try again
    
    Other possible causes:
    • Check your internet connection
    • Disable VPN if active
    • Try a different browser
    
    If you're the admin, please add "${window.location.hostname}" to Firebase authorized domains.`,
    
    // Email link errors
    'auth/invalid-action-code': 'This sign-in link is invalid or has expired. Please request a new one.',
    'auth/expired-action-code': 'This sign-in link has expired. Please request a new one.',
    
    // Phone auth errors
    'auth/invalid-phone-number': 'Invalid phone number format. Please use E.164 format (e.g., +919876543210)',
    'auth/invalid-verification-code': 'Invalid OTP code. Please check and try again.',
    'auth/code-expired': 'This OTP has expired. Please request a new one.',
    'auth/missing-phone-number': 'Phone number is required for SMS authentication.',
    'auth/quota-exceeded': 'SMS quota exceeded. Please try again later or contact support.',
    'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please try again.',
    'auth/missing-verification-code': 'Please enter the verification code.',
    'auth/invalid-verification-id': 'Invalid verification session. Please request a new OTP.',
    
    // General auth errors
    'auth/user-not-found': 'No account found with this email. Please register first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Invalid email address format.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
    
    // Token errors
    'auth/invalid-credential': 'Invalid authentication credentials. Please try signing in again.',
    'auth/credential-already-in-use': 'This credential is already linked to another account.',
    
    // Default
    'default': 'Authentication failed. Please try again or contact support.',
  };

  return errorMessages[errorCode] || errorMessages.default + `\n\nError: ${errorMessage}`;
}

/**
 * Retry a Firebase operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise} - Result of the operation
 */
export async function retryFirebaseOperation(operation, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      const nonRetryableErrors = [
        'auth/invalid-email',
        'auth/invalid-phone-number',
        'auth/invalid-verification-code',
        'auth/user-disabled',
        'auth/operation-not-allowed',
      ];
      
      if (nonRetryableErrors.includes(error?.code)) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if the current domain is authorized for Firebase
 * @returns {boolean} - True if localhost or common Firebase domain
 */
export function isLikelyAuthorizedDomain() {
  const hostname = window.location.hostname;
  
  // Known authorized domains
  const authorizedPatterns = [
    'localhost',
    '127.0.0.1',
    '.firebaseapp.com',
    '.web.app',
    '.firebaseio.com',
  ];
  
  return authorizedPatterns.some(pattern => 
    hostname === pattern || hostname.endsWith(pattern)
  );
}

/**
 * Log current domain for Firebase authorization
 */
export function logAuthDomainInfo() {
  console.group('🔥 Firebase Authentication Domain Info');
  console.log('Current Origin:', window.location.origin);
  console.log('Hostname:', window.location.hostname);
  console.log('Likely Authorized:', isLikelyAuthorizedDomain() ? '✅' : '❌');
  console.log('\n📝 To authorize this domain:');
  console.log('1. Go to: https://console.firebase.google.com');
  console.log('2. Select your project');
  console.log('3. Navigate to: Authentication → Settings → Authorized domains');
  console.log('4. Click "Add domain" and enter:', window.location.hostname);
  console.groupEnd();
}

/**
 * Validate Firebase configuration
 * @param {Object} config - Firebase config object
 * @returns {Object} - Validation result
 */
export function validateFirebaseConfig(config) {
  const required = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];
  
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      message: `Missing Firebase config keys: ${missing.join(', ')}`,
    };
  }
  
  return { valid: true, message: 'Firebase config is valid' };
}

/**
 * Safe Firebase operation wrapper with better error handling
 * @param {Function} operation - Firebase operation to execute
 * @param {string} operationName - Name for logging
 * @returns {Promise} - Result or throws enhanced error
 */
export async function safeFirebaseOperation(operation, operationName = 'Firebase operation') {
  try {
    // Log domain info in development
    if (process.env.NODE_ENV === 'development') {
      logAuthDomainInfo();
    }
    
    const result = await retryFirebaseOperation(operation);
    return result;
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error);
    
    // Enhance error with user-friendly message
    const userMessage = getFirebaseErrorMessage(error);
    const enhancedError = new Error(userMessage);
    enhancedError.originalError = error;
    enhancedError.code = error.code;
    
    throw enhancedError;
  }
}

/**
 * Format phone number to E.164 if not already formatted
 * @param {string} phone - Phone number
 * @param {string} defaultCountryCode - Default country code
 * @returns {string} - E.164 formatted phone
 */
export function ensureE164Format(phone, defaultCountryCode = '+91') {
  if (!phone) return '';
  
  // Already E.164
  if (phone.startsWith('+')) {
    return phone.replace(/\s/g, ''); // Remove spaces
  }
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Add country code
  return defaultCountryCode + digits;
}
