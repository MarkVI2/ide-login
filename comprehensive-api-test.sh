#!/bin/bash
# comprehensive-api-test.sh
# Comprehensive test suite for the Moodle authentication API

echo "=========================================================="
echo "Comprehensive Moodle Authentication API Test Suite"
echo "=========================================================="
echo

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
DEBUG_TOKEN="${DEBUG_TOKEN:-debug123}"
VERBOSE="${VERBOSE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_section() {
    echo
    echo "=========================================="
    print_status $BLUE "$1"
    echo "=========================================="
}

# Function to test API endpoint with detailed validation
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    local validation_field=$6
    local expected_value=$7
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "[$TOTAL_TESTS] Testing: $description... "
    
    # Build curl command
    local curl_cmd="curl -s -w \"%{http_code}\" -X $method"
    
    if [ "$method" = "POST" ]; then
        curl_cmd="$curl_cmd -H \"Content-Type: application/json\" -d '$data'"
    fi
    
    if [ "$endpoint" = "/api/troubleshoot" ]; then
        curl_cmd="$curl_cmd -H \"Authorization: Bearer $DEBUG_TOKEN\""
    fi
    
    curl_cmd="$curl_cmd \"$BASE_URL$endpoint\""
    
    # Execute request
    response=$(eval $curl_cmd)
    
    # Extract HTTP status code (last 3 characters)
    http_code="${response: -3}"
    response_body="${response%???}"
    
    # Validate HTTP status
    if [ "$http_code" = "$expected_status" ]; then
        # Additional validation if specified
        if [ -n "$validation_field" ] && [ -n "$expected_value" ]; then
            if echo "$response_body" | jq -r ".$validation_field" | grep -q "$expected_value"; then
                print_status $GREEN "✓ PASS (HTTP $http_code)"
                PASSED_TESTS=$((PASSED_TESTS + 1))
            else
                print_status $RED "✗ FAIL (HTTP $http_code, validation failed)"
                FAILED_TESTS=$((FAILED_TESTS + 1))
                if [ "$VERBOSE" = "true" ]; then
                    echo "   Expected: $validation_field = $expected_value"
                    echo "   Response: $response_body" | jq .
                fi
            fi
        else
            print_status $GREEN "✓ PASS (HTTP $http_code)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        fi
        
        # Show response details in verbose mode
        if [ "$VERBOSE" = "true" ]; then
            echo "   Response: $response_body" | jq .
        fi
    else
        print_status $RED "✗ FAIL (Expected HTTP $expected_status, got $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        if [ "$VERBOSE" = "true" ]; then
            echo "   Response: $response_body"
        fi
    fi
}

# Function to test timing/performance
test_performance() {
    local endpoint=$1
    local description=$2
    local max_time=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "[$TOTAL_TESTS] Performance: $description... "
    
    start_time=$(date +%s%N)
    response=$(curl -s "$BASE_URL$endpoint")
    end_time=$(date +%s%N)
    
    duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $duration -le $max_time ]; then
        print_status $GREEN "✓ PASS (${duration}ms)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_status $RED "✗ FAIL (${duration}ms > ${max_time}ms)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to check server availability
check_server() {
    echo -n "Checking server availability at $BASE_URL... "
    if curl -s --max-time 10 "$BASE_URL/api/test" > /dev/null; then
        print_status $GREEN "✓ Server is running"
        return 0
    else
        print_status $RED "✗ Server is not accessible"
        echo "Please ensure the server is running on $BASE_URL"
        exit 1
    fi
}

# Start tests
print_status $CYAN "Starting comprehensive API test suite..."
print_status $CYAN "Server: $BASE_URL"
print_status $CYAN "Debug Token: $DEBUG_TOKEN"
print_status $CYAN "Verbose: $VERBOSE"
echo

# Check server availability
check_server

print_section "1. Basic Health and Status Tests"

test_endpoint "GET" "/api/test" "" "200" "Server basic functionality" "success" "true"
test_endpoint "GET" "/api/health" "" "200" "Health check endpoint" "status" "healthy"
test_endpoint "GET" "/api/diagnostics" "" "200" "Diagnostics endpoint" "success" "true"
test_endpoint "GET" "/api/troubleshoot" "" "200" "Troubleshoot endpoint (with auth)" "timestamp" "202"

print_section "2. Performance Tests"

test_performance "/api/test" "Basic endpoint response time" 500
test_performance "/api/health" "Health check response time" 1000
test_performance "/api/diagnostics" "Diagnostics response time" 2000

print_section "3. Authentication Validation Tests"

# Missing request body
test_endpoint "POST" "/api/moodle-login" "" "400" "Missing request body" "error" "MISSING_BODY"

# Missing username
test_endpoint "POST" "/api/moodle-login" '{"password":"test"}' "400" "Missing username" "error" "MISSING_CREDENTIALS"

# Missing password
test_endpoint "POST" "/api/moodle-login" '{"username":"test"}' "400" "Missing password" "error" "MISSING_CREDENTIALS"

# Empty username
test_endpoint "POST" "/api/moodle-login" '{"username":"","password":"test"}' "400" "Empty username" "error" "MISSING_CREDENTIALS"

