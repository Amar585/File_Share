/**
 * Utilities for working with email verification links
 */

/**
 * Creates a direct login link that can be included in emails as a backup
 * in case the Supabase verification link doesn't work.
 * 
 * @param {string} baseUrl - The base URL of the application (e.g., http://localhost:3000)
 * @param {string} email - The user's email address
 * @returns {string} A direct link to the login page with verified=true parameter
 */
export function createDirectLoginLink(baseUrl, email) {
  // Remove trailing slash if present
  const normalizedBaseUrl = baseUrl.endsWith('/')
    ? baseUrl.slice(0, -1) 
    : baseUrl;
  
  // Create URL with parameters to open login modal
  const url = new URL('/', normalizedBaseUrl);
  url.searchParams.set('verified', 'true');
  
  if (email) {
    url.searchParams.set('email', email);
  }
  
  return url.toString();
}

/**
 * Transforms a Supabase verification link to include our custom parameters.
 * This ensures the link will work even if the middleware fails.
 * 
 * @param {string} supabaseLink - The original Supabase verification link
 * @param {string} email - The user's email address
 * @returns {string} The enhanced link that's more likely to work
 */
export function enhanceVerificationLink(supabaseLink, email) {
  try {
    const url = new URL(supabaseLink);
    const redirectTo = url.searchParams.get('redirect_to');
    
    if (redirectTo) {
      // Decode the redirect_to URL and add our parameters
      const decodedRedirectUrl = decodeURIComponent(redirectTo);
      const redirectUrl = new URL(decodedRedirectUrl);
      
      // Add type=signup to ensure it's recognized as a signup verification
      redirectUrl.searchParams.set('type', 'signup');
      
      if (email) {
        redirectUrl.searchParams.set('email', email);
      }
      
      // Update the redirect_to parameter
      url.searchParams.set('redirect_to', redirectUrl.toString());
      
      return url.toString();
    }
    
    return supabaseLink;
  } catch (error) {
    console.error('Error enhancing verification link:', error);
    return supabaseLink;
  }
} 