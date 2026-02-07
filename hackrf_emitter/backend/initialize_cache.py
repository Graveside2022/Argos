#!/usr/bin/env python3
"""
Initialize Universal Signal Cache
Pre-generates all RF signals on first start for instant transmission
"""

import os
import sys
import time

# Check if we're running in the virtual environment
def check_venv():
    """Check if we're running in the virtual environment and activate if needed"""
    # Check if we're already in a virtual environment
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        return True  # Already in a virtual environment
    
    # Check if we're in the backend directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    venv_path = os.path.join(script_dir, 'venv')
    
    if os.path.exists(venv_path):
        # Try to activate the virtual environment
        venv_python = os.path.join(venv_path, 'bin', 'python3')
        if os.path.exists(venv_python):
            print("[WARN]  Virtual environment detected but not activated.")
            print("   Please run this script using: ./run_cache_init.sh")
            print("   Or activate the virtual environment manually:")
            print(f"   source {venv_path}/bin/activate")
            print("   Then run: python3 initialize_cache.py")
            return False
    
    return True  # Assume we're in the right environment

# Check virtual environment before importing modules
if not check_venv():
    sys.exit(1)

from rf_workflows.universal_signal_cache import initialize_universal_cache, get_universal_cache

def main():
    """Initialize the universal signal cache"""
    print("[START] HackRF Emitter - Universal Signal Cache Initialization")
    print("=" * 60)
    
    # Check if force regeneration is requested
    force_regenerate = '--force' in sys.argv or '-f' in sys.argv
    
    if force_regenerate:
        print("[WARN]  Force regeneration requested - all cached signals will be regenerated")
        response = input("Are you sure you want to regenerate all signals? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return 0
    
    # Initialize the cache
    try:
        start_time = time.time()
        
        # Get initial status
        cache = get_universal_cache()
        initial_status = cache.get_cache_status()
        
        print(f"\n[STATUS] Initial Cache Status:")
        print(f"   Cached signals: {initial_status['existing_files']}/{initial_status['total_configs']}")
        print(f"   Cache size: {initial_status['total_size_mb']:.1f} MB")
        print(f"   Cache directory: {initial_status['cache_dir']}")
        
        if initial_status['existing_files'] == initial_status['total_configs'] and not force_regenerate:
            print("\n[OK] All signals already cached! Ready for instant transmission.")
            print(f"   Signal types: {initial_status['type_counts']}")
            return 0
        
        # Initialize with pre-generation
        print("\n[BUILD] Pre-generating RF signals for instant transmission...")
        print("   This may take several minutes on first run.")
        print("   Progress will be shown below:\n")
        
        # Progress callback
        def progress_callback(current, total, message):
            percent = (current / total) * 100
            bar_length = 40
            filled = int(bar_length * current / total)
            bar = '█' * filled + '░' * (bar_length - filled)
            print(f"\r   [{bar}] {percent:3.0f}% | {current}/{total} | {message}", end='', flush=True)
            if current == total:
                print()  # New line at completion
        
        # Initialize cache with progress tracking
        cache.pregenerate_all_signals(progress_callback)
        
        # Get final status
        final_status = cache.get_cache_status()
        total_time = time.time() - start_time
        
        print(f"\n[OK] Cache initialization complete!")
        print(f"   Total signals: {final_status['existing_files']}")
        print(f"   Total size: {final_status['total_size_mb']:.1f} MB")
        print(f"   Time taken: {total_time:.1f} seconds")
        print(f"\n   Signal types cached:")
        for signal_type, count in final_status['type_counts'].items():
            print(f"     - {signal_type}: {count} signals")
        
        print(f"\n[TARGET] HackRF Emitter is ready for instant transmission!")
        print(f"   All signals are pre-generated and cached.")
        print(f"   Transmissions will start immediately when triggered.")
        
        return 0
        
    except KeyboardInterrupt:
        print("\n\n[WARN]  Cache initialization interrupted by user.")
        return 1
    except Exception as e:
        print(f"\n[ERROR] Error during cache initialization: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main()) 