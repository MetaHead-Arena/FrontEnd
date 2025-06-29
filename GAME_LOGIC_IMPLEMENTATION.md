# MetaHead Arena - Complete Game Logic Implementation

This document explains the comprehensive game logic implementation for the MetaHead Arena multiplayer game, including player management, room handling, game state synchronization, and real-time input handling.

## Overview

The game logic system consists of several key components:

1. **Game Logic Service** (`src/services/gameLogicService.ts`) - Core multiplayer logic
2. **Socket Service** (`src/services/socketService.ts`) - WebSocket communication
3. **Game Scene** (`src/app/components/GameScene.js`) - Phaser game engine integration
4. **Player Components** (`Player.js`, `RemotePlayer.js`) - Player behavior and input handling

## Architecture

### Game Logic Service

The `GameLogicService` is the central hub for all multiplayer functionality:

```typescript
// Key features:
- Player joining and leaving management
- Room creation and entry
- Game start triggers and synchronization
- Player position assignments
- Time handling for match duration
- Ball authority management
- Real-time input synchronization
- Goal scoring and match ending
- Rematch functionality
```

### Socket Events

The system uses the following socket events for real-time communication:

#### Connection Events
- `connect` - Socket connected
- `disconnect` - Socket disconnected
- `welcome` - Server welcome message

#### Player Events
- `player-created` - Player account created
- `player-joined-room` - Player joined a room
- `player-left` - Player left a room
- `player-ready` - Player ready status changed

#### Room Events
- `room-created` - New room created
- `room-joined` - Joined existing room
- `room-full` - Room is full
- `left-room` - Left current room

#### Game Events
- `game-started` - Match started
- `match-ended` - Match ended
- `goal-scored` - Goal scored
- `player-input` - Player input received
- `ball-state` - Ball position update
- `player-position` - Player position update

#### Rematch Events
- `rematch-request` - Rematch requested
- `rematch-confirmed` - Rematch confirmed
- `rematch-declined` - Rematch declined

## Player Position Assignment

The system automatically assigns player positions based on join order:

```javascript
// First player to join becomes player1 (ball authority)
// Second player to join becomes player2

if (playersInRoom === 1) {
  window.__HEADBALL_PLAYER_POSITION = "player1";
} else {
  window.__HEADBALL_PLAYER_POSITION = "player2";
}
```

### Ball Authority

- **Player 1** is the ball authority and manages ball physics
- **Player 2** receives ball state updates from Player 1
- This prevents conflicts and ensures consistent ball behavior

## Real-time Synchronization

### Input Handling

Players send input events to the server:

```javascript
// Player sends input
socketService.sendInput("move-left", { pressed: true });
socketService.sendInput("jump", { pressed: true });
socketService.sendInput("kick", { pressed: true });
```

### Position Synchronization

Players broadcast their position to other players:

```javascript
// Send position update
socketService.sendPlayerPosition(playerPosition, {
  x: player.x,
  y: player.y,
  velocityX: player.velocityX,
  velocityY: player.velocityY,
  direction: player.direction,
  isOnGround: player.isOnGround
});
```

### Ball Synchronization

The ball authority broadcasts ball state:

```javascript
// Ball authority sends ball state
socketService.sendBallState({
  x: ball.x,
  y: ball.y,
  velocityX: ball.velocityX,
  velocityY: ball.velocityY,
  timestamp: Date.now()
});
```

## Game Flow

### 1. Room Creation/Joining

```javascript
// Create a room
gameLogicService.createRoom();

// Join by room code
gameLogicService.joinRoomByCode("ABC123");
```

### 2. Player Ready System

```javascript
// Toggle ready status
gameLogicService.toggleReady();
```

### 3. Game Start

When both players are ready, the server emits `game-started`:

```javascript
socketService.on("game-started", (data) => {
  // Game starts with synchronized timer
  this.gameStarted = true;
  this.gameTime = data.matchDuration || 60;
});
```

### 4. Real-time Gameplay

During the game:
- Each player controls their own character
- Input is sent to the server and relayed to other players
- Ball authority manages ball physics
- Non-authority players receive ball updates
- Player positions are synchronized

### 5. Goal Scoring

