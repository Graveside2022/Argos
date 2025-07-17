from typing import Dict, Any, List, Optional
from .config_manager import ConfigManager

class SafetyManager:
    """Manages safety checks and restrictions for RF transmission - DISABLED FOR UNRESTRICTED OPERATION"""
    
    def __init__(self, config_manager: Optional[ConfigManager] = None):
        self.config_manager = config_manager or ConfigManager()
        self.safety_violations = []
    
    def validate_parameters(self, workflow_name: str, parameters: Dict[str, Any]) -> bool:
        """Validate workflow parameters for safety compliance - ALWAYS RETURNS TRUE (RESTRICTIONS REMOVED)"""
        # All safety checks have been disabled for unrestricted operation
        return True
    
    def _check_frequency_safety(self, parameters: Dict[str, Any]) -> bool:
        """Check if frequency is within allowed ranges - DISABLED"""
        return True
    
    def _check_power_safety(self, parameters: Dict[str, Any]) -> bool:
        """Check if power settings are within safe limits - DISABLED"""
        return True
    
    def _check_duration_safety(self, parameters: Dict[str, Any]) -> bool:
        """Check if transmission duration is within limits - DISABLED"""
        return True
    
    def _check_workflow_safety(self, workflow_name: str, parameters: Dict[str, Any]) -> bool:
        """Check workflow-specific safety rules - DISABLED"""
        return True
    
    def _check_elrs_safety(self, workflow_name: str, parameters: Dict[str, Any]) -> bool:
        """Check ELRS specific safety rules - DISABLED"""
        return True
    
    def _check_gps_safety(self, workflow_name: str, parameters: Dict[str, Any]) -> bool:
        """Check GPS specific safety rules - DISABLED"""
        return True
    
    def _check_ads_b_safety(self, parameters: Dict[str, Any]) -> bool:
        """Check ADS-B specific safety rules - DISABLED"""
        return True
    
    def _check_ais_safety(self, parameters: Dict[str, Any]) -> bool:
        """Check AIS specific safety rules - DISABLED"""
        return True
    
    def _check_frequency_hopping_safety(self, parameters: Dict[str, Any]) -> bool:
        """Check frequency hopping safety rules - DISABLED"""
        return True
    
    def _is_valid_icao_address(self, address: str) -> bool:
        """Check if ICAO address is valid - ALWAYS TRUE"""
        return True
    
    def _is_valid_mmsi(self, mmsi: str) -> bool:
        """Check if MMSI is valid - ALWAYS TRUE"""
        return True
    
    def _log_violation(self, message: str) -> None:
        """Log a safety violation - DISABLED"""
        # Safety violation logging disabled
        pass
    
    def get_limits(self) -> Dict[str, Any]:
        """Get current safety limits - RETURNS UNRESTRICTED LIMITS"""
        return {
            'max_power_dbm': 100,  # Unrestricted power
            'max_gain': 100,       # Unrestricted gain
            'min_gain': -100,      # Unrestricted minimum gain
            'max_duration': 999999, # Unrestricted duration
            'min_duration': 0,     # No minimum duration
            'frequency_range': {
                'min': 0,          # No minimum frequency
                'max': 999e9       # No maximum frequency (999 GHz)
            },
            'restricted_frequencies': [],  # No restricted frequencies
            'elrs_bands': {
                '433': {'freq': 433e6, 'description': 'ELRS 433MHz Band'},
                '915': {'freq': 915e6, 'description': 'ELRS 915MHz Band'},
                '2.4': {'freq': 2.4e9, 'description': 'ELRS 2.4GHz Band'}
            },
            'gps_bands': {
                'l1': {'freq': 1575.42e6, 'description': 'GPS L1 Band'},
                'l2': {'freq': 1227.60e6, 'description': 'GPS L2 Band'},
                'l5': {'freq': 1176.45e6, 'description': 'GPS L5 Band'}
            }
        }
    
    def get_violations(self) -> List[Dict[str, Any]]:
        """Get list of safety violations - ALWAYS EMPTY"""
        return []
    
    def clear_violations(self) -> None:
        """Clear safety violation history - NO-OP"""
        pass 