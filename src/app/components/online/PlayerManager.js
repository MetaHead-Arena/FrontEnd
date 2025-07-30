import { Player } from "../Player.js";
import { RemotePlayer } from "../RemotePlayer.js";
import { GAME_CONFIG } from "../config.js";
import { logger } from "../../lib/logger.js";

/**
 * PlayerManager - Manages both local and remote players
 */
export class PlayerManager {
  constructor(scene, gameState, effects) {
    this.scene = scene;
    this.gameState = gameState;
    this.effects = effects;
    
    // Player instances
    this.localPlayer = null;
    this.remotePlayer = null;
    
    // Network reference (set later)
    this.network = null;
    
    // Input state tracking
    this.inputState = {
      left: false,
      right: false,
      up: false,
      kick: false
    };
    
    // Input throttling
    this.lastInputSend = 0;
    this.inputSendThreshold = 16; // 60 FPS
    
    // Position synchronization
    this.lastSentPosition = { x: 0, y: 0, time: 0 };
    this.positionSendThreshold = 2; // pixels
    this.lastPositionSendTime = 0;
    
    logger.debug("PlayerManager initialized");
  }
  
  setNetwork(network) {
    this.network = network;
  }
  
  // Player creation
  createPlayers(playerPosition) {
    logger.debug("Creating players", { playerPosition });
    
    try {
      this.validateSceneForPlayerCreation();
      
      if (playerPosition === "player1") {
        this.createPlayer1LocalPlayer2Remote();
      } else {
        this.createPlayer2LocalPlayer1Remote();
      }
      
      this.setupPlayerProperties();
      
      logger.debug("Players created successfully", {
        localPlayer: !!this.localPlayer,
        remotePlayer: !!this.remotePlayer,
        localPosition: this.localPlayer?.sprite?.x + "," + this.localPlayer?.sprite?.y,
        remotePosition: this.remotePlayer?.sprite?.x + "," + this.remotePlayer?.sprite?.y
      });
      
    } catch (error) {
      logger.error("Failed to create players", { error: error.message });
      throw error;
    }
  }
  
  validateSceneForPlayerCreation() {
    if (!this.scene.physics || !this.scene.physics.add) {
      throw new Error("Physics system not ready for player creation");
    }
    
    if (!this.scene.ground || !this.scene.leftWall || !this.scene.rightWall || !this.scene.topWall) {
      throw new Error("Scene boundaries not ready for player creation");
    }
  }
  
  createPlayer1LocalPlayer2Remote() {
    logger.debug("Creating local player1 (left side) and remote player2 (right side)");
    
    // Local player: player1 position, WASD controls, player1 sprite
    this.localPlayer = new Player(
      this.scene,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
      "PLAYER1",
      "wasd",
      "player1"
    );
    
    // Remote player: player2 position, player2 sprite
    this.remotePlayer = new RemotePlayer(
      this.scene,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
      "PLAYER2",
      "player2"
    );
  }
  
  createPlayer2LocalPlayer1Remote() {
    logger.debug("Creating local player2 (right side) and remote player1 (left side)");
    
    // Local player: player2 position, arrows controls, player2 sprite
    this.localPlayer = new Player(
      this.scene,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
      "PLAYER2",
      "arrows",
      "player2"
    );
    
    // Remote player: player1 position, player1 sprite
    this.remotePlayer = new RemotePlayer(
      this.scene,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
      "PLAYER1",
      "player1"
    );
  }
  
  setupPlayerProperties() {
    // Set online player properties
    if (this.localPlayer) {
      this.localPlayer.isOnlinePlayer = true;
      this.localPlayer.playerPosition = this.scene.playerPosition;
      this.localPlayer.socketService = this.network?.socketService;
    }
    
    if (this.remotePlayer) {
      this.remotePlayer.isOnlinePlayer = true;
      this.remotePlayer.remotePlayerPosition = 
        this.scene.playerPosition === "player1" ? "player2" : "player1";
    }
  }
  
  // Player position updates
  updatePlayerPosition(newPosition) {
    if (this.scene.playerPosition === newPosition) {
      logger.debug("Player position unchanged", { position: newPosition });
      return;
    }
    
    logger.info("Player position changed - rebuilding players", {
      from: this.scene.playerPosition,
      to: newPosition
    });
    
    // Clean up existing players
    this.cleanupPlayers();
    
    // Update scene position
    this.scene.playerPosition = newPosition;
    
    // Recreate players with new positions
    this.createPlayers(newPosition);
  }
  
