import { GAME_CONFIG } from "../config.js";
import { logger } from "../../lib/logger.js";

/**
 * GameStateManager - Manages all game state including scores, timer, ready states
 */
export class GameStateManager {
  constructor(scene) {
    this.scene = scene;
    
    // Game state
    this.gameStarted = false;
    this.gameOver = false;
    this.isPaused = false;
    this.pausedForGoal = false;
    
    // Scores
    this.player1Score = 0;
    this.player2Score = 0;
    
    // Timer
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.timerEvent = null;
    this.lastServerTimerUpdate = Date.now();
    this.serverTimerUpdateTimeout = 10000; // 10 seconds
    
    // Ready states
    this.isPlayerReady = false;
    this.isOpponentReady = false;
    
    // Goal management
    this.goalCooldown = 0;
    this.lastPlayerToTouchBall = null;
    
    // Dependencies (set later)
    this.ui = null;
    this.network = null;
    this.effects = null;
    
    logger.debug("GameStateManager initialized");
  }
  
  setDependencies(ui, network, effects) {
    this.ui = ui;
    this.network = network;
    this.effects = effects;
  }
  
  // Game lifecycle
  startGame(data) {
    logger.game("GameStateManager starting game", data);
    
    this.gameStarted = true;
    this.gameOver = false;
    this.isPaused = false;
    this.pausedForGoal = false;
    
    // Reset scores
    this.player1Score = 0;
    this.player2Score = 0;
    
    // Set game time
    this.gameTime = data.matchDuration || GAME_CONFIG.GAME_DURATION;
    
    // Reset ready states
    this.isPlayerReady = false;
    this.isOpponentReady = false;
    
    // Reset goal state
    this.goalCooldown = 0;
    this.lastPlayerToTouchBall = null;
    
    // Start timer system
    this.startTimer();
    
    logger.game("Game state initialized", {
      gameTime: this.gameTime,
      player1Score: this.player1Score,
      player2Score: this.player2Score
    });
  }
  
  endGame(data) {
    logger.game("GameStateManager ending game", data);
    
    this.gameOver = true;
    this.gameStarted = false;
    
    // Update final scores
    if (data.finalScore) {
      this.player1Score = data.finalScore.player1 || 0;
      this.player2Score = data.finalScore.player2 || 0;
    }
    
    // Stop timer
    this.stopTimer();
    
    logger.game("Game ended", {
      finalScore: { player1: this.player1Score, player2: this.player2Score },
      winner: data.winner,
      reason: data.reason
    });
  }
  
  // Timer management
  startTimer() {
    logger.debug("Starting server-synchronized timer system");
    
    if (!this.gameStarted) {
      logger.warn("Cannot start timer - game not started");
      return;
    }
    
    // Stop existing timer
    this.stopTimer();
    
    // Server sync timer - backup only, actual timer is server-driven
    this.timerEvent = this.scene.time.addEvent({
      delay: 5000, // 5 seconds - slow backup sync
      callback: this.syncTimerWithServer,
      callbackScope: this,
      loop: true
    });
    
    this.lastServerTimerUpdate = Date.now();
    
    logger.debug("Timer system started", { initialTime: this.gameTime });
  }
  
