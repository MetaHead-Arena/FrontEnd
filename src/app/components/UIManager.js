import { GAME_CONFIG } from "./config.js";

export class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.overlayGroup = null;
  }

  createUI() {
    this.createTimerDisplay();
    this.createScoreboard();
    this.createPlayerPositionIndicator();
    this.createGoalEffectText();
    this.createWinText();
    this.createInstructionsBar();
  }

  createTimerDisplay() {
    this.timerText = this.scene.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.TIMER_Y,
        "Time: 01:00",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: GAME_CONFIG.UI.FONT_SIZES.TIMER,
          fill: "#fff",
          backgroundColor: "#222",
          padding: { x: 16, y: 8 },
          align: "center",
          fontStyle: "bold",
          borderRadius: 12,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(3000);
  }

  createScoreboard() {
    this.scoreText = this.scene.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.SCORE_Y,
        "Player 1: 0  -  Player 2: 0",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: GAME_CONFIG.UI.FONT_SIZES.SCORE,
          fill: "#fff",
          backgroundColor: "#1976d2",
          padding: { x: 18, y: 8 },
          align: "center",
          fontStyle: "bold",
          borderRadius: 12,
          stroke: "#000",
          strokeThickness: 3,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(3000);
  }

  createPlayerPositionIndicator() {
    if (this.scene.gameMode === "online") {
      this.positionText = this.scene.add
        .text(
          GAME_CONFIG.CANVAS_WIDTH / 2,
          GAME_CONFIG.UI.SCORE_Y + 60,
          `You are: ${this.scene.playerPosition || "Unknown"}`,
          {
            fontFamily: '"Press Start 2P"',
            fontSize: "16px",
            fill: "#ffff00",
            backgroundColor: "#000",
            padding: { x: 12, y: 6 },
            align: "center",
            fontStyle: "bold",
            borderRadius: 8,
            stroke: "#000",
            strokeThickness: 2,
          }
        )
        .setOrigin(0.5, 0.5)
        .setDepth(3000);
    }
  }

  createGoalEffectText() {
    this.goalEffectText = this.scene.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        "GOAL!",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: GAME_CONFIG.UI.FONT_SIZES.GOAL_EFFECT,
          fill: "#ffff00",
          stroke: "#000000",
          strokeThickness: 4,
          align: "center",
          fontStyle: "bold",
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(4000)
      .setVisible(false);
  }

  createWinText() {
    this.winText = this.scene.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 300, "", {
        fontFamily: '"Press Start 2P"',
        fontSize: GAME_CONFIG.UI.FONT_SIZES.WIN_MESSAGE,
        fill: "#00ff00",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(4000)
      .setVisible(false);
  }

  createInstructionsBar() {
    this.instructionsBar = this.scene.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        900,
        "Player 1 WASD to move | Player 2 Arrows to move, ESC to pause",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "16px",
          fill: "#fff",
          backgroundColor: "#000",
          padding: { x: 16, y: 8 },
          align: "center",
          borderRadius: 12,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(3000);

    this.instructionsBar2 = this.scene.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        935,
        "Power ups will show randomly on the sky, catch them with the ball! 🌟",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "12px",
          fill: "#fde047",
          backgroundColor: "#222",
          padding: { x: 16, y: 8 },
          align: "center",
          borderRadius: 12,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(3000);
  }

  updateScoreDisplay(player1Score, player2Score, player2Name) {
    const scoreString = `🔵 Player 1: ${player1Score}  -  ${player2Name}: ${player2Score} 🔴`;
    this.scoreText.setText(scoreString);
    this.scoreText.setStyle({
      fontSize: GAME_CONFIG.UI.FONT_SIZES.SCORE,
      fill: "#ffffff",
      backgroundColor: "#1976d2",
      padding: { x: 18, y: 8 },
      align: "center",
      stroke: "#000",
      strokeThickness: 3,
    });
  }

  updateTimerDisplay(gameTime) {
    const gameTimeInt = Math.floor(gameTime);
    const minutes = Math.floor(gameTimeInt / 60);
    const seconds = gameTimeInt % 60;
    const timeString = `⏱️ ${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    let timerColor = "#ffffff";
    let backgroundColor = "#222222";
    if (gameTimeInt <= 10) {
      timerColor = "#ff0000";
      backgroundColor = "#330000";
      this.scene.tweens.add({
        targets: this.timerText,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 500,
        yoyo: true,
        ease: "Power2",
      });
    } else if (gameTimeInt <= 30) {
      timerColor = "#ffaa00";
      backgroundColor = "#332200";
    }

    this.timerText.setStyle({
      fontSize: GAME_CONFIG.UI.FONT_SIZES.TIMER,
      fill: timerColor,
      backgroundColor,
      padding: { x: 16, y: 8 },
      align: "center",
    });

    this.timerText.setText(timeString);
  }

  showOverlay({ message, buttons }) {
    if (this.overlayGroup && this.overlayGroup.children) {
      this.overlayGroup.clear(true, true);
    }
    this.overlayGroup = this.scene.add.group();

    const overlay = this.scene.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        GAME_CONFIG.CANVAS_WIDTH,
        GAME_CONFIG.CANVAS_HEIGHT,
        0x000000,
        0.8
      )
      .setDepth(9999);
    this.overlayGroup.add(overlay);

    const msgText = this.scene.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 80,
        message,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: GAME_CONFIG.UI.FONT_SIZES.WIN_MESSAGE,
          fill: "#fff",
          stroke: "#000",
          strokeThickness: 4,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(msgText);

    const buttonYStart = GAME_CONFIG.CANVAS_HEIGHT / 2 + 10;
    const buttonSpacing = 80;

    buttons.forEach((btn, i) => {
      const btnWidth = 260,
        btnHeight = 60;
      const btnX = GAME_CONFIG.CANVAS_WIDTH / 2;
      const btnY = buttonYStart + i * buttonSpacing;

      const btnRect = this.scene.add
        .rectangle(btnX, btnY, btnWidth, btnHeight, 0x22223a, 1)
        .setStrokeStyle(4, 0xfacc15)
        .setDepth(10001)
        .setInteractive({ useHandCursor: true });
      this.overlayGroup.add(btnRect);

      const btnText = this.scene.add
        .text(btnX, btnY, btn.text, {
          fontFamily: '"Press Start 2P"',
          fontSize: "20px",
          fill: "#fde047",
          align: "center",
          wordWrap: { width: btnWidth - 32, useAdvancedWrap: true },
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(10002);
      this.overlayGroup.add(btnText);

      btnRect.on("pointerdown", btn.onClick);
      btnText
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", btn.onClick);
    });
  }
}
