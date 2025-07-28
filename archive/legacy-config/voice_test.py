#!/usr/bin/env python3
"""
Voice Test Script
This file demonstrates Nicole's voice functionality in the smarter-claude system.
"""

def greet_user():
    """Simple greeting function to test voice announcements."""
    print("Hello! This is a test of Nicole's voice system.")
    print("If you can hear this announcement, the voice is working correctly.")
    return "Voice test completed successfully!"

if __name__ == "__main__":
    result = greet_user()
    print(result)