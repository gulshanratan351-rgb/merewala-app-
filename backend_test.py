#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class MonetizeStreamAPITester:
    def __init__(self, base_url="https://earn-track-pro-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.access_token = None
        self.user_data = None
        self.api_key = None
        self.test_video_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Exception: {str(e)}")
            return False, {}

    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n" + "="*50)
        print("🔐 TESTING AUTHENTICATION FLOW")
        print("="*50)

        # Test login with admin credentials
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@example.com", "password": "admin123"}
        )
        
        if success:
            self.user_data = response
            print(f"   Logged in as: {response.get('name')} ({response.get('email')})")
            print(f"   Role: {response.get('role')}")
        else:
            print("❌ Login failed - cannot continue with authenticated tests")
            return False

        # Test /auth/me endpoint
        success, me_data = self.run_test(
            "Get Current User",
            "GET", 
            "auth/me",
            200
        )

        if success:
            print(f"   User ID: {me_data.get('user_id')}")
            print(f"   Email: {me_data.get('email')}")

        # Test refresh token
        success, _ = self.run_test(
            "Refresh Token",
            "POST",
            "auth/refresh", 
            200
        )

        return True

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoints"""
        print("\n" + "="*50)
        print("📊 TESTING DASHBOARD STATS")
        print("="*50)

        # Test main stats
        success, stats = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "stats",
            200
        )

        if success:
            print(f"   Total Views: {stats.get('total_views', 0):,}")
            print(f"   Total Earnings: ${stats.get('total_earnings', 0):.2f}")
            print(f"   Referral Earnings: ${stats.get('referral_earnings', 0):.2f}")
            print(f"   Average CPM: ${stats.get('avg_cpm', 0):.2f}")

        # Test monthly stats
        success, monthly = self.run_test(
            "Get Monthly Stats",
            "GET",
            "stats/monthly?month=1&year=2025",
            200
        )

        if success:
            print(f"   Monthly data points: {len(monthly)}")

        # Test yearly stats  
        success, yearly = self.run_test(
            "Get Yearly Stats",
            "GET",
            "stats/yearly?year=2025",
            200
        )

        if success:
            print(f"   Yearly data points: {len(yearly)}")

        # Test NEW daily stats endpoint
        success, daily = self.run_test(
            "Get Daily Stats",
            "GET",
            "stats/daily?day=15&month=1&year=2025",
            200
        )

        if success:
            print(f"   Daily stats for Jan 15, 2025:")
            print(f"     Views: {daily.get('views', 0):,}")
            print(f"     Earnings: ${daily.get('earnings', 0):.2f}")
            print(f"     Date: {daily.get('day')}/{daily.get('month')}/{daily.get('year')}")

        # Test daily stats with no data (should return default)
        success, daily_empty = self.run_test(
            "Get Daily Stats (No Data)",
            "GET",
            "stats/daily?day=31&month=12&year=2024",
            200
        )

        if success:
            print(f"   Daily stats for Dec 31, 2024 (no data):")
            print(f"     Views: {daily_empty.get('views', 0)}")
            print(f"     Earnings: ${daily_empty.get('earnings', 0):.2f}")

    def test_links_crud(self):
        """Test links CRUD operations"""
        print("\n" + "="*50)
        print("🔗 TESTING LINKS MANAGEMENT")
        print("="*50)

        # Get existing links
        success, links = self.run_test(
            "Get All Links",
            "GET",
            "links",
            200
        )

        if success:
            print(f"   Found {len(links)} existing links")

        # Create a new link
        test_link_data = {
            "title": "Test Link Created by API Test",
            "original_url": "https://example.com/test-file.zip"
        }

        success, new_link = self.run_test(
            "Create New Link",
            "POST",
            "links",
            200,
            data=test_link_data
        )

        link_id = None
        if success:
            link_id = new_link.get('link_id')
            print(f"   Created link ID: {link_id}")
            print(f"   Short code: {new_link.get('short_code')}")

        # Test search functionality
        success, search_results = self.run_test(
            "Search Links",
            "GET",
            "links?search=Test",
            200
        )

        if success:
            print(f"   Search results: {len(search_results)} links")

        # Update the link if created successfully
        if link_id:
            update_data = {
                "title": "Updated Test Link",
                "original_url": "https://example.com/updated-file.zip"
            }
            
            success, updated_link = self.run_test(
                "Update Link",
                "PUT",
                f"links/{link_id}",
                200,
                data=update_data
            )

            if success:
                print(f"   Updated title: {updated_link.get('title')}")

            # Delete the test link
            success, _ = self.run_test(
                "Delete Link",
                "DELETE",
                f"links/{link_id}",
                200
            )

            if success:
                print(f"   Successfully deleted test link")

    def test_billing_system(self):
        """Test billing and withdrawal system"""
        print("\n" + "="*50)
        print("💰 TESTING BILLING SYSTEM")
        print("="*50)

        # Get current balance
        success, balance_data = self.run_test(
            "Get Current Balance",
            "GET",
            "billing/balance",
            200
        )

        if success:
            balance = balance_data.get('balance', 0)
            print(f"   Current balance: ${balance:.2f}")

        # Get withdrawal history
        success, withdrawals = self.run_test(
            "Get Withdrawal History",
            "GET",
            "billing/withdrawals",
            200
        )

        if success:
            print(f"   Withdrawal history: {len(withdrawals)} records")

        # Test withdrawal request (should fail due to insufficient balance or validation)
        withdrawal_data = {
            "method": "paypal",
            "amount": 5.00,  # Below minimum
            "details": {"paypal_email": "test@example.com"}
        }

        success, _ = self.run_test(
            "Test Withdrawal Request (Expected to Fail)",
            "POST",
            "billing/withdraw",
            400,  # Expecting 400 due to minimum amount
            data=withdrawal_data
        )

    def test_bot_api_system(self):
        """Test bot and API key management"""
        print("\n" + "="*50)
        print("🤖 TESTING BOT & API SYSTEM")
        print("="*50)

        # Get API key
        success, api_data = self.run_test(
            "Get API Key",
            "GET",
            "bot/api-key",
            200
        )

        original_key = None
        if success:
            original_key = api_data.get('api_key')
            print(f"   API Key: {original_key[:10]}...{original_key[-10:]}")

        # Regenerate API key
        success, new_api_data = self.run_test(
            "Regenerate API Key",
            "POST",
            "bot/regenerate-key",
            200
        )

        if success:
            new_key = new_api_data.get('api_key')
            print(f"   New API Key: {new_key[:10]}...{new_key[-10:]}")
            
            if original_key and new_key != original_key:
                print("   ✅ API key successfully regenerated")
            else:
                print("   ⚠️  API key may not have changed")

        # Test bot upload endpoint (placeholder)
        if new_key:
            upload_data = {
                "api_key": new_key,
                "file_url": "https://example.com/test-upload.zip",
                "title": "Test Bot Upload"
            }

            success, upload_result = self.run_test(
                "Test Bot Upload Endpoint",
                "POST",
                "bot/upload",
                200,
                data=upload_data
            )

            if success:
                print(f"   Upload result: {upload_result.get('short_link')}")

    def test_video_monetization_system(self):
        """Test video monetization APIs"""
        print("\n" + "="*50)
        print("📹 TESTING VIDEO MONETIZATION SYSTEM")
        print("="*50)

        # First get API key for testing
        if not self.api_key:
            success, response = self.run_test(
                "Get API Key for Video Tests",
                "GET",
                "bot/api-key",
                200
            )
            if success and 'api_key' in response:
                self.api_key = response['api_key']
                print(f"   📋 API Key obtained: {self.api_key[:20]}...")

        # Test 1: POST /api/generate-link with valid API key
        if self.api_key:
            test_data = {
                "api_key": self.api_key,
                "file_id": "test_file_12345",
                "file_name": "Test Video Monetization.mp4"
            }
            
            success, response = self.run_test(
                "Generate Video Link - Valid API Key",
                "POST",
                "generate-link",
                200,
                data=test_data
            )
            
            if success and 'video_id' in response:
                self.test_video_id = response['video_id']
                print(f"   📋 Generated video_id: {self.test_video_id}")
                print(f"   🔗 Generated link: {response.get('link', 'N/A')}")

        # Test 2: POST /api/generate-link with invalid API key
        invalid_data = {
            "api_key": "invalid_api_key_123",
            "file_id": "test_file_67890",
            "file_name": "Invalid Test Video.mp4"
        }
        
        self.run_test(
            "Generate Video Link - Invalid API Key",
            "POST",
            "generate-link",
            401,
            data=invalid_data
        )

        # Test 3: GET /api/video/{id} with existing video
        self.run_test(
            "Get Video Info - Existing Video",
            "GET",
            "video/9e803baff0",
            200
        )

        # Test 4: GET /api/video/{id} with our generated video
        if self.test_video_id:
            success, response = self.run_test(
                "Get Video Info - Generated Video",
                "GET",
                f"video/{self.test_video_id}",
                200
            )
            
            if success:
                required_fields = ['video_id', 'file_id', 'file_name', 'views']
                missing_fields = [field for field in required_fields if field not in response]
                if missing_fields:
                    print(f"   ❌ Missing required fields: {missing_fields}")
                else:
                    print(f"   ✅ All required fields present")

        # Test 5: GET /api/video/invalid_id returns 404
        self.run_test(
            "Get Video Info - Invalid ID",
            "GET",
            "video/invalid_video_id_123",
            404
        )

        # Test 6: POST /api/view with watch_duration < 20 (should NOT count)
        short_watch_data = {
            "video_id": "9e803baff0",
            "watch_duration": 15
        }
        
        success, response = self.run_test(
            "Record View - Short Watch Duration",
            "POST",
            "view",
            200,
            data=short_watch_data
        )
        
        if success:
            if response.get('counted') == False:
                print(f"   ✅ View correctly NOT counted for {short_watch_data['watch_duration']}s watch")
            else:
                print(f"   ❌ View should NOT be counted for short watch duration")

        # Test 7: POST /api/view with watch_duration >= 20 (should count and add $0.007)
        long_watch_data = {
            "video_id": "9e803baff0",
            "watch_duration": 25
        }
        
        success, response = self.run_test(
            "Record View - Long Watch Duration",
            "POST",
            "view",
            200,
            data=long_watch_data
        )
        
        if success:
            if response.get('counted') == True:
                print(f"   ✅ View correctly counted for {long_watch_data['watch_duration']}s watch")
                earned = response.get('earned_this_view', 0)
                if earned == 0.007:
                    print(f"   ✅ Correct earning amount: ${earned}")
                else:
                    print(f"   ❌ Incorrect earning amount: ${earned} (expected $0.007)")
            else:
                print(f"   ❌ View should be counted for long watch duration")

        # Test 8: GET /api/videos (authenticated) - list user's videos
        success, response = self.run_test(
            "Get Videos List - Authenticated",
            "GET",
            "videos",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   📋 Found {len(response)} videos in user's account")

        # Test 9: DELETE /api/videos/{id} (authenticated) - delete video
        if self.test_video_id:
            success, response = self.run_test(
                "Delete Video - Authenticated",
                "DELETE",
                f"videos/{self.test_video_id}",
                200
            )
            
            if success:
                print(f"   ✅ Successfully deleted test video {self.test_video_id}")

    def test_dashboard_stats_video_integration(self):
        """Test that dashboard stats include video views and earnings"""
        print("\n" + "="*50)
        print("📊 TESTING DASHBOARD STATS VIDEO INTEGRATION")
        print("="*50)

        success, response = self.run_test(
            "Dashboard Stats Include Video Data",
            "GET",
            "stats",
            200
        )
        
        if success:
            required_video_fields = ['video_views', 'video_earnings']
            missing_fields = [field for field in required_video_fields if field not in response]
            
            if missing_fields:
                print(f"   ❌ Missing video stats fields: {missing_fields}")
            else:
                print(f"   ✅ Dashboard includes video stats")
                print(f"   📊 Video views: {response.get('video_views', 0)}")
                print(f"   💰 Video earnings: ${response.get('video_earnings', 0)}")
                print(f"   📊 Total views: {response.get('total_views', 0)}")
                print(f"   💰 Total earnings: ${response.get('total_earnings', 0)}")

    def test_logout(self):
        """Test logout functionality"""
        print("\n" + "="*50)
        print("🚪 TESTING LOGOUT")
        print("="*50)

        success, _ = self.run_test(
            "Logout",
            "POST",
            "auth/logout",
            200
        )

        if success:
            print("   Successfully logged out")

        # Verify that protected endpoints now fail
        success, _ = self.run_test(
            "Access Protected Endpoint After Logout",
            "GET",
            "auth/me",
            401  # Should be unauthorized
        )

        if success:
            print("   ✅ Protected endpoints properly secured after logout")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Monetize Stream API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        try:
            # Test authentication first
            if not self.test_auth_flow():
                print("\n❌ Authentication failed - stopping tests")
                return 1

            # Run all other tests
            self.test_dashboard_stats()
            self.test_links_crud()
            self.test_billing_system()
            self.test_bot_api_system()
            
            # NEW: Test video monetization system
            self.test_video_monetization_system()
            self.test_dashboard_stats_video_integration()
            
            self.test_logout()

        except Exception as e:
            print(f"\n💥 Unexpected error during testing: {str(e)}")
            return 1

        # Print final results
        print("\n" + "="*60)
        print("📋 FINAL TEST RESULTS")
        print("="*60)
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {self.tests_run - self.tests_passed}")
        print(f"📊 Total tests: {self.tests_run}")
        print(f"🎯 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed - check logs above")
            return 1

def main():
    tester = MonetizeStreamAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())