  cleanupPlayers() {
    if (this.localPlayer) {
      try {
        this.localPlayer.destroy();
      } catch (error) {
        logger.warn("Error destroying local player", { error: error.message });
      }
      this.localPlayer = null;
    }
    
    if (this.remotePlayer) {
      try {
        this.remotePlayer.destroy();
      } catch (error) {
        logger.warn("Error destroying remote player", { error: error.message });
      }
      this.remotePlayer = null;
    }
  }
  
  // Input handling
  handleInput(input) {
    if (!this.gameState.canPlay() || !this.localPlayer) return;
    
    const hasChanged = this.checkInputChanges(input);
    
    if (hasChanged) {
      this.processLocalInput(input);
      this.sendInputToServer(input);
    }
    
    // Always send position updates (with throttling)
    this.sendPlayerPosition();
  }
  
  checkInputChanges(input) {
    const changed = 
      input.left !== this.inputState.left ||
      input.right !== this.inputState.right ||
      input.up !== this.inputState.up ||
      input.kick !== this.inputState.kick;
    
    // Update input state
    this.inputState = { ...input };
    
    return changed;
  }
  
  processLocalInput(input) {
    if (!this.localPlayer || !this.localPlayer.sprite || !this.localPlayer.sprite.body) return;
    
    const playerSpeed = GAME_CONFIG.PLAYER.BASE_SPEED * 2.0;
    const jumpPower = Math.abs(GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY);
    
    // Update ground state
    this.localPlayer.isOnGround = 
      this.localPlayer.sprite.body.touching.down || 
      this.localPlayer.sprite.body.onFloor();
    
    // Handle horizontal movement
    let horizontalVelocity = 0;
    
    if (input.left) {
      horizontalVelocity = -playerSpeed;
      this.localPlayer.direction = "left";
    } else if (input.right) {
      horizontalVelocity = playerSpeed;
      this.localPlayer.direction = "right";
    } else {
      this.localPlayer.direction = "idle";
      // Apply friction
      const currentVelX = this.localPlayer.sprite.body.velocity.x;
      this.localPlayer.sprite.body.setVelocityX(currentVelX * 0.8);
    }
    
    if (horizontalVelocity !== 0) {
      this.localPlayer.sprite.body.setVelocityX(horizontalVelocity);
    }
    
    // Handle jump
    if (input.up && this.localPlayer.isOnGround) {
      this.localPlayer.sprite.body.setVelocityY(-jumpPower);
      this.localPlayer.isOnGround = false;
      
      // Create jump effect
      this.effects?.createLandingEffect(
        this.localPlayer.sprite.x,
        this.localPlayer.sprite.y + this.localPlayer.sprite.height / 2
      );
    }
    
    // Handle kick
    if (input.kick) {
      this.performKick();
    }
    
    // Update player's update method if it exists
    if (typeof this.localPlayer.update === "function") {
      this.localPlayer.update();
    }
  }
  
  performKick() {
    if (!this.localPlayer || !this.scene.ballManager) return;
    
    const ball = this.scene.ballManager.ball;
    if (!ball) return;
    
    const distance = Phaser.Math.Distance.Between(
      this.localPlayer.sprite.x,
      this.localPlayer.sprite.y,
      ball.x,
      ball.y
    );
    
    if (distance < 100) {
      // Let BallManager handle the kick
      this.scene.ballManager.handlePlayerKick(this.localPlayer, ball);
      
      // Create kick effect
      this.effects?.createSparkleEffect(
        ball.x,
        ball.y
      );
    }
  }
  
  sendInputToServer(input) {
    if (!this.network || !this.network.isConnected()) return;
    
    const now = Date.now();
    if (now - this.lastInputSend < this.inputSendThreshold) return;
    
    // Send individual input events for better responsiveness
    if (input.left !== this.inputState.left) {
      this.network.sendMoveLeft(input.left);
    }
    if (input.right !== this.inputState.right) {
      this.network.sendMoveRight(input.right);
    }
    if (input.up !== this.inputState.up) {
      this.network.sendJump(input.up);
    }
    if (input.kick !== this.inputState.kick) {
      this.network.sendKick(input.kick);
    }
    
    this.lastInputSend = now;
  }
  
