#!/usr/bin/env python3
"""
Test script for the Business Card API
Usage: python test_api.py [base_url]
"""

import requests
import sys
import json

def test_health_check(base_url):
    """Test the health check endpoint"""
    try:
        response = requests.get(f"{base_url}/")
        print(f"Health Check: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_process_card(base_url):
    """Test the process card endpoint with sample data"""
    try:
        # Test data - simulating what iPhone shortcut would send
        test_data = {
            'name': 'John Doe',
            'email': 'john@techcorp.com',
            'phone': '5551234567',
            'company': 'Tech Corp',
            'title': 'Software Engineer',
            'website': 'techcorp.com',
            'address': '123 Main St, City, State',
            'notes': 'Met at tech conference 2024'
        }
        
        # Test with JSON data
        response = requests.post(f"{base_url}/process-card", json=test_data)
        print(f"Process Card (JSON): {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Success! Card ID: {result.get('id')}")
            print(f"Saved data: {json.dumps(result.get('data', {}), indent=2)}")
            return result.get('id')
        else:
            print(f"Error: {response.text}")
            
            # Try with form data as fallback
            print("Trying with form data...")
            response = requests.post(f"{base_url}/process-card", data=test_data)
            print(f"Process Card (Form): {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"Success! Card ID: {result.get('id')}")
                print(f"Saved data: {json.dumps(result.get('data', {}), indent=2)}")
                return result.get('id')
            else:
                print(f"Error: {response.text}")
                return None
            
    except Exception as e:
        print(f"Process card test failed: {e}")
        return None

def test_get_cards(base_url):
    """Test getting all cards"""
    try:
        response = requests.get(f"{base_url}/cards")
        print(f"Get All Cards: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Found {result.get('count', 0)} cards")
            return True
        else:
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"Get cards test failed: {e}")
        return False

def test_get_single_card(base_url, card_id):
    """Test getting a single card by ID"""
    if not card_id:
        print("Skipping single card test - no card ID available")
        return True
        
    try:
        response = requests.get(f"{base_url}/cards/{card_id}")
        print(f"Get Single Card: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            card_data = result.get('card', {})
            # Format the display to handle the notes field nicely
            formatted_card = dict(card_data)
            if 'notes' in formatted_card and formatted_card['notes']:
                # Make notes more readable by splitting on newlines
                formatted_card['notes'] = formatted_card['notes'].replace('\\n', '\n')
            print(f"Card details: {json.dumps(formatted_card, indent=2, default=str)}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"Get single card test failed: {e}")
        return False

def main():
    """Run all API tests"""
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"
    
    print(f"Testing Business Card API at: {base_url}")
    print("=" * 50)
    
    # Run tests
    tests_passed = 0
    total_tests = 4
    
    # Test 1: Health check
    if test_health_check(base_url):
        tests_passed += 1
    print()
    
    # Test 2: Process card
    card_id = test_process_card(base_url)
    if card_id is not None:
        tests_passed += 1
    print()
    
    # Test 3: Get all cards
    if test_get_cards(base_url):
        tests_passed += 1
    print()
    
    # Test 4: Get single card
    if test_get_single_card(base_url, card_id):
        tests_passed += 1
    print()
    
    # Results
    print("=" * 50)
    print(f"Tests passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print("✅ All tests passed! Your API is working correctly.")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Check your configuration and logs.")
        sys.exit(1)

if __name__ == "__main__":
    main() 