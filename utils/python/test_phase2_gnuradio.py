#!/usr/bin/env python3
"""
Phase 2 GNU Radio Integration Test Script
Tests the complete GNU Radio RF spectrum analysis system
"""

import subprocess
import time
import json
import requests
import sys
import os

class Phase2TestSuite:
    def __init__(self):
        self.base_url = "http://localhost:5173"
        self.test_results = []
        self.start_time = time.time()
        
    def log_test(self, test_name, result, details=""):
        """Log test results"""
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        
        self.test_results.append({
            'test': test_name,
            'result': result,
            'details': details,
            'timestamp': time.time()
        })
    
    def test_prerequisite_checks(self):
        """Test system prerequisites"""
        print("\n🔍 Testing Prerequisites...")
        
        # Check for GNU Radio Python environment
        try:
            import gnuradio
            self.log_test("GNU Radio Python Module", True, f"Version: {gnuradio.version()}")
        except ImportError as e:
            self.log_test("GNU Radio Python Module", False, f"Import error: {e}")
            
        # Check for osmosdr (optional but recommended)
        try:
            import osmosdr
            self.log_test("osmosdr Module", True, "Available for SDR support")
        except ImportError:
            self.log_test("osmosdr Module", False, "Not available - will use test mode")
        
        # Check for numpy and scipy
        try:
            import numpy as np
            import scipy
            self.log_test("NumPy/SciPy", True, f"NumPy: {np.__version__}")
        except ImportError as e:
            self.log_test("NumPy/SciPy", False, f"Import error: {e}")
            
        # Check for SDR hardware tools
        tools = ['hackrf_info', 'rtl_test', 'uhd_find_devices']
        for tool in tools:
            try:
                result = subprocess.run(['which', tool], capture_output=True, text=True)
                if result.returncode == 0:
                    self.log_test(f"SDR Tool: {tool}", True, f"Found at: {result.stdout.strip()}")
                else:
                    self.log_test(f"SDR Tool: {tool}", False, "Not found in PATH")
            except Exception as e:
                self.log_test(f"SDR Tool: {tool}", False, f"Error: {e}")
    
    def test_api_endpoints(self):
        """Test GNU Radio API endpoints"""
        print("\n🌐 Testing API Endpoints...")
        
        endpoints = [
            ('GET', '/api/gnuradio/status', 'GNU Radio Status'),
            ('GET', '/api/gnuradio/config', 'GNU Radio Config'),
            ('GET', '/api/gnuradio/devices', 'GNU Radio Devices'),
            ('POST', '/api/gnuradio/start', 'GNU Radio Start'),
            ('POST', '/api/gnuradio/stop', 'GNU Radio Stop'),
            ('GET', '/api/fusion/stream?channel=gnuradio', 'SSE Stream')
        ]
        
        for method, endpoint, test_name in endpoints:
            try:
                if method == 'GET':
                    response = requests.get(f"{self.base_url}{endpoint}", timeout=10)
                elif method == 'POST':
                    response = requests.post(f"{self.base_url}{endpoint}", 
                                           json={}, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_test(f"API: {test_name}", True, f"Status: {response.status_code}")
                else:
                    self.log_test(f"API: {test_name}", False, f"Status: {response.status_code}")
                    
            except Exception as e:
                self.log_test(f"API: {test_name}", False, f"Error: {e}")
    
    def test_spectrum_analyzer(self):
        """Test GNU Radio spectrum analyzer functionality"""
        print("\n📊 Testing Spectrum Analyzer...")
        
        try:
            # Test spectrum analyzer creation
            from src.lib.server.gnuradio import getSpectrumAnalyzer
            analyzer = getSpectrumAnalyzer()
            self.log_test("Spectrum Analyzer Creation", True, "Instance created")
            
            # Test device detection
            devices = analyzer.getDevices()
            self.log_test("Device Detection", True, f"Found {len(devices)} devices")
            
            # Test configuration
            config = analyzer.getStatus().config
            self.log_test("Configuration", True, f"Center: {config.centerFreq/1e9:.3f} GHz")
            
            # Test status
            status = analyzer.getStatus()
            self.log_test("Status Check", True, f"Running: {status.running}")
            
        except Exception as e:
            self.log_test("Spectrum Analyzer", False, f"Error: {e}")
    
    def test_signal_processing(self):
        """Test signal processing components"""
        print("\n🔧 Testing Signal Processing...")
        
        try:
            # Test FFT processor
            from src.lib.server.gnuradio.utils.fft_processor import RealTimeFFTProcessor
            fft_processor = RealTimeFFTProcessor(1024, 2e6, 2.4e9)
            
            # Generate test data
            import numpy as np
            test_data = np.random.normal(0, 1, 2048).astype(np.float32)
            
            # Test FFT processing
            result = fft_processor.process(test_data)
            self.log_test("FFT Processing", True, f"Output size: {len(result)}")
            
            # Test frequency calculation
            freqs = fft_processor.getFrequencies()
            self.log_test("Frequency Calculation", True, f"Freq range: {len(freqs)} bins")
            
        except Exception as e:
            self.log_test("Signal Processing", False, f"Error: {e}")
    
    def test_device_manager(self):
        """Test SDR device manager"""
        print("\n📱 Testing Device Manager...")
        
        try:
            from src.lib.server.gnuradio.utils.device_manager import SDRDeviceManager
            device_manager = SDRDeviceManager()
            
            # Test device detection
            devices = device_manager.getDevices()
            self.log_test("Device Manager", True, f"Detected {len(devices)} devices")
            
            # Test device capabilities
            for device in devices:
                caps = device_manager.getDeviceCapabilities(device)
                self.log_test(f"Device {device.name}", True, 
                             f"RX: {caps['supportsRX']}, TX: {caps['supportsTX']}")
                
        except Exception as e:
            self.log_test("Device Manager", False, f"Error: {e}")
    
    def test_integration_flow(self):
        """Test complete integration flow"""
        print("\n🔄 Testing Integration Flow...")
        
        try:
            # Start GNU Radio
            response = requests.post(f"{self.base_url}/api/gnuradio/start", 
                                   json={'centerFreq': 2.4e9, 'sampleRate': 2e6})
            if response.status_code == 200:
                self.log_test("Integration Start", True, "GNU Radio started via API")
                
                # Wait for startup
                time.sleep(2)
                
                # Check status
                status_response = requests.get(f"{self.base_url}/api/gnuradio/status")
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    self.log_test("Integration Status", True, 
                                f"Status: {status_data.get('status', 'unknown')}")
                
                # Stop GNU Radio
                stop_response = requests.post(f"{self.base_url}/api/gnuradio/stop")
                if stop_response.status_code == 200:
                    self.log_test("Integration Stop", True, "GNU Radio stopped via API")
                else:
                    self.log_test("Integration Stop", False, f"Stop failed: {stop_response.status_code}")
            else:
                self.log_test("Integration Start", False, f"Start failed: {response.status_code}")
                
        except Exception as e:
            self.log_test("Integration Flow", False, f"Error: {e}")
    
    def test_performance_metrics(self):
        """Test performance requirements"""
        print("\n⚡ Testing Performance...")
        
        try:
            # Test memory usage
            import psutil
            process = psutil.Process()
            memory_usage = process.memory_info().rss / 1024 / 1024  # MB
            
            if memory_usage < 300:  # 300MB limit
                self.log_test("Memory Usage", True, f"{memory_usage:.1f} MB")
            else:
                self.log_test("Memory Usage", False, f"{memory_usage:.1f} MB (exceeds 300MB)")
            
            # Test update rate capability
            start_time = time.time()
            for i in range(10):
                response = requests.get(f"{self.base_url}/api/gnuradio/status", timeout=1)
                if response.status_code != 200:
                    break
            
            elapsed = time.time() - start_time
            rate = 10 / elapsed  # requests per second
            
            if rate >= 10:  # 10 Hz target
                self.log_test("Update Rate", True, f"{rate:.1f} Hz")
            else:
                self.log_test("Update Rate", False, f"{rate:.1f} Hz (below 10 Hz)")
                
        except Exception as e:
            self.log_test("Performance", False, f"Error: {e}")
    
    def generate_report(self):
        """Generate final test report"""
        print("\n" + "="*60)
        print("📋 PHASE 2 TEST REPORT")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['result'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Test Duration: {time.time() - self.start_time:.2f} seconds")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['result']:
                    print(f"  • {result['test']}: {result['details']}")
        
        # Grade calculation
        success_rate = (passed_tests / total_tests) * 100
        if success_rate >= 95:
            grade = "A+"
        elif success_rate >= 90:
            grade = "A"
        elif success_rate >= 85:
            grade = "B+"
        elif success_rate >= 80:
            grade = "B"
        else:
            grade = "C"
        
        print(f"\n🎯 PHASE 2 GRADE: {grade} ({success_rate:.1f}%)")
        
        # Save detailed report
        report_file = "phase2_test_report.json"
        with open(report_file, 'w') as f:
            json.dump({
                'phase': 2,
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'success_rate': success_rate,
                'grade': grade,
                'test_duration': time.time() - self.start_time,
                'results': self.test_results
            }, f, indent=2)
        
        print(f"📄 Detailed report saved to: {report_file}")
    
    def run_all_tests(self):
        """Run the complete test suite"""
        print("🚀 Starting Phase 2 GNU Radio Integration Test Suite")
        print("="*60)
        
        # Run all test categories
        self.test_prerequisite_checks()
        self.test_api_endpoints()
        self.test_spectrum_analyzer()
        self.test_signal_processing()
        self.test_device_manager()
        self.test_integration_flow()
        self.test_performance_metrics()
        
        # Generate final report
        self.generate_report()

def main():
    """Main test runner"""
    if len(sys.argv) > 1 and sys.argv[1] == '--help':
        print("Phase 2 GNU Radio Integration Test Suite")
        print("Usage: python3 test_phase2_gnuradio.py [options]")
        print("Options:")
        print("  --help    Show this help message")
        print("  --quick   Run quick tests only")
        return
    
    test_suite = Phase2TestSuite()
    
    if len(sys.argv) > 1 and sys.argv[1] == '--quick':
        print("🏃 Running Quick Tests Only")
        test_suite.test_prerequisite_checks()
        test_suite.test_api_endpoints()
        test_suite.generate_report()
    else:
        test_suite.run_all_tests()

if __name__ == "__main__":
    main()