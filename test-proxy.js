// Test script to check if API proxy is working
const testAPI = async () => {
    try {
        console.log('Testing /api/proxy...');

        // Test 1: Get Versions
        const res = await fetch('http://localhost:3000/api/proxy?endpoint=/bibles&language_ranges[]=por');
        const data = await res.json();

        console.log('Response status:', res.status);
        console.log('Response data:', JSON.stringify(data, null, 2));

        if (data.error) {
            console.error('API Error:', data);
        } else {
            console.log('Success! Found', data.data?.length || 0, 'versions');
        }
    } catch (error) {
        console.error('Request failed:', error);
    }
};

testAPI();
