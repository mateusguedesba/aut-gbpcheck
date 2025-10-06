/**
 * Test script for the new "name" field in POST /automate endpoint
 * 
 * This script tests:
 * 1. Sending a request with a valid name field
 * 2. Sending a request without a name field (should work with null)
 * 3. Sending a request with an invalid name field (should return 400 error)
 */

const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;

// Test 1: Valid name field
function testValidName() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      url: 'https://www.google.com/search?q=test',
      wait_time: 60,
      headless: true,
      name: 'John Doe'
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

    console.log('\n=== Test 1: Valid name field ===');
    console.log('Request:', postData);

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', responseData);
        
        if (res.statusCode === 200) {
          console.log('✅ Test 1 PASSED: Request accepted with valid name');
          resolve(true);
        } else {
          console.log('❌ Test 1 FAILED: Unexpected status code');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Test 1 ERROR:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Test 2: No name field (should work with null)
function testNoName() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      url: 'https://www.google.com/search?q=test',
      wait_time: 60,
      headless: true
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

    console.log('\n=== Test 2: No name field ===');
    console.log('Request:', postData);

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', responseData);
        
        if (res.statusCode === 200) {
          console.log('✅ Test 2 PASSED: Request accepted without name field');
          resolve(true);
        } else {
          console.log('❌ Test 2 FAILED: Unexpected status code');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Test 2 ERROR:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Test 3: Invalid name field (should return 400)
function testInvalidName() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      url: 'https://www.google.com/search?q=test',
      wait_time: 60,
      headless: true,
      name: 12345  // Invalid: should be string
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

    console.log('\n=== Test 3: Invalid name field (number instead of string) ===');
    console.log('Request:', postData);

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response:', responseData);
        
        if (res.statusCode === 400) {
          console.log('✅ Test 3 PASSED: Invalid name field correctly rejected');
          resolve(true);
        } else {
          console.log('❌ Test 3 FAILED: Expected 400 status code');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Test 3 ERROR:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run all tests
async function runTests() {
  console.log('Starting tests for "name" field in POST /automate endpoint...');
  console.log('Make sure the server is running on http://localhost:3000');
  
  try {
    const test1Result = await testValidName();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between tests
    
    const test2Result = await testNoName();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between tests
    
    const test3Result = await testInvalidName();
    
    console.log('\n=== Test Summary ===');
    console.log('Test 1 (Valid name):', test1Result ? '✅ PASSED' : '❌ FAILED');
    console.log('Test 2 (No name):', test2Result ? '✅ PASSED' : '❌ FAILED');
    console.log('Test 3 (Invalid name):', test3Result ? '✅ PASSED' : '❌ FAILED');
    
    const allPassed = test1Result && test2Result && test3Result;
    console.log('\nOverall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests();

