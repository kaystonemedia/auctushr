// Test script to verify extension sync functionality
// This can be run in the browser console to test the sync

async function testExtensionSync() {
  console.log('🧪 Testing Extension Sync Functionality...');
  
  try {
    // Test 1: Check if extension is loaded
    console.log('1️⃣ Checking extension availability...');
    if (!chrome || !chrome.runtime) {
      throw new Error('Chrome extension API not available');
    }
    console.log('✅ Extension API available');

    // Test 2: Check storage for auth tokens
    console.log('2️⃣ Checking authentication...');
    const { authToken, userId } = await chrome.storage.local.get(['authToken', 'userId']);
    
    if (!authToken || !userId) {
      console.warn('⚠️ Missing authentication - set up required');
      console.log('To set up auth, run: chrome.storage.local.set({authToken: "your-token", userId: "your-user-id"})');
      return false;
    }
    console.log('✅ Authentication found');

    // Test 3: Test API endpoints
    console.log('3️⃣ Testing API connectivity...');
    
    // Test sync endpoint
    const syncResponse = await fetch('https://kaystonehr.com/api/attendance/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        session: {
          startTime: new Date().toISOString(),
          activities: [{
            type: 'test',
            timestamp: new Date().toISOString(),
            data: 'Extension sync test'
          }],
          activeTime: 0,
          idleTime: 0,
          isCheckOut: false
        },
        userId: userId
      })
    });

    if (syncResponse.ok) {
      console.log('✅ Sync endpoint working');
    } else {
      console.error('❌ Sync endpoint failed:', syncResponse.status, syncResponse.statusText);
    }

    // Test notifications endpoint
    const notificationResponse = await fetch('https://kaystonehr.com/api/notifications/productivity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        type: 'test',
        data: { message: 'Extension test notification' },
        timestamp: new Date().toISOString()
      })
    });

    if (notificationResponse.ok) {
      console.log('✅ Notifications endpoint working');
    } else {
      console.error('❌ Notifications endpoint failed:', notificationResponse.status, notificationResponse.statusText);
    }

    // Test 4: Check extension background script communication
    console.log('4️⃣ Testing background script communication...');
    try {
      const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      console.log('✅ Background script communication working');
      console.log('Extension status:', status);
    } catch (error) {
      console.error('❌ Background script communication failed:', error);
    }

    console.log('🎉 Sync functionality test completed!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Helper function to set up test authentication
function setupTestAuth(authToken, userId) {
  return chrome.storage.local.set({ authToken, userId });
}

// Run test
console.log('Run testExtensionSync() to test the extension sync functionality');
console.log('If you need to set up auth: setupTestAuth("your-auth-token", "your-user-id")'); 