// Test script to verify backend is working
// Run with: node server/test.js

import axios from 'axios';

const SERVER_URL = 'http://localhost:3001';

async function testServer() {
  console.log('🧪 Testing Yale Rooms Backend Server\n');

  // Test 1: Health check
  console.log('1. Testing health endpoint...');
  try {
    const response = await axios.get(`${SERVER_URL}/api/health`);
    console.log('✅ Health check passed:', response.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    console.log('   Make sure the server is running: npm run server');
    return;
  }

  // Test 2: Rooms endpoint (will fail without auth, but checks if endpoint exists)
  console.log('\n2. Testing rooms endpoint...');
  try {
    const response = await axios.get(`${SERVER_URL}/api/rooms/TEST123`);
    console.log('✅ Rooms endpoint response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log(`⚠️  Got response with status ${error.response.status}`);
      console.log('   This is expected without 25Live authentication');
      console.log('   Error:', error.response.data);
    } else {
      console.log('❌ Request failed:', error.message);
    }
  }

  console.log('\n📝 Next steps:');
  console.log('   1. Make sure you are logged into Yale 25Live in your browser');
  console.log('   2. Update the .env file with correct 25Live API URLs');
  console.log('   3. Use the frontend to test with actual authentication cookies');
  console.log('\n   Run: npm run dev:all');
}

testServer();
