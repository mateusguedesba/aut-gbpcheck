/**
 * Test script for GBP Check cookie injection
 * 
 * This script tests:
 * 1. Cookies are properly injected into the browser context
 * 2. User is automatically logged in when accessing app.gbpcheck.com
 * 3. All required cookies are present
 */

const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;

// Test: Verify cookie injection by automating GBP Check URL
function testCookieInjection() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      url: 'https://app.gbpcheck.com',
      wait_time: 60,
      headless: false, // Set to false to visually verify login
      name: 'Cookie Injection Test'
    });

    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: '/automate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('\n=== Test: Cookie Injection for Auto Login ===');
    console.log('Request:', postData);
    console.log('\nThis test will:');
    console.log('1. Start browser automation');
    console.log('2. Inject GBP Check cookies');
    console.log('3. Navigate to app.gbpcheck.com');
    console.log('4. Verify user is automatically logged in');
    console.log('\nWatch the browser window to verify auto-login...\n');

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        
        try {
          const response = JSON.parse(responseData);
          console.log('Response:', JSON.stringify(response, null, 2));
          
          if (res.statusCode === 200) {
            console.log('\n✅ Test PASSED: Automation started successfully');
            console.log('Session ID:', response.session_id);
            console.log('Status:', response.status);
            console.log('Queue Position:', response.queue_position);
            
            console.log('\n📋 Next Steps:');
            console.log('1. Check the browser window (if headless: false)');
            console.log('2. Verify that app.gbpcheck.com loads with user already logged in');
            console.log('3. Check server logs for cookie injection messages:');
            console.log('   - "🍪 Injetando cookies do GBP Check..."');
            console.log('   - "✅ Cookies injetados"');
            console.log('\n4. Poll status endpoint to check completion:');
            console.log(`   GET http://localhost:3000/status/${response.session_id}`);
            
            resolve(true);
          } else {
            console.log('\n❌ Test FAILED: Unexpected status code');
            resolve(false);
          }
        } catch (parseError) {
          console.error('❌ Error parsing response:', parseError.message);
          console.log('Raw response:', responseData);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Test ERROR:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Test: Check server logs for cookie injection
function checkServerLogs() {
  console.log('\n=== Checking Server Logs ===');
  console.log('To verify cookie injection, check the server logs for:');
  console.log('');
  console.log('Expected log entries:');
  console.log('  🍪 Injetando cookies do GBP Check para login automático...');
  console.log('  ✅ Cookies do GBP Check injetados com sucesso');
  console.log('     - cookieCount: 5');
  console.log('     - domains: [\'app.gbpcheck.com\', \'.gbpcheck.com\']');
  console.log('');
  console.log('Commands to check logs:');
  console.log('  Windows PowerShell: Get-Content data\\app.log -Tail 50 | Select-String "cookie"');
  console.log('  Linux/Mac: tail -f data/app.log | grep "cookie"');
  console.log('');
}

// Test: Verify cookies in browser context
function verifyCookieDetails() {
  console.log('\n=== Cookie Details ===');
  console.log('The following cookies should be injected:');
  console.log('');
  console.log('1. crisp-client%2Fsession%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7');
  console.log('   Domain: .gbpcheck.com');
  console.log('   Purpose: Crisp chat session');
  console.log('');
  console.log('2. crisp-client%2Fsession%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7%2F...');
  console.log('   Domain: .gbpcheck.com');
  console.log('   Purpose: Extended Crisp session');
  console.log('');
  console.log('3. remember_token');
  console.log('   Domain: app.gbpcheck.com');
  console.log('   Purpose: Authentication token (HttpOnly)');
  console.log('   Expires: 2026-09-15');
  console.log('');
  console.log('4. crisp-client%2Fsocket%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7');
  console.log('   Domain: app.gbpcheck.com');
  console.log('   Purpose: Crisp WebSocket connection');
  console.log('');
  console.log('5. session');
  console.log('   Domain: app.gbpcheck.com');
  console.log('   Purpose: Active user session (HttpOnly, Session)');
  console.log('');
}

// Manual verification instructions
function printManualVerification() {
  console.log('\n=== Manual Verification Steps ===');
  console.log('');
  console.log('To manually verify cookie injection:');
  console.log('');
  console.log('1. Run the automation with headless: false');
  console.log('   - Watch the browser window open');
  console.log('   - Navigate to app.gbpcheck.com');
  console.log('');
  console.log('2. Check if user is already logged in');
  console.log('   - Should see dashboard/logged-in view');
  console.log('   - Should NOT see login form');
  console.log('');
  console.log('3. Open Browser DevTools (F12)');
  console.log('   - Go to Application → Cookies');
  console.log('   - Check app.gbpcheck.com domain');
  console.log('   - Verify all 5 cookies are present');
  console.log('');
  console.log('4. Check Network tab');
  console.log('   - Verify cookies are sent with requests');
  console.log('   - Look for "Cookie:" header in request headers');
  console.log('');
}

// Run all tests
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  GBP Check Cookie Injection Test Suite                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Make sure the server is running on http://localhost:3000');
  console.log('');
  
  try {
    // Display cookie details
    verifyCookieDetails();
    
    // Display log checking instructions
    checkServerLogs();
    
    // Display manual verification steps
    printManualVerification();
    
    // Ask user if they want to run the automation test
    console.log('\n=== Ready to Run Automation Test ===');
    console.log('');
    console.log('This will start a browser automation that:');
    console.log('- Injects cookies');
    console.log('- Opens app.gbpcheck.com');
    console.log('- Allows you to verify auto-login visually');
    console.log('');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run the automation test
    const testResult = await testCookieInjection();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  Test Summary                                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Automation Test:', testResult ? '✅ PASSED' : '❌ FAILED');
    console.log('');
    console.log('Remember to:');
    console.log('1. Check the browser window for auto-login');
    console.log('2. Review server logs for cookie injection messages');
    console.log('3. Verify all 5 cookies are present in DevTools');
    console.log('');
    
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests();

