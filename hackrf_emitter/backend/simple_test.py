#!/usr/bin/env python3
"""Simple test server for HackRF Emitter - skips cache initialization"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

def check_hackrf_device():
    """Check if HackRF device is connected"""
    try:
        import subprocess
        result = subprocess.run(['hackrf_info'], capture_output=True, text=True, timeout=5)
        return result.returncode == 0 and 'Found HackRF' in result.stdout
    except Exception as e:
        logger.warning(f"HackRF check failed: {e}")
        return False

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    hackrf_status = check_hackrf_device()
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'hackrf_connected': hackrf_status,
        'cache_ready': True
    })

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current system status"""
    hackrf_status = check_hackrf_device()
    return jsonify({
        'is_transmitting': False,
        'current_workflow': None,
        'hackrf_connected': hackrf_status,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/device_info', methods=['GET'])
def get_device_info():
    """Get HackRF device information"""
    hackrf_status = check_hackrf_device()
    if hackrf_status:
        return jsonify({
            'status': 'connected',
            'info': 'HackRF One detected and ready',
            'current_frequency': 915000000,  # Default 915 MHz
            'current_sample_rate': 2000000,   # 2 MS/s
            'current_gain': 14               # Default gain
        })
    else:
        return jsonify({
            'status': 'disconnected',
            'error': 'HackRF device not found'
        })

@app.route('/api/workflows', methods=['GET'])
def get_workflows():
    """Get available RF workflows"""
    return jsonify([
        {
            'name': 'test_workflow',
            'display_name': 'Test Workflow',
            'description': 'A test workflow for debugging',
            'category': 'Test',
            'parameters': {}
        }
    ])

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info("Client connected")
    emit('connected', {'message': 'Connected to HackRF Emitter'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    logger.info("Client disconnected")

if __name__ == '__main__':
    logger.info("Starting Simple Test Backend...")
    logger.info("API available at: http://localhost:5000")
    logger.info("WebSocket available at: ws://localhost:5000")
    
    try:
        socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")