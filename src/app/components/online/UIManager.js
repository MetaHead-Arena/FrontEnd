import { GAME_CONFIG } from "../config.js";
import { logger } from "../../lib/logger.js";

/**
 * UIManager - Manages all UI elements and overlays with enhanced UX
 */
export class UIManager {
  constructor(scene, gameState, effects) {
    this.scene = scene;
    this.gameState = gameState;
    this.effects = effects;
    
    // UI elements
    this.timerText = null;
    this.scoreText = null;
    this.positionText = null;
    this.overlayGroup = null;
    this.connectionOverlay = null;
    
    // Loading state
    this.isLoading = false;
    this.loadingElements = [];
    
    // Message system
    this.messageQueue = [];
    this.currentMessage = null;
    
    // Responsive scaling
    this.uiScale = this.calculateUIScale();
    
    logger.debug("UIManager initialized");
  }
  
  calculateUIScale() {
    const baseWidth = GAME_CONFIG.CANVAS_WIDTH;
    const baseHeight = GAME_CONFIG.CANVAS_HEIGHT;
    const scaleX = this.scene.cameras.main.width / baseWidth;
    const scaleY = this.scene.cameras.main.height / baseHeight;
    return Math.min(scaleX, scaleY, 1.2); // Cap at 120%
  }
  
  // Main UI creation
  createUI() {
    logger.debug("Creating main UI elements");
    
    this.createTimer();
    this.createScoreboard();
    this.createPositionIndicator();
    this.createPlayerStats();
    
    // Set up responsive scaling
    this.setupResponsiveScaling();
    
    logger.debug("Main UI created");
  }
  
