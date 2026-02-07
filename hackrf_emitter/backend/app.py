from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import json
import threading
import time
from datetime import datetime
import logging
import signal
import sys

from rf_workflows.hackrf_controller import HackRFController
from rf_workflows.modulation_workflows import ModulationWorkflows
from rf_workflows.universal_signal_cache import initialize_universal_cache, get_universal_cache
from utils.config_manager import ConfigManager
from utils.safety_manager import SafetyManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, 
    cors_allowed_origins="*",
    ping_timeout=60,
    ping_interval=25,
    async_mode='threading'
)

# Initialize managers
config_manager = ConfigManager()
safety_manager = SafetyManager()
hackrf_controller = HackRFController()
modulation_workflows = ModulationWorkflows(hackrf_controller)

# Thread-safe state management
class ThreadSafeState:
    def __init__(self):
        self._lock = threading.RLock()
        self._current_workflow = None
        self._is_transmitting = False
        self._transmission_thread = None
    
    @property
    def current_workflow(self):
        with self._lock:
            return self._current_workflow
    
    @current_workflow.setter
    def current_workflow(self, value):
        with self._lock:
            self._current_workflow = value
    
    @property
    def is_transmitting(self):
        with self._lock:
            return self._is_transmitting
    
    @is_transmitting.setter
    def is_transmitting(self, value):
        with self._lock:
            self._is_transmitting = value
    
    @property
    def transmission_thread(self):
        with self._lock:
            return self._transmission_thread
    
    @transmission_thread.setter
    def transmission_thread(self, value):
        with self._lock:
            self._transmission_thread = value

# Global thread-safe state
app_state = ThreadSafeState()

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    
    # Stop any active workflow
    try:
        if app_state.is_transmitting:
            logger.info("Stopping active workflow...")
            modulation_workflows.stop_workflow()
            
            # Wait for transmission thread to finish
            if app_state.transmission_thread and app_state.transmission_thread.is_alive():
                app_state.transmission_thread.join(timeout=5)
    except Exception as e:
        logger.error(f"Error stopping workflow during shutdown: {e}")
    
    # Clean up HackRF controller
    try:
        hackrf_controller.cleanup()
    except Exception as e:
        logger.error(f"Error cleaning up HackRF controller: {e}")
    
    logger.info("Graceful shutdown completed")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current system status"""
    try:
        return jsonify({
            'is_transmitting': app_state.is_transmitting,
            'current_workflow': app_state.current_workflow,
            'hackrf_connected': hackrf_controller.is_connected(),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting status: {e}")
        return jsonify({'error': 'Failed to get system status'}), 500

@app.route('/api/workflows', methods=['GET'])
def get_workflows():
    """Get available RF workflows"""
    try:
        workflows = modulation_workflows.get_available_workflows()
        return jsonify(workflows)
    except Exception as e:
        logger.error(f"Error getting workflows: {e}")
        return jsonify({'error': 'Failed to get workflows'}), 500

@app.route('/api/start_workflow', methods=['POST'])
def start_workflow():
    """Start a specific RF workflow"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        workflow_name = data.get('workflow')
        parameters = data.get('parameters', {})
        
        if not workflow_name:
            return jsonify({'error': 'Workflow name is required'}), 400
        
        # Check if already transmitting
        if app_state.is_transmitting:
            return jsonify({'error': 'Already transmitting'}), 400
        
        # Validate workflow exists
        available_workflows = modulation_workflows.get_available_workflows()
        workflow_names = [w['name'] for w in available_workflows]
        if workflow_name not in workflow_names:
            return jsonify({'error': f'Unknown workflow: {workflow_name}'}), 400
        
        # Set initial state
        app_state.is_transmitting = True
        app_state.current_workflow = workflow_name
        
        # Emit initial status
        socketio.emit('workflow_status', {
            'status': 'starting',
            'workflow': workflow_name,
            'timestamp': datetime.now().isoformat()
        })
        
        # Start workflow in background thread
        def run_workflow():
            try:
                # Emit running status
                socketio.emit('workflow_status', {
                    'status': 'running',
                    'workflow': workflow_name,
                    'timestamp': datetime.now().isoformat()
                })
                
                # Start the actual workflow
                modulation_workflows.start_workflow(workflow_name, parameters)
                
                # Wait for the workflow to complete
                while modulation_workflows.active_workflow is not None:
                    time.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Workflow error: {e}")
                socketio.emit('workflow_error', {
                    'error': str(e),
                    'workflow': workflow_name,
                    'timestamp': datetime.now().isoformat()
                })
            finally:
                # Always clean up state
                logger.info(f"Workflow {workflow_name} completed, cleaning up state")
                app_state.is_transmitting = False
                app_state.current_workflow = None
                socketio.emit('workflow_status', {
                    'status': 'stopped',
                    'workflow': workflow_name,
                    'timestamp': datetime.now().isoformat()
                })
                logger.info(f"Emitted stopped status for {workflow_name}")
        
        transmission_thread = threading.Thread(target=run_workflow)
        transmission_thread.daemon = True
        transmission_thread.start()
        app_state.transmission_thread = transmission_thread
        
        return jsonify({'message': f'Started {workflow_name} workflow'})
        
    except Exception as e:
        logger.error(f"Error starting workflow: {e}")
        # Reset state on error
        app_state.is_transmitting = False
        app_state.current_workflow = None
        return jsonify({'error': str(e)}), 500