  stopTimer() {
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
      logger.debug("Timer stopped");
    }
  }
  
  syncTimerWithServer() {
    if (!this.gameStarted || this.gameOver) return;
    
    const timeSinceServerUpdate = Date.now() - this.lastServerTimerUpdate;
    
    // Request sync if we haven't heard from server
    if (timeSinceServerUpdate > this.serverTimerUpdateTimeout) {
      logger.warn("Timer sync timeout - requesting server update");
      
      if (this.network?.isConnected()) {
        this.network.requestTimerSync({
          localTime: this.gameTime
        });
      }
    }
  }
  
  updateTimer(timeRemaining) {
    const oldTime = this.gameTime;
    
    // Only update if significant difference
    if (Math.abs(timeRemaining - this.gameTime) > 0.5) {
      this.gameTime = timeRemaining;
      this.lastServerTimerUpdate = Date.now();
      
      // Update UI
      if (this.ui) {
        this.ui.updateTimer(this.gameTime);
      }
      
      logger.debug("Timer updated", { 
        from: oldTime, 
        to: this.gameTime,
        source: "server" 
      });
      
      // Check for warnings
      this.checkTimerWarnings();
    }
  }
  
  checkTimerWarnings() {
    if (this.gameTime <= 10 && this.gameTime > 0) {
      this.effects?.showTimerWarning("10 SECONDS REMAINING!", "#ff0000");
    } else if (this.gameTime <= 30 && this.gameTime > 10) {
      this.effects?.showTimerWarning("30 seconds remaining", "#ffaa00");
    }
    
    if (this.gameTime <= 0) {
      this.handleTimeUp();
    }
  }
  
  handleTimeUp() {
    if (this.gameOver) return;
    
    logger.game("Time up");
    
    this.gameTime = 0;
    this.stopTimer();
    
    // Show time up effect
    this.effects?.showTimerWarning("TIME'S UP!", "#ff0000", 2000);
    
    // Update UI
    if (this.ui) {
      this.ui.updateTimer(0);
    }
    
    // Server should handle game end
    logger.debug("Waiting for server to end game after time up");
  }
  
  // Score management
  addGoal(scorer) {
    if (this.gameOver || this.goalCooldown > 0) return;
    
    logger.game("Goal scored", { scorer });
    
    // Update score
    if (scorer === "player1") {
      this.player1Score++;
    } else if (scorer === "player2") {
      this.player2Score++;
    }
    
    // Set cooldown
    this.goalCooldown = GAME_CONFIG.GOAL_COOLDOWN;
    this.pausedForGoal = true;
    
    // Update UI
    if (this.ui) {
      this.ui.updateScore(this.player1Score, this.player2Score);
      this.ui.showGoalPause(scorer);
    }
    
    // Reset after delay
    this.scene.time.delayedCall(3000, () => {
      this.resetAfterGoal();
    });
    
    logger.game("Goal processed", {
      scorer,
      newScore: { player1: this.player1Score, player2: this.player2Score }
    });
  }
  
  resetAfterGoal() {
    this.pausedForGoal = false;
    this.goalCooldown = 0;
    
    // Clear goal UI
    if (this.ui) {
      this.ui.hideGoalPause();
    }
    
    logger.debug("Goal sequence completed");
  }
  
  // Ready state management
  setPlayerReady(ready) {
    this.isPlayerReady = ready;
    logger.debug("Player ready state changed", { ready });
  }
  
  handlePlayerReady(data) {
    if (this.gameStarted) {
      logger.warn("Ignoring ready event - game already started");
      return;
    }
    
    const eventPlayerPosition = data.playerPosition;
    const isOpponent = eventPlayerPosition !== this.scene.playerPosition;
    
    if (isOpponent) {
      this.isOpponentReady = true;
      logger.debug("Opponent ready", { position: eventPlayerPosition });
    } else {
      this.isPlayerReady = true;
      logger.debug("Player ready confirmed", { position: eventPlayerPosition });
    }
  }
  
  getReadyStatus() {
    return {
      isPlayerReady: this.isPlayerReady,
      isOpponentReady: this.isOpponentReady,
      bothReady: this.isPlayerReady && this.isOpponentReady,
      gameStarted: this.gameStarted
    };
  }
  
  // Ball touch tracking
  setBallToucher(player) {
    this.lastPlayerToTouchBall = player;
  }
  
  getBallToucher() {
    return this.lastPlayerToTouchBall;
  }
  
  // Game state queries
  canPlay() {
    return this.gameStarted && !this.gameOver && !this.isPaused && !this.pausedForGoal;
  }
  
  getScore() {
    return {
      player1: this.player1Score,
      player2: this.player2Score
    };
  }
  
  getGameTime() {
    return this.gameTime;
  }
  
  isGameActive() {
    return this.gameStarted && !this.gameOver;
  }
  
  // Pause management
  pauseGame() {
    if (this.gameOver || this.isPaused) return;
    
    this.isPaused = true;
    
    // Pause timer
    if (this.timerEvent) {
      this.timerEvent.paused = true;
    }
    
    logger.game("Game paused");
  }
  
  resumeGame() {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    
    // Resume timer
    if (this.timerEvent) {
      this.timerEvent.paused = false;
    }
    
    logger.game("Game resumed");
  }
  
  // Update loop
  update() {
    if (!this.gameStarted || this.gameOver) return;
    
    // Decrease goal cooldown
    if (this.goalCooldown > 0) {
      this.goalCooldown--;
    }
    
    // Update UI timer display periodically
    if (this.scene.frameCount % 60 === 0) { // Once per second
      if (this.ui) {
        this.ui.updateTimer(this.gameTime);
      }
    }
  }
  
  // Cleanup
  cleanup() {
    logger.debug("GameStateManager cleanup");
    
    this.stopTimer();
    
    // Reset state
    this.gameStarted = false;
    this.gameOver = false;
    this.isPaused = false;
    this.pausedForGoal = false;
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.isPlayerReady = false;
    this.isOpponentReady = false;
    this.goalCooldown = 0;
    this.lastPlayerToTouchBall = null;
    
    logger.debug("GameStateManager cleanup complete");
  }
  
  // Debug methods
  getDebugInfo() {
    return {
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      isPaused: this.isPaused,
      pausedForGoal: this.pausedForGoal,
      score: { player1: this.player1Score, player2: this.player2Score },
      gameTime: this.gameTime,
      readyStates: { 
        player: this.isPlayerReady, 
        opponent: this.isOpponentReady 
      },
      goalCooldown: this.goalCooldown,
      hasTimer: !!this.timerEvent,
      lastServerUpdate: this.lastServerTimerUpdate
    };
  }
}