  createTimer() {
    const fontSize = Math.floor(GAME_CONFIG.UI.FONT_SIZES.TIMER * this.uiScale);
    
    this.timerText = this.scene.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.UI.TIMER_Y,
      "Time: 01:00",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: fontSize + "px",
        fill: "#ffffff",
        backgroundColor: "#222222",
        padding: { x: 16 * this.uiScale, y: 8 * this.uiScale },
        align: "center",
        fontStyle: "bold",
      }
    )
    .setOrigin(0.5, 0.5)
    .setDepth(3000)
    .setScrollFactor(0);
    
    // Add subtle glow effect
    this.timerText.setStroke("#000000", 3);
  }
  
  createScoreboard() {
    const fontSize = Math.floor(GAME_CONFIG.UI.FONT_SIZES.SCORE * this.uiScale);
    
    this.scoreText = this.scene.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.UI.SCORE_Y,
      "🔵 Player 1: 0  -  Player 2: 0 🔴",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: fontSize + "px",
        fill: "#ffffff",
        backgroundColor: "#1976d2",
        padding: { x: 18 * this.uiScale, y: 8 * this.uiScale },
        align: "center",
        fontStyle: "bold",
      }
    )
    .setOrigin(0.5, 0.5)
    .setDepth(3000)
    .setScrollFactor(0);
    
    this.scoreText.setStroke("#000000", 3);
  }
  
  createPositionIndicator() {
    const fontSize = Math.floor(16 * this.uiScale);
    
    this.positionText = this.scene.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.UI.SCORE_Y + 60,
      `You are: ${this.scene.playerPosition || "Unknown"}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: fontSize + "px",
        fill: "#fde047",
        backgroundColor: "#000000",
        padding: { x: 12 * this.uiScale, y: 6 * this.uiScale },
        align: "center",
        fontStyle: "bold",
      }
    )
    .setOrigin(0.5, 0.5)
    .setDepth(3000)
    .setScrollFactor(0);
    
    this.positionText.setStroke("#000000", 2);
  }
  
  createPlayerStats() {
    const fontSize = Math.floor(16 * this.uiScale);
    
    // Player 1 indicator
    this.scene.add.text(20, 90, "🔵 Player 1", {
      fontFamily: '"Press Start 2P"',
      fontSize: fontSize + "px",
      fill: "#1976d2",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 1,
    })
    .setDepth(3000)
    .setScrollFactor(0);
    
    // Player 2 indicator
    this.scene.add.text(GAME_CONFIG.CANVAS_WIDTH - 20, 90, "🔴 Player 2", {
      fontFamily: '"Press Start 2P"',
      fontSize: fontSize + "px",
      fill: "#d32f2f",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 1,
    })
    .setOrigin(1, 0)
    .setDepth(3000)
    .setScrollFactor(0);
  }
  
  setupResponsiveScaling() {
    // Listen for window resize
    if (typeof window !== "undefined") {
      window.addEventListener('resize', this.handleResize.bind(this));
    }
  }
  
  handleResize() {
    const newScale = this.calculateUIScale();
    
    if (Math.abs(newScale - this.uiScale) > 0.1) {
      this.uiScale = newScale;
      this.updateUIScale();
    }
  }
  
  updateUIScale() {
    // Update font sizes and padding for responsive scaling
    if (this.timerText) {
      const fontSize = Math.floor(GAME_CONFIG.UI.FONT_SIZES.TIMER * this.uiScale);
      this.timerText.setFontSize(fontSize + "px");
    }
    
    if (this.scoreText) {
      const fontSize = Math.floor(GAME_CONFIG.UI.FONT_SIZES.SCORE * this.uiScale);
      this.scoreText.setFontSize(fontSize + "px");
    }
    
    if (this.positionText) {
      const fontSize = Math.floor(16 * this.uiScale);
      this.positionText.setFontSize(fontSize + "px");
    }
  }
  
  // Update methods
  updateTimer(gameTime) {
    if (!this.timerText) return;
    
    const timeInt = Math.floor(gameTime);
    const minutes = Math.floor(timeInt / 60);
    const seconds = timeInt % 60;
    const timeString = `⏱️ ${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    
    // Dynamic color based on time remaining
    let timerColor = "#ffffff";
    let backgroundColor = "#222222";
    
    if (gameTime <= 10) {
      timerColor = "#ff0000";
      backgroundColor = "#330000";
      
      // Add pulsing effect for critical time
      if (!this.timerText.getData("pulsing")) {
        this.timerText.setData("pulsing", true);
        this.scene.tweens.add({
          targets: this.timerText,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: "Power2"
        });
      }
    } else if (gameTime <= 30) {
      timerColor = "#ffaa00";
      backgroundColor = "#332200";
    } else if (this.timerText.getData("pulsing")) {
      // Remove pulsing effect
      this.timerText.setData("pulsing", false);
      this.scene.tweens.killTweensOf(this.timerText);
      this.timerText.setScale(1, 1);
    }
    
    this.timerText.setStyle({
      fill: timerColor,
      backgroundColor,
      padding: { x: 16 * this.uiScale, y: 8 * this.uiScale }
    });
    
    this.timerText.setText(timeString);
  }
  
  updateScore(player1Score, player2Score) {
    if (!this.scoreText) return;
    
    const scoreString = `🔵 Player 1: ${player1Score}  -  Player 2: ${player2Score} 🔴`;
    this.scoreText.setText(scoreString);
    
    // Add score change animation
    this.scene.tweens.add({
      targets: this.scoreText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 200,
      yoyo: true,
      ease: "Power2"
    });
  }
  
  updatePosition(playerPosition) {
    if (!this.positionText) return;
    
    const side = playerPosition === "player1" ? "Left Side" : "Right Side";
    this.positionText.setText(
      `${playerPosition.toUpperCase()} | Move: WASD/Arrows | Kick: Space/Enter/Shift | Position: ${side}`
    );
  }
  
  // Loading screens
  showLoadingScreen() {
    logger.debug("Showing loading screen");
    
    this.clearOverlays();
    this.overlayGroup = this.scene.add.group();
    this.isLoading = true;
    
    // Semi-transparent background
    const overlay = this.createOverlay(0.8);
    this.overlayGroup.add(overlay);
    
    // Animated loading elements
    this.createLoadingAnimation();
    
    logger.debug("Loading screen displayed");
  }
  
  createLoadingAnimation() {
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // Main loading text
    const loadingText = this.scene.add.text(
      centerX,
      centerY - 100,
      "CONNECTING TO GAME",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(24 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(loadingText);
    
    // Animated dots
    const dots = this.scene.add.text(
      centerX,
      centerY - 50,
      "...",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(20 * this.uiScale) + "px",
        fill: "#fde047",
        stroke: "#000000",
        strokeThickness: 2,
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(dots);
    
    // Animate dots
    this.scene.tweens.add({
      targets: dots,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Power2"
    });
    
    // Spinning ball
    const ball = this.scene.add.image(centerX, centerY + 50, "ball")
      .setScale(0.4 * this.uiScale)
      .setDepth(10000);
    this.overlayGroup.add(ball);
    
    this.scene.tweens.add({
      targets: ball,
      rotation: Math.PI * 2,
      duration: 1000,
      repeat: -1,
      ease: "Linear"
    });
    
    // Progress bar background
    const progressBg = this.scene.add.rectangle(
      centerX, 
      centerY + 120,
      300 * this.uiScale,
      20 * this.uiScale,
      0x333333
    )
    .setDepth(10000);
    this.overlayGroup.add(progressBg);
    
    // Progress bar fill
    const progressFill = this.scene.add.rectangle(
      centerX - (150 * this.uiScale),
      centerY + 120,
      0,
      16 * this.uiScale,
      0x22c55e
    )
    .setOrigin(0, 0.5)
    .setDepth(10001);
    this.overlayGroup.add(progressFill);
    
    // Animate progress bar
    this.scene.tweens.add({
      targets: progressFill,
      width: 300 * this.uiScale,
      duration: 3000,
      ease: "Power2"
    });
    
    this.loadingElements = [loadingText, dots, ball, progressBg, progressFill];
  }
  
  // Ready screen
  showReadyButton() {
    logger.debug("Showing ready button");
    
    this.clearOverlays();
    this.overlayGroup = this.scene.add.group();
    
    const overlay = this.createOverlay(0.7);
    this.overlayGroup.add(overlay);
    
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // Game ready title
    const titleText = this.scene.add.text(
      centerX,
      centerY - 120,
      "GAME READY!",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(48 * this.uiScale) + "px",
        fill: "#00ff00",
        stroke: "#000000",
        strokeThickness: 6,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(titleText);
    
    // Player info
    const playerInfo = this.scene.add.text(
      centerX,
      centerY - 40,
      `You are: ${this.scene.playerPosition?.toUpperCase() || "UNKNOWN"}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(20 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(playerInfo);
    
    // Controls info
    const side = this.scene.playerPosition === "player1" ? "Left Side" : "Right Side";
    const controlsText = this.scene.add.text(
      centerX,
      centerY,
      `Controls: WASD or Arrow Keys\nKick: Space / Enter / Shift\nPosition: ${side}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(14 * this.uiScale) + "px",
        fill: "#fde047",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(controlsText);
    
    // Ready button
    const button = this.createButton(
      centerX,
      centerY + 80,
      300 * this.uiScale,
      80 * this.uiScale,
      "READY UP!",
      0x22c55e,
      () => this.scene.handleReady()
    );
    
    this.overlayGroup.add(button.bg);
    this.overlayGroup.add(button.text);
    
    // Add pulsing effect to title
    this.scene.tweens.add({
      targets: titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Power2"
    });
  }
  
  // Waiting screen
  showWaitingScreen() {
    logger.debug("Showing waiting screen");
    
    this.clearOverlays();
    this.overlayGroup = this.scene.add.group();
    
    const overlay = this.createOverlay(0.85);
    this.overlayGroup.add(overlay);
    
    this.updateWaitingScreen();
  }
  
  updateWaitingScreen() {
    if (!this.overlayGroup) return;
    
    // Clear previous content (keep overlay)
    this.overlayGroup.children.entries.slice(1).forEach(child => child.destroy());
    
    const readyStatus = this.gameState.getReadyStatus();
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // Status message
    let statusMessage = "Waiting for players...";
    if (readyStatus.isPlayerReady && readyStatus.isOpponentReady) {
      statusMessage = "Both players ready! Starting game...";
    } else if (readyStatus.isPlayerReady && !readyStatus.isOpponentReady) {
      statusMessage = "Waiting for opponent to ready up...";
    } else if (!readyStatus.isPlayerReady && readyStatus.isOpponentReady) {
      statusMessage = "Opponent ready! You need to ready up!";
    }
    
    const statusText = this.scene.add.text(
      centerX,
      centerY - 50,
      statusMessage,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(20 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10001);
    this.overlayGroup.add(statusText);
    
    // Ready status display
    const localPosition = this.scene.playerPosition || "player1";
    const remotePosition = localPosition === "player1" ? "player2" : "player1";
    const localStatus = readyStatus.isPlayerReady ? "✅" : "⏳";
    const remoteStatus = readyStatus.isOpponentReady ? "✅" : "⏳";
    
    const readyText = this.scene.add.text(
      centerX,
      centerY + 30,
      `${localStatus} ${localPosition.toUpperCase()} READY\n${remoteStatus} ${remotePosition.toUpperCase()} READY`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(16 * this.uiScale) + "px",
        fill: "#ffff00",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10001);
    this.overlayGroup.add(readyText);
    
    // Cancel button if not ready
    if (!readyStatus.isPlayerReady) {
      const cancelButton = this.createButton(
        centerX,
        centerY + 120,
        200 * this.uiScale,
        50 * this.uiScale,
        "CANCEL",
        0xff4444,
        () => this.cancelReady()
      );
      
      this.overlayGroup.add(cancelButton.bg);
      this.overlayGroup.add(cancelButton.text);
    }
  }
  
  updateReadyScreen(readyStatus) {
    this.updateWaitingScreen();
  }
  
  cancelReady() {
    // Reset ready state
    this.gameState.setPlayerReady(false);
    
    // Show ready button again
    this.showReadyButton();
    
    logger.debug("Ready cancelled");
  }
  
  // Countdown
  showCountdown(onComplete) {
    logger.debug("Showing countdown");
    
    this.clearOverlays();
    this.overlayGroup = this.scene.add.group();
    
    const overlay = this.createOverlay(0.9);
    this.overlayGroup.add(overlay);
    
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // "Game Starting" text
    const startingText = this.scene.add.text(
      centerX,
      centerY - 100,
      "GAME STARTING",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(32 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(startingText);
    
    // Countdown number
    const countdownText = this.scene.add.text(
      centerX,
      centerY,
      "3",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(72 * this.uiScale) + "px",
        fill: "#fde047",
        stroke: "#000000",
        strokeThickness: 8,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(countdownText);
    
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      
      if (count > 0) {
        countdownText.setText(count.toString());
        
        // Animate number
        this.scene.tweens.add({
          targets: countdownText,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 100,
          yoyo: true,
          ease: "Power2"
        });
      } else {
        countdownText.setText("GO!");
        countdownText.setFill("#00ff00");
        
        // Final animation
        this.scene.tweens.add({
          targets: countdownText,
          scaleX: 2,
          scaleY: 2,
          alpha: 0,
          duration: 500,
          ease: "Power2",
          onComplete: () => {
            this.clearOverlays();
            onComplete?.();
          }
        });
        
        clearInterval(countdownInterval);
      }
    }, 1000);
  }
  
  // Goal screens
  showGoalPause(scorer) {
    logger.debug("Showing goal pause", { scorer });
    
    this.clearOverlays();
    this.overlayGroup = this.scene.add.group();
    
    const overlay = this.createOverlay(0.8);
    this.overlayGroup.add(overlay);
    
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // Goal text
    const goalText = this.scene.add.text(
      centerX,
      centerY,
      "GOAL!",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(64 * this.uiScale) + "px",
        fill: "#fde047",
        stroke: "#000000",
        strokeThickness: 8,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(goalText);
    
    // Scorer info
    const scorerText = this.scene.add.text(
      centerX,
      centerY + 80,
      `${scorer.toUpperCase()} SCORES!`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(24 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(scorerText);
    
    // Animate goal text
    this.scene.tweens.add({
      targets: goalText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: "Power2"
    });
  }
  
  hideGoalPause() {
    this.clearOverlays();
  }
  
  // Game end screen
  showGameEndScreen(data) {
    logger.debug("Showing game end screen", data);
    
    this.clearOverlays();
    this.overlayGroup = this.scene.add.group();
    
    const overlay = this.createOverlay(0.9);
    this.overlayGroup.add(overlay);
    
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // Game Over title
    const titleText = this.scene.add.text(
      centerX,
      centerY - 150,
      "GAME OVER",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(48 * this.uiScale) + "px",
        fill: "#ff4444",
        stroke: "#000000",
        strokeThickness: 6,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(titleText);
    
    // Winner announcement
    let winnerText = "DRAW!";
    let winnerColor = "#ffaa00";
    
    if (data.winner === "player1") {
      winnerText = "PLAYER 1 WINS!";
      winnerColor = "#1976d2";
    } else if (data.winner === "player2") {
      winnerText = "PLAYER 2 WINS!";
      winnerColor = "#d32f2f";
    }
    
    const winner = this.scene.add.text(
      centerX,
      centerY - 80,
      winnerText,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(32 * this.uiScale) + "px",
        fill: winnerColor,
        stroke: "#000000",
        strokeThickness: 4,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(winner);
    
    // Final score
    const score = this.gameState.getScore();
    const scoreText = this.scene.add.text(
      centerX,
      centerY - 20,
      `Final Score: ${score.player1} - ${score.player2}`,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(24 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(scoreText);
    
    // Game details
    const reasonText = data.reason === "time-up" ? "Time's Up!" : `Game ended: ${data.reason}`;
    const details = this.scene.add.text(
      centerX,
      centerY + 30,
      reasonText,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(18 * this.uiScale) + "px",
        fill: "#cccccc",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(details);
    
    // Buttons
    this.createGameEndButtons(centerX, centerY + 80);
    
    // Animate winner text
    this.scene.tweens.add({
      targets: winner,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Power2"
    });
  }
  
  createGameEndButtons(x, y) {
    const buttonWidth = 280 * this.uiScale;
    const buttonHeight = 60 * this.uiScale;
    const spacing = 80 * this.uiScale;
    
    // Rematch button
    const rematchButton = this.createButton(
      x,
      y,
      buttonWidth,
      buttonHeight,
      "REQUEST REMATCH",
      0x22c55e,
      () => this.scene.network?.requestRematch()
    );
    
    this.overlayGroup.add(rematchButton.bg);
    this.overlayGroup.add(rematchButton.text);
    
    // Leave button
    const leaveButton = this.createButton(
      x,
      y + spacing,
      buttonWidth,
      buttonHeight,
      "LEAVE ROOM",
      0xdc2626,
      () => this.scene.restartGame()
    );
    
    this.overlayGroup.add(leaveButton.bg);
    this.overlayGroup.add(leaveButton.text);
  }
  
  // Pause screen
  showPauseScreen() {
    logger.debug("Showing pause screen");
    
    this.clearOverlays();
    this.overlayGroup = this.scene.add.group();
    
    const overlay = this.createOverlay(0.8);
    this.overlayGroup.add(overlay);
    
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // Pause title
    const titleText = this.scene.add.text(
      centerX,
      centerY - 100,
      "GAME PAUSED",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(40 * this.uiScale) + "px",
        fill: "#ffaa00",
        stroke: "#000000",
        strokeThickness: 6,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(titleText);
    
    // Waiting message
    const waitingText = this.scene.add.text(
      centerX,
      centerY - 30,
      "Waiting for opponent to resume...",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(18 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(waitingText);
    
    // Resume button
    const resumeButton = this.createButton(
      centerX,
      centerY + 40,
      250 * this.uiScale,
      50 * this.uiScale,
      "RESUME GAME",
      0x22c55e,
      () => this.scene.resumeGame()
    );
    
    this.overlayGroup.add(resumeButton.bg);
    this.overlayGroup.add(resumeButton.text);
    
    // Leave button
    const leaveButton = this.createButton(
      centerX,
      centerY + 110,
      250 * this.uiScale,
      50 * this.uiScale,
      "LEAVE ROOM",
      0xdc2626,
      () => this.scene.restartGame()
    );
    
    this.overlayGroup.add(leaveButton.bg);
    this.overlayGroup.add(leaveButton.text);
    
    // Pulse effect
    this.scene.tweens.add({
      targets: titleText,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Power2"
    });
  }
  
  hidePauseScreen() {
    this.clearOverlays();
  }
  
  // Connection status
  showConnectionError() {
    this.showMessage("Connection error. Please check your internet.", 5000, "#ff4444");
  }
  
  showConnectionLost() {
    this.showConnectionOverlay();
  }
  
  hideConnectionLost() {
    this.hideConnectionOverlay();
  }
  
  showConnectionOverlay() {
    if (this.connectionOverlay) return;
    
    this.connectionOverlay = this.scene.add.group();
    
    const overlay = this.scene.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT,
      0x000000,
      0.8
    )
    .setDepth(20000);
    this.connectionOverlay.add(overlay);
    
    const titleText = this.scene.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2 - 50,
      "CONNECTION LOST",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(32 * this.uiScale) + "px",
        fill: "#ff4444",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(20001);
    this.connectionOverlay.add(titleText);
    
    const statusText = this.scene.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2 + 20,
      "Attempting to reconnect...",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(18 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(20001);
    this.connectionOverlay.add(statusText);
    
    // Animate status text
    this.scene.tweens.add({
      targets: statusText,
      alpha: 0.5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Power2"
    });
  }
  
  hideConnectionOverlay() {
    if (this.connectionOverlay) {
      this.connectionOverlay.clear(true, true);
      this.connectionOverlay = null;
    }
  }
  
  // Error messages
  showErrorMessage(message, onClose) {
    this.clearOverlays();
    this.overlayGroup = this.scene.add.group();
    
    const overlay = this.createOverlay(0.9);
    this.overlayGroup.add(overlay);
    
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    // Error title
    const titleText = this.scene.add.text(
      centerX,
      centerY - 80,
      "ERROR",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(32 * this.uiScale) + "px",
        fill: "#ff4444",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(titleText);
    
    // Error message
    const messageText = this.scene.add.text(
      centerX,
      centerY - 20,
      message,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(16 * this.uiScale) + "px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
        wordWrap: { width: 400 * this.uiScale }
      }
    )
    .setOrigin(0.5)
    .setDepth(10000);
    this.overlayGroup.add(messageText);
    
    // OK button
    const okButton = this.createButton(
      centerX,
      centerY + 60,
      200 * this.uiScale,
      50 * this.uiScale,
      "OK",
      0x666666,
      () => {
        this.clearOverlays();
        onClose?.();
      }
    );
    
    this.overlayGroup.add(okButton.bg);
    this.overlayGroup.add(okButton.text);
  }
  
  // Message system
  showMessage(text, duration = 3000, color = "#ffffff") {
    // Queue message if one is already showing
    if (this.currentMessage) {
      this.messageQueue.push({ text, duration, color });
      return;
    }
    
    this.displayMessage(text, duration, color);
  }
  
  displayMessage(text, duration, color) {
    const messageText = this.scene.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      150,
      text,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: Math.floor(18 * this.uiScale) + "px",
        fill: color,
        backgroundColor: "#000000",
        padding: { x: 20 * this.uiScale, y: 10 * this.uiScale },
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
        wordWrap: { width: 400 * this.uiScale }
      }
    )
    .setOrigin(0.5)
    .setDepth(15000)
    .setAlpha(0);
    
    this.currentMessage = messageText;
    
    // Animate in
    this.scene.tweens.add({
      targets: messageText,
      alpha: 1,
      duration: 300,
      ease: "Power2"
    });
    
    // Auto-remove
    this.scene.time.delayedCall(duration, () => {
      if (messageText && messageText.active) {
        this.scene.tweens.add({
          targets: messageText,
          alpha: 0,
          duration: 500,
          ease: "Power2",
          onComplete: () => {
            if (messageText && messageText.active) {
              messageText.destroy();
            }
            this.currentMessage = null;
            
            // Show next message if queued
            if (this.messageQueue.length > 0) {
              const next = this.messageQueue.shift();
              this.displayMessage(next.text, next.duration, next.color);
            }
          }
        });
      }
    });
  }
  
  // Utility methods
  createOverlay(alpha = 0.8) {
    return this.scene.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT,
      0x000000,
      alpha
    )
    .setDepth(9999);
  }
  
  createButton(x, y, width, height, text, color, onClick) {
    const bg = this.scene.add.rectangle(x, y, width, height, color, 1)
      .setStrokeStyle(4, this.lightenColor(color, -20))
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    
    const buttonText = this.scene.add.text(x, y, text, {
      fontFamily: '"Press Start 2P"',
      fontSize: Math.floor(16 * this.uiScale) + "px",
      fill: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
      align: "center"
    })
    .setOrigin(0.5)
    .setDepth(10002);
    
    // Hover effects
    bg.on("pointerover", () => {
      bg.setFillStyle(this.lightenColor(color, 20));
      this.scene.tweens.add({
        targets: [bg, buttonText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: "Power2"
      });
    });
    
    bg.on("pointerout", () => {
      bg.setFillStyle(color);
      this.scene.tweens.add({
        targets: [bg, buttonText],
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
        ease: "Power2"
      });
    });
    
    bg.on("pointerdown", onClick);
    buttonText.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    
    return { bg, text: buttonText };
  }
  
  lightenColor(color, amount) {
    // Simple color manipulation (you might want a more robust solution)
    const r = Math.max(0, Math.min(255, ((color >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((color >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (color & 255) + amount));
    return (r << 16) | (g << 8) | b;
  }
  
  clearOverlays() {
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }
  }
  
  // Update method
  update() {
    // Update any animated UI elements
    if (this.isLoading) {
      // Update loading animations if needed
    }
  }
  
  // Cleanup
  cleanup() {
    logger.debug("UIManager cleanup");
    
    this.clearOverlays();
    this.hideConnectionOverlay();
    
    // Clear message queue
    this.messageQueue = [];
    if (this.currentMessage) {
      this.currentMessage.destroy();
      this.currentMessage = null;
    }
    
    // Remove event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener('resize', this.handleResize.bind(this));
    }
    
    // Reset UI elements
    this.timerText = null;
    this.scoreText = null;
    this.positionText = null;
    this.overlayGroup = null;
    this.connectionOverlay = null;
    this.isLoading = false;
    this.loadingElements = [];
    
    logger.debug("UIManager cleanup complete");
  }
}