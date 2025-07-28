# API Specification

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Argos RF Signal API
  version: 1.0.0
  description: API for RF signal detection and mission management
servers:
  - url: http://localhost:5173/api
    description: Development server
  - url: https://argos.local/api
    description: Production edge device

paths:
  /signals/batch:
    post:
      summary: Upload batch of signals
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                signals:
                  type: array
                  items:
                    $ref: '#/components/schemas/Signal'
      responses:
        '201':
          description: Signals processed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  processed: 
                    type: integer
                  stored:
                    type: integer
                  duplicates:
                    type: integer

  /signals/nearby:
    get:
      summary: Get signals near location
      parameters:
        - name: lat
          in: query
          required: true
          schema:
            type: number
        - name: lon
          in: query
          required: true
          schema:
            type: number
        - name: radius
          in: query
          schema:
            type: number
            default: 1000
      responses:
        '200':
          description: Nearby signals
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Signal'

  /signals/heatmap:
    get:
      summary: Get heatmap data for area
      parameters:
        - name: bounds
          in: query
          required: true
          schema:
            type: string
            description: 'Format: minLat,minLon,maxLat,maxLon'
        - name: resolution
          in: query
          schema:
            type: integer
            default: 100
      responses:
        '200':
          description: Heatmap grid data
          content:
            application/json:
              schema:
                type: object
                properties:
                  grid:
                    type: array
                    items:
                      type: array
                      items:
                        type: number

  /signals/classify:
    post:
      summary: Classify signals by pattern
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                signalIds:
                  type: array
                  items:
                    type: string
                classification:
                  type: string
                confidence:
                  type: number
      responses:
        '200':
          description: Classification saved

  /missions:
    get:
      summary: List all missions
      responses:
        '200':
          description: Mission list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Mission'
    
    post:
      summary: Create new mission
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Mission'
      responses:
        '201':
          description: Mission created

  /missions/{id}/execute:
    post:
      summary: Start mission execution
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Mission started

  /hardware/status:
    get:
      summary: Get hardware device status
      responses:
        '200':
          description: Device status list
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    device:
                      type: string
                    connected:
                      type: boolean
                    lastSeen:
                      type: string
                      format: date-time

  /hardware/{device}/sweep:
    post:
      summary: Start frequency sweep
      parameters:
        - name: device
          in: path
          required: true
          schema:
            type: string
            enum: [hackrf, usrp]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                startFreq:
                  type: number
                endFreq:
                  type: number
                stepSize:
                  type: number
                gain:
                  type: number
      responses:
        '200':
          description: Sweep started

components:
  schemas:
    Signal:
      type: object
      required:
        - timestamp
        - frequency
        - rssi
        - latitude
        - longitude
      properties:
        id:
          type: string
        timestamp:
          type: string
          format: date-time
        frequency:
          type: number
        rssi:
          type: number
        latitude:
          type: number
        longitude:
          type: number
        altitude:
          type: number
        droneId:
          type: string
        modulation:
          type: string
        bandwidth:
          type: number
        metadata:
          type: object

    Mission:
      type: object
      required:
        - name
        - type
        - area
      properties:
        id:
          type: string
        name:
          type: string
        type:
          type: string
          enum: [sweep, track, patrol]
        status:
          type: string
          enum: [planned, active, completed, aborted]
        area:
          type: object
          description: GeoJSON Polygon
        parameters:
          type: object

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```
