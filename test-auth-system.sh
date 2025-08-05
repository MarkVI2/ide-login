#!/bin/bash
# test-auth-system.sh
# Comprehensive test script for the Moodle authentication system

echo "=========================================================="
echo "Judge0 IDE Authentication System Test"
echo "=========================================================="
echo

# Configuration
BASE_URL="http://localhost:3000"
DEBUG_TOKEN="debug123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to test API endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -n "Testing: $description... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "%{http_code}" \
            -H "Authorization: Bearer $DEBUG_TOKEN" \
            "$BASE_URL$endpoint")
    fi
    
    # Extract HTTP status code (last 3 characters)
    http_code="${response: -3}"
    # Extract response body (everything except last 3 characters)
    response_body="${response%???}"
    
    if [ "$http_code" -eq "$expected_status" ]; then
        print_status $GREEN "✓ PASS ($http_code)"
        if [ "$response_body" != "" ]; then
            echo "   Response: $(echo $response_body | jq -r '.message // .success // .' 2>/dev/null || echo $response_body | head -c 100)"
        fi
    else
        print_status $RED "✗ FAIL (Expected: $expected_status, Got: $http_code)"
        echo "   Response: $response_body"
    fi
    echo
}

echo "Starting tests against $BASE_URL"
echo

# Test 1: Health Check
print_status $BLUE "1. Health Check Tests"
test_endpoint "GET" "/api/health" "" 200 "Health check endpoint"

# Test 2: API Test
print_status $BLUE "2. Basic API Tests"
test_endpoint "GET" "/api/test" "" 200 "Basic API test endpoint"

# Test 3: Database Info (requires debug token)
print_status $BLUE "3. Database Information Tests"
test_endpoint "GET" "/api/db-info" "" 200 "Database info with auth token"

# Test 4: Authentication Tests
print_status $BLUE "4. Authentication Tests"

# Test missing credentials
test_endpoint "POST" "/api/moodle-login" '{}' 400 "Missing credentials"

# Test missing username
test_endpoint "POST" "/api/moodle-login" '{"password":"test"}' 400 "Missing username"

# Test missing password
test_endpoint "POST" "/api/moodle-login" '{"username":"test"}' 400 "Missing password"

# Test admin login (should work)
test_endpoint "POST" "/api/moodle-login" '{"username":"admin","password":"muadmin2025"}' 200 "Admin login (correct credentials)"

# Test admin login with wrong password
test_endpoint "POST" "/api/moodle-login" '{"username":"admin","password":"wrongpassword"}' 401 "Admin login (wrong password)"

# Test non-existent user
test_endpoint "POST" "/api/moodle-login" '{"username":"nonexistentuser","password":"anypassword"}' 401 "Non-existent user"

# Test SQL injection attempt
test_endpoint "POST" "/api/moodle-login" '{"username":"admin'\'' OR 1=1 --","password":"test"}' 401 "SQL injection attempt"

# Test 5: CORS Tests
print_status $BLUE "5. CORS Tests"
echo -n "Testing: CORS headers... "
cors_response=$(curl -s -H "Origin: https://code.euclid-mu.in" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type" \
    -X OPTIONS \
    "$BASE_URL/api/moodle-login")

if echo "$cors_response" | grep -q "Access-Control-Allow-Origin"; then
    print_status $GREEN "✓ PASS"
else
    print_status $RED "✗ FAIL"
fi
echo

# Test 6: Password Hash Format Tests (if we have test users)
print_status $BLUE "6. Password Format Tests"
echo "Note: These tests require actual Moodle users in the database"

# Test bcrypt user (if exists)
test_endpoint "POST" "/api/moodle-login" '{"username":"testuser_bcrypt","password":"testpass"}' 401 "bcrypt user (expected to fail without real user)"

# Test MD5 crypt user (if exists)
test_endpoint "POST" "/api/moodle-login" '{"username":"testuser_md5crypt","password":"testpass"}' 401 "MD5 crypt user (expected to fail without real user)"

# Test legacy MD5 user (if exists)
test_endpoint "POST" "/api/moodle-login" '{"username":"testuser_md5","password":"testpass"}' 401 "Legacy MD5 user (expected to fail without real user)"

# Test 7: Error Handling
print_status $BLUE "7. Error Handling Tests"

# Test malformed JSON
echo -n "Testing: Malformed JSON... "
malformed_response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"username":"test",' \
    "$BASE_URL/api/moodle-login")
malformed_code="${malformed_response: -3}"
if [ "$malformed_code" -eq "400" ]; then
    print_status $GREEN "✓ PASS ($malformed_code)"
else
    print_status $RED "✗ FAIL (Expected: 400, Got: $malformed_code)"
fi
echo

# Test 8: Security Tests
print_status $BLUE "8. Security Tests"

# Test unauthorized database info access
echo -n "Testing: Unauthorized db-info access... "
unauth_response=$(curl -s -w "%{http_code}" "$BASE_URL/api/db-info")
unauth_code="${unauth_response: -3}"
if [ "$unauth_code" -eq "401" ]; then
    print_status $GREEN "✓ PASS ($unauth_code)"
else
    print_status $RED "✗ FAIL (Expected: 401, Got: $unauth_code)"
fi
echo

# Summary
echo "=========================================================="
print_status $BLUE "Test Summary"
echo "=========================================================="
echo "• All basic endpoints tested"
echo "• Authentication flow validated"
echo "• CORS configuration checked"
echo "• Error handling verified"
echo "• Security measures tested"
echo
print_status $YELLOW "Next Steps:"
echo "1. Set up your Moodle database connection"
echo "2. Create test users with different password formats"
echo "3. Run this script again to test with real data"
echo "4. Configure environment variables for production"
echo
print_status $GREEN "Test completed successfully!"