  sendPlayerPosition() {
    if (!this.network || !this.localPlayer || !this.localPlayer.sprite) return;
    
    const now = Date.now();
    
    // Throttle position updates
    if (now - this.lastPositionSendTime < 33) return; // 30 FPS max
    
    // Check if position changed significantly
    const dx = Math.abs(this.localPlayer.sprite.x - this.lastSentPosition.x);
    const dy = Math.abs(this.localPlayer.sprite.y - this.lastSentPosition.y);
    const timeSinceLastSend = now - this.lastSentPosition.time;
    
    const shouldSend = dx > this.positionSendThreshold || 
                      dy > this.positionSendThreshold || 
                      timeSinceLastSend > 100; // Force send every 100ms
    
    if (shouldSend) {
      const positionData = {
        position: this.scene.playerPosition,
        player: {
          x: this.localPlayer.sprite.x,
          y: this.localPlayer.sprite.y,
          velocityX: this.localPlayer.sprite.body ? this.localPlayer.sprite.body.velocity.x : 0,
          velocityY: this.localPlayer.sprite.body ? this.localPlayer.sprite.body.velocity.y : 0,
          direction: this.localPlayer.direction || "idle",
          isOnGround: this.localPlayer.isOnGround || false
        }
      };
      
      this.network.sendPlayerPosition(positionData);
      
      this.lastSentPosition = {
        x: this.localPlayer.sprite.x,
        y: this.localPlayer.sprite.y,
        time: now
      };
      this.lastPositionSendTime = now;
    }
  }
  
  // Remote player handling
  handleRemotePositionUpdate(data) {
    if (!this.remotePlayer || !this.remotePlayer.handlePositionUpdate) {
      logger.warn("Remote player not available for position update");
      return;
    }
    
    // Only process if it's not our own position
    if (data.position === this.scene.playerPosition) {
      return;
    }
    
    logger.debug("Updating remote player position", {
      position: data.position,
      x: data.player.x,
      y: data.player.y
    });
    
    this.remotePlayer.handlePositionUpdate(data.player);
  }
  
  handleRemoteInput(data) {
    if (!this.remotePlayer || !this.remotePlayer.handleRemoteInput) {
      logger.warn("Remote player not available for input handling");
      return;
    }
    
    // Only process remote player input
    if (data.playerId === this.network?.socketService?.getSocket()?.id) {
      return;
    }
    
    this.remotePlayer.handleRemoteInput(data);
  }
  
  updateRemotePlayer(playerData) {
    if (!this.remotePlayer || !this.remotePlayer.sprite) return;
    
    // Update remote player position
    this.remotePlayer.sprite.x = playerData.x || this.remotePlayer.sprite.x;
    this.remotePlayer.sprite.y = playerData.y || this.remotePlayer.sprite.y;
    
    if (this.remotePlayer.sprite.body && 
        playerData.velocityX !== undefined && 
        playerData.velocityY !== undefined) {
      this.remotePlayer.sprite.body.setVelocity(
        playerData.velocityX,
        playerData.velocityY
      );
    }
    
    // Update direction
    if (playerData.direction !== undefined) {
      this.remotePlayer.direction = playerData.direction;
    }
  }
  
  // Position management
  resetPositions() {
    logger.debug("Resetting player positions");
    
    if (this.localPlayer) {
      if (this.scene.playerPosition === "player1") {
        this.localPlayer.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x;
        this.localPlayer.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y;
      } else {
        this.localPlayer.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x;
        this.localPlayer.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;
      }
      this.localPlayer.sprite.body.setVelocity(0, 0);
    }
    
    if (this.remotePlayer) {
      if (this.scene.playerPosition === "player1") {
        this.remotePlayer.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x;
        this.remotePlayer.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;
      } else {
        this.remotePlayer.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x;
        this.remotePlayer.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y;
      }
      this.remotePlayer.sprite.body.setVelocity(0, 0);
    }
  }
  
  getLocalPlayerSide() {
    return this.scene.playerPosition === "player1" ? "left" : "right";
  }
  
  getRemotePlayerSide() {
    return this.scene.playerPosition === "player1" ? "right" : "left";
  }
  
  // Ball interaction
  getPlayerNearBall(ball) {
    if (!ball) return null;
    
    let nearestPlayer = null;
    let nearestDistance = Infinity;
    
    if (this.localPlayer && this.localPlayer.sprite) {
      const distance = Phaser.Math.Distance.Between(
        this.localPlayer.sprite.x,
        this.localPlayer.sprite.y,
        ball.x,
        ball.y
      );
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPlayer = this.localPlayer;
      }
    }
    
