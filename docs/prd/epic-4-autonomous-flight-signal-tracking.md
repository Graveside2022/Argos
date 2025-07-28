# Epic 4: Autonomous Flight & Signal Tracking

Implement intelligent autonomous flight capabilities that enable the drone to actively hunt and track RF signals without constant human intervention.

## Story 4.1: Signal Gradient Following

As a signal hunter,
I want the drone to fly toward stronger signals,
so that it can locate transmission sources.

**Acceptance Criteria:**
1: Calculate signal strength gradient from recent samples
2: Generate flight vector toward increasing strength
3: Maintain safe altitude during approach
4: Stop at configurable minimum distance
5: Circle pattern when source located
6: Manual override always available

## Story 4.2: Multi-Signal Prioritization

As an intelligence analyst,
I want the drone to prioritize interesting signals,
so that limited battery is used effectively.

**Acceptance Criteria:**
1: Signal classification determines priority
2: Configurable priority weights by signal type
3: Mission planner sets targets of interest
4: Dynamic re-planning based on detections
5: Battery reserve for RTL always maintained
6: Priority overrides via ground station

## Story 4.3: Search Pattern Optimization

As a field operator,
I want efficient search patterns,
so that maximum area is covered per flight.

**Acceptance Criteria:**
1: Multiple pattern types (grid/spiral/random)
2: Adaptive spacing based on signal range
3: Overlap optimization for complete coverage
4: Wind compensation for ground track
5: Obstacle avoidance integration
6: Pattern preview before execution

## Story 4.4: Autonomous Signal Tracking

As a surveillance operator,
I want the drone to follow moving signals,
so that mobile targets can be tracked.

**Acceptance Criteria:**
1: Identify moving signals by position change
2: Predict target trajectory
3: Maintain optimal tracking distance
4: Switch targets based on priority
5: Record entire track history
6: Alert on target loss
