import { GAME_CONFIG, PIXEL_SPRITE } from "./config.js";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
  }

  preload() {
    this.load.image("pixel", PIXEL_SPRITE);
  }

  create() {
    console.log("[MenuScene] create called");
    // Background
    this.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT,
      GAME_CONFIG.COLORS.FIELD_GREEN
    );

    // Title
    this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 120, "HEAD BALL", {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.TITLE,
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 190, "Football Championship", {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.SUBTITLE,
        fill: "#ffff00",
        align: "center",
      })
      .setOrigin(0.5);

    // 2 Player Game button
    const twoPlayerButton = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 280, "2 PLAYER GAME", {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.START_BUTTON,
        fill: "#ffffff",
        backgroundColor: "#1976d2",
        padding: { x: 20, y: 10 },
        align: "center",
      })
      .setOrigin(0.5);

    twoPlayerButton.setInteractive();
    twoPlayerButton.on("pointerdown", () => {
      this.scene.stop("MenuScene");
      this.scene.start("GameScene", { gameMode: "2player" });
    });

    twoPlayerButton.on("pointerover", () => {
      twoPlayerButton.setStyle({ backgroundColor: "#2196f3" });
    });

    twoPlayerButton.on("pointerout", () => {
      twoPlayerButton.setStyle({ backgroundColor: "#1976d2" });
    });

    // Play vs AI button
    const vsAIButton = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 340, "PLAY VS AI", {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.START_BUTTON,
        fill: "#ffffff",
        backgroundColor: "#d32f2f",
        padding: { x: 20, y: 10 },
        align: "center",
      })
      .setOrigin(0.5);

    vsAIButton.setInteractive();
    vsAIButton.on("pointerdown", () => {
      this.scene.stop("MenuScene");
      this.scene.start("GameScene", { gameMode: "vsAI" });
    });

    vsAIButton.on("pointerover", () => {
      vsAIButton.setStyle({ backgroundColor: "#f44336" });
    });

    vsAIButton.on("pointerout", () => {
      vsAIButton.setStyle({ backgroundColor: "#d32f2f" });
    });

    // Instructions
    this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        420,
        "Player 1: Arrow Keys + Right Shift (Shoot) | Player 2: WASD Keys + Space (Shoot)",
        {
          fontSize: "14px",
          fill: "#ffffff",
          align: "center",
        }
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        480,
        "Score the most goals in 60 seconds to win!",
        {
          fontSize: GAME_CONFIG.UI.FONT_SIZES.MENU_FOOTER,
          fill: "#ffff00",
          align: "center",
        }
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        520,
        "Collect power-ups to boost your abilities!",
        {
          fontSize: "14px",
          fill: "#00ff88",
          align: "center",
        }
      )
      .setOrigin(0.5);
  }
}
