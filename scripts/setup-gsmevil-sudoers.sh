#!/bin/bash

# Script to set up sudo permissions for GSM Evil scripts
echo "Setting up sudo permissions for GSM Evil scripts..."

# Create sudoers file for the web user
cat <<EOF | sudo tee /etc/sudoers.d/gsmevil
# Allow web server to run GSM Evil scripts without password
www-data ALL=(ALL) NOPASSWD: /home/ubuntu/projects/Argos/scripts/gsmevil-simple-start.sh
www-data ALL=(ALL) NOPASSWD: /home/ubuntu/projects/Argos/scripts/gsmevil-simple-stop.sh
www-data ALL=(ALL) NOPASSWD: /home/ubuntu/projects/Argos/scripts/gsmevil-readme-start.sh
www-data ALL=(ALL) NOPASSWD: /usr/bin/pkill -f grgsm_livemon
www-data ALL=(ALL) NOPASSWD: /usr/bin/pkill -f GsmEvil.py
www-data ALL=(ALL) NOPASSWD: /usr/bin/pkill -9 -f grgsm_livemon
www-data ALL=(ALL) NOPASSWD: /usr/bin/pkill -9 -f GsmEvil.py

# Also for the ubuntu user
ubuntu ALL=(ALL) NOPASSWD: /home/ubuntu/projects/Argos/scripts/gsmevil-simple-start.sh
ubuntu ALL=(ALL) NOPASSWD: /home/ubuntu/projects/Argos/scripts/gsmevil-simple-stop.sh
ubuntu ALL=(ALL) NOPASSWD: /home/ubuntu/projects/Argos/scripts/gsmevil-readme-start.sh
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -f grgsm_livemon
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -f GsmEvil.py
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -9 -f grgsm_livemon
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/pkill -9 -f GsmEvil.py
EOF

echo "Sudo permissions configured!"