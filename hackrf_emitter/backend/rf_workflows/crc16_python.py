#!/usr/bin/env python3
"""
Pure Python CRC16 implementation
Replaces the problematic crc16 module with a pure Python implementation
"""

def crc16xmodem(data: bytes, initial_value: int = 0x0000) -> int:
    """
    Calculate CRC16-XMODEM checksum
    
    Args:
        data: Input data as bytes
        initial_value: Initial CRC value (default 0x0000)
    
    Returns:
        CRC16-XMODEM checksum as integer
    """
    crc = initial_value
    
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc = crc << 1
        crc &= 0xFFFF
    
    return crc


def crc16ccitt(data: bytes, initial_value: int = 0xFFFF) -> int:
    """
    Calculate CRC16-CCITT checksum
    
    Args:
        data: Input data as bytes
        initial_value: Initial CRC value (default 0xFFFF)
    
    Returns:
        CRC16-CCITT checksum as integer
    """
    crc = initial_value
    
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc = crc << 1
        crc &= 0xFFFF
    
    return crc


def crc16modbus(data: bytes) -> int:
    """
    Calculate CRC16-MODBUS checksum
    
    Args:
        data: Input data as bytes
    
    Returns:
        CRC16-MODBUS checksum as integer
    """
    return crc16xmodem(data, 0xFFFF)


# Alias for backward compatibility
crc16 = crc16xmodem 