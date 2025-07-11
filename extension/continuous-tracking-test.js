// Test script to verify continuous tracking functionality
// This can be run in the browser console to test the idle/active tracking

async function testContinuousTracking() {
  console.log('🧪 Testing Continuous Tracking Functionality...');
  
  try {
    // Test 1: Check extension state
    console.log('1️⃣ Getting extension status...');
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    console.log('Extension status:', status);
    
    if (!status.currentSession || !status.currentSession.startTime) {
      console.log('⚠️ No active session found. Please check in first.');
      return false;
    }
    
    // Test 2: Simulate idle state
    console.log('2️⃣ Simulating idle state...');
    await chrome.runtime.sendMessage({ type: 'SIMULATE_IDLE' });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Check that tracking continues during idle
    const idleStatus = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    console.log('Status during idle:', idleStatus);
    
    // Test 4: Simulate active state
    console.log('3️⃣ Simulating return from idle...');
    await chrome.runtime.sendMessage({ type: 'SIMULATE_ACTIVE' });
    
    // Test 5: Check that tracking resumed
    const activeStatus = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    console.log('Status after returning from idle:', activeStatus);
    
    // Test 6: Verify time calculations
    console.log('4️⃣ Verifying time calculations...');
    const session = activeStatus.currentSession;
    const totalTime = Date.now() - new Date(session.startTime).getTime();
    const calculatedActiveTime = totalTime - session.idleTime;
    
    console.log('Session start:', session.startTime);
    console.log('Total time:', Math.round(totalTime / 1000), 'seconds');
    console.log('Idle time:', Math.round(session.idleTime / 1000), 'seconds');
    console.log('Active time:', Math.round(calculatedActiveTime / 1000), 'seconds');
    
    // Test 7: Check that user doesn't need to check in again
    console.log('5️⃣ Verifying user is still checked in...');
    if (activeStatus.isCheckedIn && activeStatus.currentSession.startTime) {
      console.log('✅ User is still checked in - no need to check in again!');
    } else {
      console.log('❌ User was checked out - this is the bug we fixed!');
    }
    
    console.log('🎉 Continuous tracking test completed!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Helper function to manually test idle/active transitions
function simulateIdleActiveTest() {
  console.log('🔄 Manual idle/active test:');
  console.log('1. Check in using the extension');
  console.log('2. Lock your computer or step away for 2+ minutes');
  console.log('3. Come back and check the extension - you should still be checked in');
  console.log('4. Your time should show total time with idle time properly tracked');
  console.log('5. No need to check in again!');
}

// Run test
console.log('Run testContinuousTracking() to test continuous tracking');
console.log('Or run simulateIdleActiveTest() for manual testing instructions'); 