@app.route('/api/stop_workflow', methods=['POST'])
def stop_workflow():
    """Stop current RF workflow"""
    try:
        if not app_state.is_transmitting:
            return jsonify({'message': 'No active workflow'})
        
        # Stop the modulation workflow
        modulation_workflows.stop_workflow()
        
        # Wait for the transmission thread to finish (with timeout)
        if app_state.transmission_thread and app_state.transmission_thread.is_alive():
            app_state.transmission_thread.join(timeout=5)
        
        # Update state
        app_state.is_transmitting = False
        app_state.current_workflow = None
        
        socketio.emit('workflow_status', {
            'status': 'stopped',
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({'message': 'Workflow stopped'})
        
    except Exception as e:
        logger.error(f"Error stopping workflow: {e}")
        # Force cleanup on error
        app_state.is_transmitting = False
        app_state.current_workflow = None
        return jsonify({'error': str(e)}), 500

@app.route('/api/frequency_bands', methods=['GET'])
def get_frequency_bands():
    """Get available frequency bands"""
    try:
        bands = config_manager.get_frequency_bands()
        return jsonify(bands)
    except Exception as e:
        logger.error(f"Error getting frequency bands: {e}")
        return jsonify({'error': 'Failed to get frequency bands'}), 500

@app.route('/api/safety_limits', methods=['GET'])
def get_safety_limits():
    """Get current safety limits"""
    try:
        limits = safety_manager.get_limits()
        return jsonify(limits)
    except Exception as e:
        logger.error(f"Error getting safety limits: {e}")
        return jsonify({'error': 'Failed to get safety limits'}), 500

@app.route('/api/device_info', methods=['GET'])
def get_device_info():
    """Get HackRF device information"""
    try:
        info = hackrf_controller.get_device_info()
        return jsonify(info)
    except Exception as e:
        logger.error(f"Error getting device info: {e}")
        return jsonify({'error': 'Failed to get device info'}), 500

@app.route('/api/cache_status', methods=['GET'])
def get_cache_status():
    """Get cache initialization status"""
    try:
        from rf_workflows.universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        status = cache.get_cache_status()
        return jsonify(status)
    except Exception as e:
        logger.warning(f"Cache status check failed: {e}")
        return jsonify({'status': 'initializing', 'cached_signals': 0, 'total_signals': 101})

@app.route('/api/library', methods=['GET'])
def get_library():
    """Get the list of all cached signals and their metadata"""
    try:
        cache = get_universal_cache()
        # Return a list of dicts for each cached signal
        signals = [signal.__dict__ for signal in cache.cached_signals.values()]
        return jsonify(signals)
    except Exception as e:
        logger.error(f"Error getting library: {e}")
        return jsonify({'error': 'Failed to get library'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Enhanced health check endpoint"""
    try:
        # Check cache status
        cache_ready = _cache_initialized
        cache_status = "ready" if cache_ready else "initializing"
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'hackrf_connected': hackrf_controller.is_connected(),
            'cache_ready': cache_ready,
            'cache_status': cache_status,
            'service': 'hackrf-emitter-backend',
            'version': '1.0.0'
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat(),
            'service': 'hackrf-emitter-backend'
        }), 500

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info("Client connected")
    emit('connected', {'message': 'Connected to HackRF Emitter'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    logger.info("Client disconnected")

# Global cache initialization lock
_cache_init_lock = threading.Lock()
_cache_initialized = False

def initialize_cache_after_startup():
    """Initialize cache after Flask is running (thread-safe)"""
    global _cache_initialized
    
    with _cache_init_lock:
        if _cache_initialized:
            logger.info("Cache already initialized, skipping...")
            return
        
        time.sleep(3)  # Let Flask fully start
        logger.info("[START] Starting background cache initialization...")
        try:
            initialize_universal_cache(force_regenerate=False)
            _cache_initialized = True
            logger.info("[OK] Universal Signal Cache ready - all signals pre-generated!")
            # Emit WebSocket update
            socketio.emit('cache_ready', {'status': 'complete'})
        except Exception as e:
            logger.warning(f"[WARN] Cache initialization failed: {e}")
            logger.info("   Signals will be generated on-demand (slower first transmission)")
            socketio.emit('cache_status', {'status': 'failed', 'error': str(e)})

def start_cache_background():
    """Start cache initialization in background thread (thread-safe)"""
    global _cache_initialized
    
    with _cache_init_lock:
        if _cache_initialized:
            logger.info("Cache initialization already in progress or complete")
            return
    
    cache_thread = threading.Thread(target=initialize_cache_after_startup)
    cache_thread.daemon = True
    cache_thread.start()

if __name__ == '__main__':
    logger.info("Starting HackRF Emitter Backend...")
    logger.info("API available at: http://localhost:5000")
    logger.info("WebSocket available at: ws://localhost:5000")
    
    # Initialize HackRF connection first (single-threaded)
    try:
        hackrf_controller.initialize()
        logger.info("HackRF device initialized successfully")
    except Exception as e:
        logger.warning(f"Warning: Could not initialize HackRF device: {e}")
    
    # Start Flask server IMMEDIATELY (cache will start after Flask is running)
    try:
        # Temporarily disable cache auto-initialization for stability
        # Cache will initialize on first workflow request
        logger.info("[SCHED] Cache initialization disabled for production stability")
        
        # Start Flask server in production mode (no debug reloader)
        socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True) 
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
        signal_handler(signal.SIGINT, None)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        signal_handler(signal.SIGTERM, None) 