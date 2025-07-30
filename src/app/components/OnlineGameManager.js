import { GAME_CONFIG } from "./config.js";

export class OnlineGameManager {
  constructor(scene) {
    this.scene = scene;
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.timerEvent = null;
    this.rematchState = {
      player1Requested: false,
      player2Requested: false,
      timeoutActive: false,
    };
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
    this.rematchState = {
      player1Requested: false,
      player2Requested: false,
      timeoutActive: false,
    };
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

    const player2Name = "Player 2";
    this.scene.uiManager.updateScoreDisplay(this.player1Score, this.player2Score, player2Name);
    this.scene.showEnhancedGoalEffect();

    if (this.scene.socketService) {
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
    let winner = "draw";

    if (this.player1Score > this.player2Score) {
      winner = "player1";
      resultMessage =
        this.scene.playerPosition === "player1"
          ? "🏆 You Win! 🎉"
          : "💔 You Lost! 💔";
    } else if (this.player2Score > this.player1Score) {
      winner = "player2";
      resultMessage =
        this.scene.playerPosition === "player2"
          ? "🏆 You Win! 🎉"
          : "💔 You Lost! 💔";
    } else {
      resultMessage = "🤝 It's a Draw! 🤝";
    }

    if (this.scene.socketService) {
      const gameEndData = {
        finalScore: {
          player1: this.player1Score,
          player2: this.player2Score,
        },
        duration: GAME_CONFIG.GAME_DURATION - this.gameTime,
        winner: winner,
        endReason: "time_up",
      };
      this.scene.socketService.endGame(gameEndData);
    }

    this.scene.uiManager.showOverlay({
        message: resultMessage,
        buttons: [
            {
                text: "REQUEST REMATCH",
                onClick: () => this.scene.requestRematch(),
            },
            {
                text: "LEAVE ROOM",
                onClick: () => this.scene.leaveRoom(),
            },
        ],
    });
  }
}