```javascript
// Local goal detection
if (ball.x <= 0 && ball.y >= 250 && ball.y <= 390) {
  // Left goal - player2 scores
  socketService.scoreGoal("player2");
}
```

### 6. Match End

```javascript
// Time runs out or match ends
socketService.on("match-ended", (data) => {
  this.gameOver = true;
  this.player1Score = data.finalScore.player1;
  this.player2Score = data.finalScore.player2;
});
```

## Physics and Interpolation

### Position Interpolation

Remote players use interpolation for smooth movement:

```javascript
// Interpolate towards target position
const newX = currentX + (targetX - currentX) * interpolationFactor;
const newY = currentY + (targetY - currentY) * interpolationFactor;
```

### Ball Authority

Only the ball authority (Player 1) handles:
- Ball physics calculations
- Collision detection
- Goal detection
- Ball state broadcasting

## Error Handling

The system includes comprehensive error handling:

```javascript
// Connection errors
socketService.on("connect_error", (error) => {
  console.error("Socket connection error:", error);
});

// Game errors
socketService.on("error", (data) => {
  console.error("Game error:", data.message);
});
```

## Performance Optimizations

### Throttling

Input and position updates are throttled to prevent spam:

```javascript
// Throttle ball state broadcasts (every 2nd frame)
if (this.ballBroadcastCounter % 2 !== 0) return;

// Throttle player position broadcasts (every 3rd frame)
if (this.playerBroadcastCounter % 3 !== 0) return;
```

### Interpolation

Smooth movement is achieved through position interpolation:

```javascript
// Apply received position with interpolation
const lerpFactor = 0.7;
remotePlayer.x = remotePlayer.x * (1 - lerpFactor) + data.player.x * lerpFactor;
```

## Usage Examples

### Starting an Online Game

```javascript
// 1. Connect to socket
await socketService.connect();

// 2. Create or join room
gameLogicService.createRoom();
// or
gameLogicService.joinRoomByCode("ABC123");

// 3. Ready up
gameLogicService.toggleReady();

// 4. Game starts automatically when both players are ready
```

### Handling Game Events

```javascript
// Listen for game events
gameLogicService.on("game-started", (data) => {
  console.log("Game started:", data);
});

gameLogicService.on("goal-scored", (data) => {
  console.log("Goal scored by:", data.scorer);
});

gameLogicService.on("match-ended", (data) => {
  console.log("Match ended. Winner:", data.winner);
});
```

### Getting Game State

```javascript
// Get current game state
const gameState = gameLogicService.getGameState();
console.log("Score:", gameState.score);
console.log("Time remaining:", gameState.gameTime);
console.log("Player position:", gameState.playerPosition);
```

## Configuration

The system is highly configurable through the `GAME_CONFIG` object:

```javascript
// Physics constants
physics: {
  gravity: 0.5,
  friction: 0.88,
  airResistance: 0.99,
  ballBounce: 0.75,
  playerSpeed: 4,
  jumpPower: 12,
  groundLevel: 320,
}

// Game settings
GAME_DURATION: 60, // seconds
GOAL_COOLDOWN: 2000, // milliseconds
GOAL_PAUSE_DURATION: 3000, // milliseconds
```

## Troubleshooting

### Common Issues

1. **Players not moving**: Check if player position is correctly assigned
2. **Ball not syncing**: Verify ball authority assignment
3. **Input lag**: Check network connection and throttling settings
4. **Disconnections**: Implement reconnection logic

### Debug Logging

Enable debug logging to troubleshoot issues:

```javascript
// In gameLogicService.ts
private logEvent(type: string, message: string, data?: any): void {
  console.log(`[${type.toUpperCase()}] ${message}`, data || '');
}
```

## Future Enhancements

Potential improvements for the system:

1. **Lag compensation**: Implement client-side prediction
2. **Reconnection handling**: Automatic reconnection with state recovery
3. **Spectator mode**: Allow players to watch matches
4. **Tournament system**: Multi-round tournament support
5. **Custom rooms**: Private rooms with custom settings
6. **Replay system**: Match replay functionality

This implementation provides a robust foundation for real-time multiplayer gameplay with proper synchronization, error handling, and performance optimizations. 