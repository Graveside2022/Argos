#!/usr/bin/env python3
import hashlib
import json
import os

# Generate proper admin/admin credentials for OpenWebRX Plus
password = "admin"
salt = os.urandom(32).hex()

# OpenWebRX Plus uses salted SHA256
salted_password = salt + password
password_hash = hashlib.sha256(salted_password.encode()).hexdigest()

users = [
    {
        "user": "admin",
        "enabled": True,
        "must_change_password": False,
        "password": {
            "encoding": "hash",
            "value": password_hash,
            "algorithm": "sha256",
            "salt": salt
        }
    }
]

print(json.dumps(users, indent=4))

# Also save to file
with open('/home/ubuntu/projects/Argos/openwebrx-usrp-working/users.json', 'w') as f:
    json.dump(users, f, indent=4)