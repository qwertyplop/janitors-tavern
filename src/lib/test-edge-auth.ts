/**
 * Test file to verify Edge Runtime compatibility of auth functions
 * This file can be used to test that the refactored auth functions work correctly
 * in Edge Runtime environments.
 */

import { getAuthSettings, saveAuthSettings, setupAuth, updateJanitorApiKey, clearAuth } from './auth';

/**
 * Test Edge Runtime compatibility of auth functions
 */
export async function testEdgeAuth() {
  console.log('Testing Edge Runtime compatibility of auth functions...');

  try {
    // Test 1: Get auth settings
    console.log('Test 1: Getting auth settings...');
    const authSettings = await getAuthSettings();
    console.log('✅ getAuthSettings works in Edge Runtime:', authSettings);

    // Test 2: Save auth settings
    console.log('Test 2: Saving auth settings...');
    const testSettings = {
      isAuthenticated: true,
      username: 'test-user',
      janitorApiKey: 'test-api-key'
    };
    await saveAuthSettings(testSettings);
    console.log('✅ saveAuthSettings works in Edge Runtime');

    // Test 3: Verify the settings were saved
    console.log('Test 3: Verifying saved settings...');
    const updatedSettings = await getAuthSettings();
    console.log('✅ Settings saved and retrieved successfully:', updatedSettings);

    // Test 4: Update API key
    console.log('Test 4: Updating API key...');
    const newApiKey = await updateJanitorApiKey();
    console.log('✅ updateJanitorApiKey works in Edge Runtime, new key:', newApiKey);

    // Test 5: Clear auth
    console.log('Test 5: Clearing auth...');
    await clearAuth();
    const clearedSettings = await getAuthSettings();
    console.log('✅ clearAuth works in Edge Runtime:', clearedSettings);

    // Test 6: Setup auth
    console.log('Test 6: Setting up auth...');
    await setupAuth('test-user', 'test-password');
    const setupSettings = await getAuthSettings();
    console.log('✅ setupAuth works in Edge Runtime:', setupSettings);

    console.log('🎉 All Edge Runtime compatibility tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Edge Runtime compatibility test failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  testEdgeAuth().catch(console.error);
}