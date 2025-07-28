# Technical Assumptions

## Repository Structure: Monorepo
Continue using the existing Argos monorepo structure with new drone-specific modules integrated into the current architecture.

## Service Architecture
**Hybrid Architecture within Monorepo**:
- Leverage existing SvelteKit application and API routes
- Add new drone telemetry service as separate process
- Maintain current HackRF/USRP integration approach
- New Python services for MAVLink communication
- WebSocket expansion for telemetry streaming

## Testing Requirements
**Full Testing Pyramid**:
- Unit tests for signal processing algorithms
- Integration tests for drone communication
- Hardware-in-loop testing with simulated RF environment
- Field testing protocols for flight operations
- Visual regression tests for UI components

## Additional Technical Assumptions and Requests
- Utilize existing HackRF sweep infrastructure with mobile adaptations
- Extend current SQLite database schema for flight data
- Leverage Leaflet mapping with 3D visualization plugins
- Maintain compatibility with DragonOS and existing hardware
- Support both HackRF One and USRP B205 mini SDRs
- Use existing process management approach with SystemD
- Implement failsafe mechanisms for autonomous operation
- Add drone-specific health monitoring to existing system