    if (this.remotePlayer && this.remotePlayer.sprite) {
      const distance = Phaser.Math.Distance.Between(
        this.remotePlayer.sprite.x,
        this.remotePlayer.sprite.y,
        ball.x,
        ball.y
      );
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPlayer = this.remotePlayer;
      }
    }
    
    return nearestDistance < 150 ? nearestPlayer : null;
  }
  
  // Update loop
  update() {
    // Update local player
    if (this.localPlayer && typeof this.localPlayer.update === "function") {
      // Update ground state
      if (this.localPlayer.sprite && this.localPlayer.sprite.body) {
        this.localPlayer.isOnGround = 
          this.localPlayer.sprite.body.touching.down || 
          this.localPlayer.sprite.body.onFloor();
      }
      
      this.localPlayer.update();
    }
    
    // Update remote player
    if (this.remotePlayer && typeof this.remotePlayer.update === "function") {
      // Update ground state
      if (this.remotePlayer.sprite && this.remotePlayer.sprite.body) {
        this.remotePlayer.isOnGround = 
          this.remotePlayer.sprite.body.touching.down || 
          this.remotePlayer.sprite.body.onFloor();
      }
      
      this.remotePlayer.update();
    }
  }
  
  // Ball touch tracking
  setBallToucher(player) {
    this.gameState.setBallToucher(player);
    
    // Visual feedback for ball touch
    if (player === this.localPlayer) {
      this.effects?.createSparkleEffect(
        player.sprite.x,
        player.sprite.y
      );
    }
  }
  
  // Player queries
  getLocalPlayer() {
    return this.localPlayer;
  }
  
  getRemotePlayer() {
    return this.remotePlayer;
  }
  
  getPlayerByPosition(position) {
    if (this.scene.playerPosition === position) {
      return this.localPlayer;
    } else {
      return this.remotePlayer;
    }
  }
  
  getBothPlayers() {
    return {
      local: this.localPlayer,
      remote: this.remotePlayer
    };
  }
  
  // Validation
  validatePlayers() {
    const errors = [];
    
    if (!this.localPlayer) {
      errors.push("Local player not created");
    } else if (!this.localPlayer.sprite) {
      errors.push("Local player sprite not created");
    } else if (!this.localPlayer.sprite.body) {
      errors.push("Local player physics body not created");
    }
    
    if (!this.remotePlayer) {
      errors.push("Remote player not created");
    } else if (!this.remotePlayer.sprite) {
      errors.push("Remote player sprite not created");
    } else if (!this.remotePlayer.sprite.body) {
      errors.push("Remote player physics body not created");
    }
    
    if (errors.length > 0) {
      logger.error("Player validation failed", { errors });
      return false;
    }
    
    return true;
  }
  
  // Debug info
  getDebugInfo() {
    return {
      hasLocalPlayer: !!this.localPlayer,
      hasRemotePlayer: !!this.remotePlayer,
      localPlayerPosition: this.localPlayer ? {
        x: this.localPlayer.sprite?.x,
        y: this.localPlayer.sprite?.y,
        velocityX: this.localPlayer.sprite?.body?.velocity?.x,
        velocityY: this.localPlayer.sprite?.body?.velocity?.y,
        direction: this.localPlayer.direction,
        isOnGround: this.localPlayer.isOnGround
      } : null,
      remotePlayerPosition: this.remotePlayer ? {
        x: this.remotePlayer.sprite?.x,
        y: this.remotePlayer.sprite?.y,
        velocityX: this.remotePlayer.sprite?.body?.velocity?.x,
        velocityY: this.remotePlayer.sprite?.body?.velocity?.y,
        direction: this.remotePlayer.direction,
        isOnGround: this.remotePlayer.isOnGround
      } : null,
      inputState: this.inputState,
      lastPositionSend: this.lastPositionSendTime,
      playerSide: this.getLocalPlayerSide(),
      scenePlayerPosition: this.scene.playerPosition
    };
  }
  
  // Cleanup
  cleanup() {
    logger.debug("PlayerManager cleanup");
    
    this.cleanupPlayers();
    
    // Reset state
    this.network = null;
    this.inputState = {
      left: false,
      right: false,
      up: false,
      kick: false
    };
    this.lastInputSend = 0;
    this.lastSentPosition = { x: 0, y: 0, time: 0 };
    this.lastPositionSendTime = 0;
    
    logger.debug("PlayerManager cleanup complete");
  }
}