# Invalid username format (too long)
long_username=$(printf 'a%.0s' {1..101})
test_endpoint "POST" "/api/moodle-login" "{\"username\":\"$long_username\",\"password\":\"test\"}" "400" "Username too long" "error" "INVALID_USERNAME"

print_section "4. Authentication Logic Tests"

# Admin login (if configured)
test_endpoint "POST" "/api/moodle-login" '{"username":"admin","password":"muadmin2025"}' "200" "Admin login with default credentials" "isAdmin" "true"

# Invalid admin password
test_endpoint "POST" "/api/moodle-login" '{"username":"admin","password":"wrongpassword"}' "401" "Admin login with wrong password" "success" "false"

# Non-existent user
test_endpoint "POST" "/api/moodle-login" '{"username":"nonexistent_user_12345","password":"anypassword"}' "401" "Non-existent user login" "error" "USER_NOT_FOUND"

print_section "5. Database Connection Tests"

# These tests will show the current database status
test_endpoint "GET" "/api/health" "" "200" "Database connection status in health check" "" ""

print_section "6. Security Tests"

# SQL injection attempt
test_endpoint "POST" "/api/moodle-login" '{"username":"admin'\'' OR 1=1 --","password":"test"}' "401" "SQL injection attempt in username" "success" "false"

# XSS attempt
test_endpoint "POST" "/api/moodle-login" '{"username":"<script>alert(1)</script>","password":"test"}' "401" "XSS attempt in username" "success" "false"

# Very long password
long_password=$(printf 'a%.0s' {1..1000})
test_endpoint "POST" "/api/moodle-login" "{\"username\":\"test\",\"password\":\"$long_password\"}" "401" "Very long password" "success" "false"

print_section "7. Error Handling Tests"

# Test with malformed JSON
echo -n "[$((TOTAL_TESTS + 1))] Testing: Malformed JSON handling... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"username":"test","password":}' "$BASE_URL/api/moodle-login")
http_code="${response: -3}"
if [ "$http_code" = "400" ]; then
    print_status $GREEN "✓ PASS (HTTP $http_code)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_status $RED "✗ FAIL (Expected HTTP 400, got $http_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

print_section "8. CORS and Headers Tests"

# OPTIONS request (preflight)
echo -n "[$((TOTAL_TESTS + 1))] Testing: CORS preflight request... "
TOTAL_TESTS=$((TOTAL_TESTS + 1))
response=$(curl -s -w "%{http_code}" -X OPTIONS -H "Origin: https://code.euclid-mu.in" "$BASE_URL/api/moodle-login")
http_code="${response: -3}"
if [ "$http_code" = "200" ]; then
    print_status $GREEN "✓ PASS (HTTP $http_code)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_status $RED "✗ FAIL (Expected HTTP 200, got $http_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

print_section "9. Moodle-Specific Tests (if database available)"

# Test with potential Moodle test users (these will fail if no test data exists)
test_endpoint "POST" "/api/moodle-login" '{"username":"testuser1","password":"password123"}' "401" "Test user 1 (bcrypt format)" "" ""
test_endpoint "POST" "/api/moodle-login" '{"username":"testuser2","password":"password123"}' "401" "Test user 2 (MD5 crypt format)" "" ""
test_endpoint "POST" "/api/moodle-login" '{"username":"testuser3","password":"hello"}' "401" "Test user 3 (legacy MD5 format)" "" ""

print_section "10. Load Testing (Basic)"

echo "Running basic load test (10 concurrent requests)..."
for i in {1..10}; do
    curl -s "$BASE_URL/api/test" > /dev/null &
done
wait
print_status $GREEN "✓ Load test completed"

# Final Results
echo
echo "=========================================================="
print_status $CYAN "TEST RESULTS SUMMARY"
echo "=========================================================="
print_status $BLUE "Total Tests: $TOTAL_TESTS"
print_status $GREEN "Passed: $PASSED_TESTS"
print_status $RED "Failed: $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    print_status $GREEN "🎉 ALL TESTS PASSED!"
    echo
    print_status $GREEN "Your Moodle authentication API is working correctly!"
    print_status $YELLOW "Next steps:"
    echo "  1. Set up your Moodle database with test users"
    echo "  2. Configure your .env file with correct database credentials"
    echo "  3. Test with real Moodle users"
    echo "  4. Deploy to production environment"
else
    print_status $RED "❌ SOME TESTS FAILED"
    echo
    print_status $YELLOW "Troubleshooting:"
    echo "  1. Check server logs for detailed error messages"
    echo "  2. Verify database connection configuration"
    echo "  3. Run diagnostics: curl $BASE_URL/api/diagnostics"
    echo "  4. Run troubleshoot: curl -H 'Authorization: Bearer $DEBUG_TOKEN' $BASE_URL/api/troubleshoot"
fi

echo
print_status $CYAN "Test completed at $(date)"

# Set exit code based on test results
if [ $FAILED_TESTS -eq 0 ]; then
    exit 0
else
    exit 1
fi
