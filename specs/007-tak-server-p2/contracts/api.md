# API Contracts: TAK Server Integration Phase 2

## Configuration API

### `GET /api/tak/config`
Retrieves the current TAK configuration.

**Response**: `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "hostname": "string",
  "port": 8089,
  "protocol": "ssl",
  "authMethod": "enroll|import",
  "truststorePath": "string?",
  "clientCertPath": "string?",
  "connectOnStartup": true,
  "enrollmentUser": "string?",
  "enrollmentPort": 8446
}
```

### `POST /api/tak/config`
Updates the TAK configuration.

**Request Body**: Same as GET response.

---

## Certificate & Truststore API

### `POST /api/tak/certs`
Uploads and extracts a client certificate `.p12` bundle.

**Request**: `multipart/form-data`
- `p12File`: Binary file
- `password`: string
- `id`: string (config ID)

**Response**: `200 OK`
```json
{
  "success": true,
  "paths": {
    "certPath": "data/certs/id/client.crt",
    "keyPath": "data/certs/id/client.key",
    "caPath": "data/certs/id/ca.crt"
  }
}
```

### `POST /api/tak/truststore` (NEW)
Uploads and extracts a CA truststore `.p12` bundle.

**Request**: `multipart/form-data`
- `p12File`: Binary file
- `password`: string
- `id`: string (config ID)

**Response**: Same as `/api/tak/certs` but focused on `caPath`.

---

## Enrollment API

### `POST /api/tak/enroll` (NEW)
Performs automated certificate enrollment.

**Request Body**:
```json
{
  "hostname": "string",
  "port": 8446,
  "username": "string",
  "password": "string",
  "id": "uuid"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "paths": {
    "certPath": "...",
    "keyPath": "..."
  }
}
```

---

## Data Package API

### `POST /api/tak/import-package` (NEW)
Processes a TAK data package `.zip`.

**Request**: `multipart/form-data`
- `packageFile`: Binary (.zip)

**Response**: `200 OK`
```json
{
  "success": true,
  "config": {
    "hostname": "...",
    "port": 8089,
    "protocol": "ssl",
    "truststorePath": "...",
    "clientCertPath": "..."
  }
}
```
