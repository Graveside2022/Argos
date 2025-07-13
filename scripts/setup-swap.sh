#!/bin/bash

# setup-swap.sh - Set up 2GB swap space on Raspberry Pi
# This script checks for existing swap, creates a 2GB swapfile if needed,
# sets proper permissions, enables swap, and adds to /etc/fstab for persistence

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Define swap file location and size
SWAP_FILE="/swapfile"
SWAP_SIZE="2G"  # 2GB swap size

print_status "Starting swap setup process..."

# Check if swap is already enabled
EXISTING_SWAP=$(swapon --show)
if [[ ! -z "$EXISTING_SWAP" ]]; then
    print_warning "Swap is already enabled:"
    swapon --show
    read -p "Do you want to continue and potentially add more swap? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Exiting without changes."
        exit 0
    fi
fi

# Check if swapfile already exists
if [[ -f "$SWAP_FILE" ]]; then
    print_warning "Swapfile already exists at $SWAP_FILE"
    # Check if it's already being used as swap
    if swapon --show | grep -q "$SWAP_FILE"; then
        print_status "Swapfile is already active as swap"
        exit 0
    else
        print_warning "Swapfile exists but is not active"
        read -p "Do you want to remove existing swapfile and create a new one? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Removing existing swapfile..."
            rm -f "$SWAP_FILE"
        else
            print_status "Exiting without changes."
            exit 0
        fi
    fi
fi

# Create swap file
print_status "Creating ${SWAP_SIZE} swapfile at ${SWAP_FILE}..."
fallocate -l $SWAP_SIZE $SWAP_FILE || dd if=/dev/zero of=$SWAP_FILE bs=1M count=2048 status=progress

# Set proper permissions (only root should have access)
print_status "Setting proper permissions on swapfile..."
chmod 600 $SWAP_FILE
ls -lh $SWAP_FILE

# Set up the swap file
print_status "Setting up swap space..."
mkswap $SWAP_FILE

# Enable the swap file
print_status "Enabling swap..."
swapon $SWAP_FILE

# Verify swap is active
print_status "Verifying swap is active..."
swapon --show

# Add to /etc/fstab if not already present
print_status "Checking /etc/fstab for swap entry..."
if ! grep -q "$SWAP_FILE" /etc/fstab; then
    print_status "Adding swap entry to /etc/fstab for persistence..."
    echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
    print_status "Swap entry added to /etc/fstab"
else
    print_warning "Swap entry already exists in /etc/fstab"
fi

# Show current memory and swap status
print_status "Current memory and swap status:"
free -h

# Optional: Adjust swappiness (how aggressively kernel swaps)
print_status "Current swappiness value:"
cat /proc/sys/vm/swappiness

# Set swappiness to a reasonable value for Raspberry Pi (default is 60)
# Lower values = less swapping, higher values = more swapping
# 10-30 is often good for Raspberry Pi
echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
sysctl -p /etc/sysctl.d/99-swappiness.conf

print_status "Swap setup completed successfully!"
print_status "Swap will be automatically enabled on system boot."