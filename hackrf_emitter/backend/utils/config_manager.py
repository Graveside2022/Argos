import json
import os
from typing import Dict, Any, List

class ConfigManager:
    """Manages configuration settings for the HackRF emitter"""
    
    def __init__(self, config_file: str = "config/settings.json"):
        self.config_file = config_file
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        default_config = {
            "frequency_bands": [
                {
                    "name": "VHF",
                    "start_freq": 30e6,
                    "end_freq": 300e6,
                    "description": "Very High Frequency"
                },
                {
                    "name": "UHF",
                    "start_freq": 300e6,
                    "end_freq": 3e9,
                    "description": "Ultra High Frequency"
                },
                {
                    "name": "L-Band",
                    "start_freq": 1e9,
                    "end_freq": 2e9,
                    "description": "L-Band (1-2 GHz)"
                },
                {
                    "name": "S-Band",
                    "start_freq": 2e9,
                    "end_freq": 4e9,
                    "description": "S-Band (2-4 GHz)"
                },
                {
                    "name": "C-Band",
                    "start_freq": 4e9,
                    "end_freq": 8e9,
                    "description": "C-Band (4-8 GHz)"
                },
                {
                    "name": "ELRS 433MHz",
                    "start_freq": 433e6,
                    "end_freq": 433e6,
                    "description": "ExpressLRS 433MHz Band"
                },
                {
                    "name": "ELRS 915MHz",
                    "start_freq": 915e6,
                    "end_freq": 915e6,
                    "description": "ExpressLRS 915MHz Band"
                },
                {
                    "name": "ELRS 2.4GHz",
                    "start_freq": 2.4e9,
                    "end_freq": 2.4e9,
                    "description": "ExpressLRS 2.4GHz Band"
                },
                {
                    "name": "GPS L1",
                    "start_freq": 1575.42e6,
                    "end_freq": 1575.42e6,
                    "description": "GPS L1 Band (1575.42 MHz)"
                },
                {
                    "name": "GPS L2",
                    "start_freq": 1227.60e6,
                    "end_freq": 1227.60e6,
                    "description": "GPS L2 Band (1227.60 MHz)"
                },
                {
                    "name": "GPS L5",
                    "start_freq": 1176.45e6,
                    "end_freq": 1176.45e6,
                    "description": "GPS L5 Band (1176.45 MHz)"
                }
            ],
            "device_settings": {
                "default_sample_rate": 2000000,
                "default_gain": 10,
                "max_gain": 47,
                "min_gain": -73
            },
            "safety_settings": {
                "max_power_dbm": -10,
                "restricted_frequencies": [
                    {"start": 108e6, "end": 137e6, "description": "Aviation Band"},
                    {"start": 156e6, "end": 174e6, "description": "Marine Band"},
                    {"start": 406e6, "end": 406.1e6, "description": "Emergency Beacon"},
                    {"start": 1090e6, "end": 1090.1e6, "description": "ADS-B"},
                    {"start": 161.975e6, "end": 162.025e6, "description": "AIS"}
                ]
            },
            "workflow_defaults": {
                "sine_wave": {
                    "frequency": 100e6,
                    "amplitude": 0.5,
                    "duration": 10
                },
                "fm_modulation": {
                    "carrier_freq": 100e6,
                    "mod_freq": 1e3,
                    "mod_depth": 1.0,
                    "duration": 10
                },
                "am_modulation": {
                    "carrier_freq": 100e6,
                    "mod_freq": 1e3,
                    "mod_depth": 0.5,
                    "duration": 10
                },
                "elrs_433": {
                    "frequency": 433e6,
                    "packet_rate": 250,
                    "power": 25,
                    "duration": 10
                },
                "elrs_915": {
                    "frequency": 915e6,
                    "packet_rate": 250,
                    "power": 25,
                    "duration": 10
                },
                "elrs_2_4": {
                    "frequency": 2.4e9,
                    "packet_rate": 250,
                    "power": 25,
                    "duration": 10
                },
                "gps_l1": {
                    "frequency": 1575.42e6,
                    "satellite_id": 1,
                    "signal_strength": -120,
                    "duration": 10
                },
                "gps_l2": {
                    "frequency": 1227.60e6,
                    "satellite_id": 1,
                    "signal_strength": -120,
                    "duration": 10
                },
                "gps_l5": {
                    "frequency": 1176.45e6,
                    "satellite_id": 1,
                    "signal_strength": -120,
                    "duration": 10
                }
            }
        }
        
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    # Merge with defaults
                    return self._merge_configs(default_config, config)
            else:
                # Create config directory if it doesn't exist
                os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
                self._save_config(default_config)
                return default_config
        except Exception as e:
            print(f"Error loading config: {e}")
            return default_config
    
    def _merge_configs(self, default: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
        """Merge user config with defaults"""
        merged = default.copy()
        
        for key, value in user.items():
            if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                merged[key] = self._merge_configs(merged[key], value)
            else:
                merged[key] = value
        
        return merged
    
    def _save_config(self, config: Dict[str, Any]) -> None:
        """Save configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")
    
    def get_frequency_bands(self) -> List[Dict[str, Any]]:
        """Get available frequency bands"""
        return self.config.get("frequency_bands", [])
    
    def get_device_settings(self) -> Dict[str, Any]:
        """Get device settings"""
        return self.config.get("device_settings", {})
    
    def get_safety_settings(self) -> Dict[str, Any]:
        """Get safety settings"""
        return self.config.get("safety_settings", {})
    
    def get_workflow_defaults(self) -> Dict[str, Any]:
        """Get workflow default parameters"""
        return self.config.get("workflow_defaults", {})
    
    def get_restricted_frequencies(self) -> List[Dict[str, Any]]:
        """Get list of restricted frequency ranges"""
        return self.config.get("safety_settings", {}).get("restricted_frequencies", [])
    
    def is_frequency_allowed(self, frequency: float) -> bool:
        """Check if frequency is allowed (not in restricted bands)"""
        restricted = self.get_restricted_frequencies()
        
        for band in restricted:
            if band["start"] <= frequency <= band["end"]:
                return False
        
        return True
    
    def get_band_for_frequency(self, frequency: float) -> Dict[str, Any]:
        """Get frequency band information for a given frequency"""
        bands = self.get_frequency_bands()
        
        for band in bands:
            if band["start_freq"] <= frequency <= band["end_freq"]:
                return band
        
        return {"name": "Unknown", "description": "Frequency outside defined bands"}
    
    def get_elrs_bands(self) -> Dict[str, Any]:
        """Get ELRS frequency bands"""
        return {
            "433": {"freq": 433e6, "description": "ELRS 433MHz Band"},
            "915": {"freq": 915e6, "description": "ELRS 915MHz Band"},
            "2.4": {"freq": 2.4e9, "description": "ELRS 2.4GHz Band"}
        }
    
    def get_gps_bands(self) -> Dict[str, Any]:
        """Get GPS frequency bands"""
        return {
            "l1": {"freq": 1575.42e6, "description": "GPS L1 Band"},
            "l2": {"freq": 1227.60e6, "description": "GPS L2 Band"},
            "l5": {"freq": 1176.45e6, "description": "GPS L5 Band"}
        }
    
    def update_config(self, updates: Dict[str, Any]) -> bool:
        """Update configuration with new values"""
        try:
            self.config = self._merge_configs(self.config, updates)
            self._save_config(self.config)
            return True
        except Exception as e:
            print(f"Error updating config: {e}")
            return False 