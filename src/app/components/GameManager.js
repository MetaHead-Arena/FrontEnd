import { GAME_CONFIG } from "./config.js";

export class GameManager {
  constructor(scene) {
    this.scene = scene;
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.timerEvent = null;
  }

  resetGameState() {
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    if (this.timerEvent) {
      this.timerEvent.destroy();
    }
    this.timerEvent = null;
  }

  startGameTimer() {
    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true,
    });
  }

  updateTimer() {
    if (this.gameOver || this.scene.pausedForGoal || this.scene.isPaused) return;

    this.gameTime--;
    this.scene.uiManager.updateTimerDisplay(this.gameTime);

    if (this.gameTime <= 0) {
      this.handleGameEnd();
      return;
    }
  }

  handleGoal(scoringPlayer) {
    if (this.gameOver || this.scene.pausedForGoal) return;

    if (scoringPlayer === "player1") {
      this.player1Score++;
    } else {
      this.player2Score++;
    }

    const player2Name = this.scene.gameMode === "vsAI" ? "AI" : "Player 2";
    this.scene.uiManager.updateScoreDisplay(this.player1Score, this.player2Score, player2Name);
    this.scene.showEnhancedGoalEffect();

    if (this.scene.gameMode === "online" && this.scene.socketService) {
      this.scene.socketService.scoreGoal(scoringPlayer);
    }

    this.scene.pausedForGoal = true;
    this.scene.time.delayedCall(GAME_CONFIG.GOAL_PAUSE_DURATION, () => {
      this.scene.resetAfterGoal();
    });
  }

  handleGameEnd() {
    this.gameOver = true;
    if (this.timerEvent) this.timerEvent.destroy();

    let resultMessage = "";
    if (this.player1Score > this.player2Score) {
      resultMessage = "🏆 Player 1 Wins! 🎉";
    } else if (this.player2Score > this.player1Score) {
      const player2Name = this.scene.gameMode === "vsAI" ? "AI" : "Player 2";
      resultMessage = `🏆 ${player2Name} Wins! 🎉`;
    } else {
      resultMessage = "🤝 It's a Draw! 🤝";
    }

    this.scene.uiManager.showOverlay({
      message: resultMessage,
      buttons: [
        {
          text: "REMATCH",
          onClick: () => {
            if (this.scene.uiManager.overlayGroup) {
              this.scene.uiManager.overlayGroup.clear(true, true);
            }
            this.scene.scene.restart({ gameMode: this.scene.gameMode });
          },
        },
        {
          text: "BACK TO MAIN MENU",
          onClick: () => {
            if (this.scene.uiManager.overlayGroup) {
              this.scene.uiManager.overlayGroup.clear(true, true);
            }
            this.scene.restartGame();
          },
        },
      ],
    });

    if (this.scene.ball && this.scene.ball.body) this.scene.ball.body.setVelocity(0, 0);
    if (this.scene.player1 && this.scene.player1.sprite.body)
      this.scene.player1.sprite.body.setVelocity(0, 0);
    if (this.scene.player2 && this.scene.player2.sprite.body)
      this.scene.player2.sprite.body.setVelocity(0, 0);
  }
}
