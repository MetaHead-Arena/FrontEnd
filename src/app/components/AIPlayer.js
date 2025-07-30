import { Player } from "./Player.js";
import { GAME_CONFIG } from "./config.js";
import { logger } from "../lib/logger.js";
import { aiConfigManager } from "../lib/ai-config.js";

/**
 * Advanced AI Player with Strategic Thinking and Multiple Difficulty Levels
 * Features intelligent positioning, game state awareness, and dynamic strategies
 */
export class AIPlayer extends Player {
  constructor(scene, x, y, playerKey, personality = null, difficulty = null) {
    super(scene, x, y, playerKey, "ai", "ai-head");

    // Load AI configuration
    this.aiConfig = aiConfigManager.getAIConfig(personality, difficulty);
    this.personality = this.aiConfig.personality.name;
    this.difficulty = this.aiConfig.difficulty.id;
    
    // Core AI Properties from configuration
    this.reactionTime = this.aiConfig.difficulty.reactionTime;
    this.predictionAccuracy = this.aiConfig.difficulty.predictionAccuracy;
    this.mistakeChance = this.aiConfig.difficulty.mistakeChance;
    this.lastDecisionTime = 0;
    this.lastActionTime = 0;
    this.minActionDelay = Math.max(30, this.reactionTime * 0.3);
    
    // Strategic State from configuration
    this.currentStrategy = this.aiConfig.behaviors.preferredStrategy;
    this.strategyTimer = 0;
    this.strategyDuration = 6000 / this.aiConfig.difficulty.adaptationSpeed;
    
    // Position and Movement
    this.targetPosition = { x: x, y: y };
    this.homePosition = { x: x, y: y };
    this.optimalPosition = { x: x, y: y };
    this.isRepositioning = false;
    this.movementPrediction = { x: 0, y: 0 };
    
    // Ball Tracking and Prediction
    this.ballTracker = {
      positions: [], // Historical ball positions
      maxHistory: Math.floor(10 * this.aiConfig.difficulty.adaptationSpeed),
      predictedPosition: { x: 0, y: 0 },
      predictedGoalTime: 0,
      isApproachingGoal: false,
      threatLevel: 0, // 0-1, how dangerous the ball's trajectory is
      lookAheadTime: this.aiConfig.difficulty.maxLookAhead
    };
    
    // Decision Making from configuration
    this.decisionWeights = { ...this.aiConfig.weights };
    
    // Performance Tracking
    this.performance = {
      shotsAttempted: 0,
      shotsScored: 0,
      ballTouches: 0,
      goalsDefended: 0,
      averageReactionTime: this.reactionTime,
      mistakesMade: 0,
      adaptations: 0,
      gameStartTime: Date.now()
    };
    
    // Advanced Behaviors from configuration
    this.behaviors = {
      ...this.aiConfig.behaviors,
      isAggressive: this.aiConfig.behaviors.aggressionLevel > 0.7,
      isDefensive: this.aiConfig.behaviors.riskTolerance < 0.4,
      isWaitingForOpportunity: false,
      lastBallTouch: 0,
      anticipationMode: false
    };

    // Game data collection for learning
    this.gameData = {
      actions: [],
      positioning: [],
      timing: [],
      decisions: [],
      outcomes: []
    };

    logger.debug("Advanced AI Player initialized", {
      playerKey,
      personality: this.personality,
      difficulty: this.difficulty,
      strategy: this.currentStrategy,
      reactionTime: this.reactionTime,
      predictionAccuracy: this.predictionAccuracy
    });
  }

  update() {
    super.update();
    
    const currentTime = this.scene.time.now;
    
    // Update ball tracking
    this.updateBallTracking();
    
    // Update strategy
    this.updateStrategy(currentTime);
    
    // Execute AI decisions
    if (currentTime - this.lastDecisionTime >= this.reactionTime) {
      this.makeDecision(currentTime);
      this.lastDecisionTime = currentTime;
    }
    
    // Continuous movement adjustments
    this.makeContinuousAdjustments();
    
    // Update performance metrics
    this.updatePerformanceMetrics();
  }

  /**
   * Main decision-making engine
   */
  makeDecision(currentTime) {
    if (!this.scene.ball || this.scene.gameOver || this.scene.pausedForGoal) {
      return;
    }

    // Prevent action spam
    if (currentTime - this.lastActionTime < this.minActionDelay) {
      return;
    }

    const gameState = this.analyzeGameState();
    const action = this.selectOptimalAction(gameState);
    
    this.executeAction(action, gameState);
    this.lastActionTime = currentTime;
    
    logger.physics("AI decision made", {
      strategy: this.currentStrategy,
      action: action.type,
      threatLevel: this.ballTracker.threatLevel,
      gameState: gameState.phase
    });
  }

  /**
   * Analyze current game state for decision making
   */
  analyzeGameState() {
    const ball = this.scene.ball;
    const player = this.sprite;
    const gameTime = this.scene.gameTime;
    const score = {
      ai: this.scene.player2Score,
      human: this.scene.player1Score
    };

    // Calculate distances and positions
    const distanceToBall = Phaser.Math.Distance.Between(
      player.x, player.y, ball.x, ball.y
    );
    
    const ballToGoalDistance = Phaser.Math.Distance.Between(
      ball.x, ball.y, 
      GAME_CONFIG.CANVAS_WIDTH - 100, // AI's goal
      GAME_CONFIG.FIELD.GROUND_Y - 200
    );

    const ballToOpponentGoalDistance = Phaser.Math.Distance.Between(
      ball.x, ball.y,
      100, // Human's goal
      GAME_CONFIG.FIELD.GROUND_Y - 200
    );

    // Determine game phase
    let phase = "midgame";
    if (gameTime > GAME_CONFIG.GAME_DURATION * 0.8) {
      phase = "endgame";
    } else if (gameTime > GAME_CONFIG.GAME_DURATION * 0.6) {
      phase = "lategame";
    } else if (gameTime > GAME_CONFIG.GAME_DURATION * 0.3) {
      phase = "midgame";
    } else {
      phase = "earlygame";
    }

    // Calculate field control
    const fieldControl = this.calculateFieldControl();
    
    return {
      ball: {
        position: { x: ball.x, y: ball.y },
        velocity: { x: ball.body.velocity.x, y: ball.body.velocity.y },
        distanceToPlayer: distanceToBall,
        distanceToAIGoal: ballToGoalDistance,
        distanceToOpponentGoal: ballToOpponentGoalDistance,
        isApproachingAIGoal: this.ballTracker.isApproachingGoal,
        threatLevel: this.ballTracker.threatLevel
      },
      player: {
        position: { x: player.x, y: player.y },
        velocity: { x: player.body.velocity.x, y: player.body.velocity.y },
        isOnGround: this.isOnGround,
        canShoot: distanceToBall < 150
      },
      game: {
        phase,
        timeRemaining: gameTime,
        scoreAdvantage: score.ai - score.human,
        fieldControl,
        isPowerPlayActive: this.isPowerPlayActive()
      }
    };
  }

  /**
   * Select the optimal action based on game state
   */
  selectOptimalAction(gameState) {
    const actions = this.generatePossibleActions(gameState);
    let bestAction = actions[0];
    let bestScore = -Infinity;

    for (const action of actions) {
      const score = this.evaluateAction(action, gameState);
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Generate possible actions based on current situation
   */
  generatePossibleActions(gameState) {
    const actions = [];
    const { ball, player, game } = gameState;

    // Basic movement actions
    actions.push({ type: "moveToOptimalPosition", priority: 0.6 });
    
    // Ball-related actions
    if (ball.distanceToPlayer < 200) {
      actions.push({ type: "chaseBall", priority: 0.8 });
      
      if (ball.distanceToPlayer < 150) {
        actions.push({ type: "interceptBall", priority: 0.9 });
      }
      
      if (ball.distanceToPlayer < 80) {
        actions.push({ type: "kickBall", priority: 0.7 });
        
        // Shooting opportunities
        if (this.canShootAtGoal(gameState)) {
          actions.push({ type: "shootAtGoal", priority: 1.2 });
        }
        
        // Defensive clear
        if (ball.threatLevel > 0.7) {
          actions.push({ type: "defensiveClear", priority: 1.1 });
        }
      }
    }

    // Strategic positioning
    if (ball.isApproachingAIGoal && ball.distanceToAIGoal < 300) {
      actions.push({ type: "defendGoal", priority: 1.5 });
    }

    // Opportunistic actions
    if (game.fieldControl > 0.6) {
      actions.push({ type: "pressureOpponent", priority: 0.8 });
    }

    // Special situation actions
    if (game.phase === "endgame" && game.scoreAdvantage < 0) {
      actions.push({ type: "desperateAttack", priority: 1.3 });
    } else if (game.phase === "endgame" && game.scoreAdvantage > 0) {
      actions.push({ type: "conservativeDefense", priority: 1.1 });
    }

    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate the potential value of an action
   */
  evaluateAction(action, gameState) {
    let score = action.priority;
    const { ball, player, game } = gameState;

    // Apply strategy modifiers
    switch (this.currentStrategy) {
      case "defensive":
        if (action.type.includes("defend") || action.type.includes("clear")) {
          score *= 1.3;
        }
        if (action.type.includes("attack") || action.type.includes("shoot")) {
          score *= 0.7;
        }
        break;
        
      case "offensive":
        if (action.type.includes("shoot") || action.type.includes("attack")) {
          score *= 1.4;
        }
        if (action.type.includes("defend")) {
          score *= 0.8;
        }
        break;
        
      case "aggressive":
        if (action.type.includes("pressure") || action.type.includes("intercept")) {
          score *= 1.5;
        }
        break;
    }

    // Apply difficulty modifiers
    score *= this.getDifficultyMultiplier();
    
    // Apply game state modifiers
    if (game.phase === "endgame") {
      if (game.scoreAdvantage < 0 && action.type.includes("shoot")) {
        score *= 1.5; // Desperate for goals
      } else if (game.scoreAdvantage > 0 && action.type.includes("defend")) {
        score *= 1.3; // Protect the lead
      }
    }

    // Add some randomness for unpredictability
    score += (Math.random() - 0.5) * 0.2;

    return score;
  }

  /**
   * Execute the selected action
   */
  executeAction(action, gameState) {
    // Apply difficulty-based mistakes
    const finalAction = this.applyMistakeToAction(action);
    
    // Record action for learning
    this.recordAction(finalAction.type, {
      gamePhase: gameState.game.phase,
      threatLevel: gameState.ball.threatLevel,
      scoreAdvantage: gameState.game.scoreAdvantage,
      ballDistance: gameState.ball.distanceToPlayer
    });

    const { ball, player } = gameState;

    switch (finalAction.type) {
      case "chaseBall":
        this.chaseBall();
        break;
        
      case "interceptBall":
        this.interceptBall();
        break;
        
      case "shootAtGoal":
        this.executeSmartShoot(gameState);
        break;
        
      case "kickBall":
        this.executeStrategicKick(gameState);
        break;
        
      case "defendGoal":
        this.defendGoal();
        break;
        
      case "defensiveClear":
        this.executeDefensiveClear();
        break;
        
      case "moveToOptimalPosition":
        this.moveToOptimalPosition();
        break;
        
      case "pressureOpponent":
        this.pressureOpponent();
        break;
        
      case "desperateAttack":
        this.executeDesperateAttack();
        break;
        
      case "conservativeDefense":
        this.executeConservativeDefense();
        break;
        
      default:
        this.moveToOptimalPosition();
    }

    // Record positioning effectiveness
    this.recordPositioning(
      { x: player.position.x, y: player.position.y },
      { x: ball.position.x, y: ball.position.y },
      this.evaluatePositioningEffectiveness(gameState)
    );
  }

  /**
   * Evaluate how effective the current positioning is
   */
  evaluatePositioningEffectiveness(gameState) {
    let effectiveness = 0.5; // Base effectiveness
    
    const { ball, player } = gameState;
    
    // Distance to ball consideration
    if (ball.distanceToPlayer < 100) {
      effectiveness += 0.2; // Good ball control range
    } else if (ball.distanceToPlayer > 300) {
      effectiveness -= 0.2; // Too far from action
    }
    
    // Defensive positioning
    if (ball.threatLevel > 0.7) {
      const goalDistance = Phaser.Math.Distance.Between(
        player.position.x, player.position.y,
        GAME_CONFIG.CANVAS_WIDTH - 100, GAME_CONFIG.FIELD.GROUND_Y - 200
      );
      if (goalDistance < 200) {
        effectiveness += 0.3; // Good defensive position
      }
    }
    
    // Offensive positioning
    if (ball.distanceToOpponentGoal < 300 && ball.distanceToPlayer < 150) {
      effectiveness += 0.2; // Good offensive position
    }
    
    return Math.max(0, Math.min(1, effectiveness));
  }

  /**
   * Advanced ball chasing with prediction
   */
  chaseBall() {
    const ball = this.scene.ball;
    const player = this.sprite;
    const currentSpeed = this.getCurrentSpeed();
    
    // Predict ball position using configurable look-ahead time
    const prediction = this.predictBallPosition(this.ballTracker.lookAheadTime * 0.5);
    const targetX = prediction.x;
    
    // Smart movement with acceleration
    const distanceToTarget = Math.abs(player.x - targetX);
    let speedMultiplier = 1.0;
    
    if (distanceToTarget > 200) {
      speedMultiplier = 1.0; // Full speed for long distances
    } else if (distanceToTarget > 100) {
      speedMultiplier = 0.8; // Moderate speed for medium distances
    } else {
      speedMultiplier = 0.6; // Careful approach for close distances
    }

    if (player.x < targetX - 15) {
      player.setVelocityX(currentSpeed * speedMultiplier);
    } else if (player.x > targetX + 15) {
      player.setVelocityX(-currentSpeed * speedMultiplier);
    } else {
      player.setVelocityX(player.body.velocity.x * 0.9); // Smooth stop
    }

    // Smart jumping
    this.executeSmartJump(ball);
  }

  /**
   * Intercept ball trajectory
   */
  interceptBall() {
    const ball = this.scene.ball;
    const player = this.sprite;
    
    // Calculate interception point
    const interceptionPoint = this.calculateInterceptionPoint();
    
    if (interceptionPoint) {
      this.moveTowardsTarget(interceptionPoint.x, interceptionPoint.y);
      
      // Jump if ball is above
      if (interceptionPoint.y < player.y - 30 && this.isOnGround) {
        this.executeJump();
      }
    } else {
      // Fallback to regular chase
      this.chaseBall();
    }
  }

  /**
   * Execute smart shooting with target prediction
   */
  executeSmartShoot(gameState) {
    const { ball } = gameState;
    const goalCenter = { x: 100, y: GAME_CONFIG.FIELD.GROUND_Y - 250 };
    
    // Calculate optimal shooting angle
    const shootingAngle = this.calculateOptimalShootingAngle(goalCenter);
    
    // Adjust power based on distance to goal
    const distanceToGoal = Phaser.Math.Distance.Between(
      ball.position.x, ball.position.y,
      goalCenter.x, goalCenter.y
    );
    
    let power = 1.0;
    if (distanceToGoal > 400) {
      power = 1.5; // More power for long shots
    } else if (distanceToGoal < 200) {
      power = 0.8; // Less power for close shots
    }
    
    this.shoot(power);
    this.performance.shotsAttempted++;
    
    logger.game("AI shot executed", {
      distance: distanceToGoal,
      power,
      angle: shootingAngle
    });
  }

  /**
   * Execute strategic ball kick based on situation
   */
  executeStrategicKick(gameState) {
    const { ball, game } = gameState;
    
    if (ball.threatLevel > 0.8) {
      // Defensive clear - kick away from goal
      this.kickTowardsTarget(GAME_CONFIG.CANVAS_WIDTH / 2, ball.position.y);
    } else if (game.fieldControl > 0.6) {
      // Offensive kick - towards opponent goal
      this.kickTowardsTarget(100, GAME_CONFIG.FIELD.GROUND_Y - 200);
    } else {
      // Neutral kick - maintain possession
      this.kickTowardsTarget(ball.position.x + 100, ball.position.y);
    }
  }

  /**
   * Defend the goal area
   */
  defendGoal() {
    const goalCenter = { 
      x: GAME_CONFIG.CANVAS_WIDTH - 150, 
      y: GAME_CONFIG.FIELD.GROUND_Y - 200 
    };
    
    // Position between ball and goal
    const ball = this.scene.ball;
    const defensivePosition = this.calculateDefensivePosition(ball, goalCenter);
    
    this.moveTowardsTarget(defensivePosition.x, defensivePosition.y);
    
    // React to incoming ball
    if (ball.body.velocity.x > 100 && ball.x > GAME_CONFIG.CANVAS_WIDTH / 2) {
      this.anticipatedDefense();
    }
  }

  /**
   * Execute defensive clear
   */
  executeDefensiveClear() {
    // Clear ball towards center field or opponent side
    const clearTarget = {
      x: GAME_CONFIG.CANVAS_WIDTH * 0.3,
      y: GAME_CONFIG.FIELD.GROUND_Y - 100
    };
    
    this.kickTowardsTarget(clearTarget.x, clearTarget.y, 1.2);
  }

  /**
   * Move to optimal position based on game state
   */
  moveToOptimalPosition() {
    const optimalPos = this.calculateOptimalPosition();
    this.moveTowardsTarget(optimalPos.x, optimalPos.y);
  }

  /**
   * Calculate optimal position based on ball and game state
   */
  calculateOptimalPosition() {
    const ball = this.scene.ball;
    const goalCenter = { 
      x: GAME_CONFIG.CANVAS_WIDTH - 150, 
      y: GAME_CONFIG.FIELD.GROUND_Y - 200 
    };
    
    // Base position depends on strategy
    let baseX, baseY;
    
    switch (this.currentStrategy) {
      case "defensive":
        baseX = GAME_CONFIG.CANVAS_WIDTH * 0.75;
        baseY = GAME_CONFIG.FIELD.GROUND_Y;
        break;
        
      case "offensive":
        baseX = GAME_CONFIG.CANVAS_WIDTH * 0.45;
        baseY = GAME_CONFIG.FIELD.GROUND_Y;
        break;
        
      case "aggressive":
        baseX = Math.min(ball.x + 150, GAME_CONFIG.CANVAS_WIDTH * 0.6);
        baseY = GAME_CONFIG.FIELD.GROUND_Y;
        break;
        
      default: // balanced
        baseX = GAME_CONFIG.CANVAS_WIDTH * 0.6;
        baseY = GAME_CONFIG.FIELD.GROUND_Y;
    }
    
    // Adjust based on ball position
    const ballInfluence = 0.3;
    const adjustedX = baseX + (ball.x - baseX) * ballInfluence;
    
    return {
      x: Math.max(400, Math.min(GAME_CONFIG.CANVAS_WIDTH - 100, adjustedX)),
      y: baseY
    };
  }

  /**
   * Update AI strategy based on game state
   */
  updateStrategy(currentTime) {
    if (currentTime - this.strategyTimer < this.strategyDuration) {
      return;
    }

    const gameState = this.analyzeGameState();
    let newStrategy = this.currentStrategy;

    // Strategy decision logic
    if (gameState.ball.threatLevel > 0.8) {
      newStrategy = "defensive";
    } else if (gameState.game.scoreAdvantage < -1 && gameState.game.phase === "endgame") {
      newStrategy = "aggressive";
    } else if (gameState.game.scoreAdvantage > 1 && gameState.game.phase === "endgame") {
      newStrategy = "defensive";
    } else if (gameState.game.fieldControl > 0.7) {
      newStrategy = "offensive";
    } else {
      newStrategy = "balanced";
    }

    if (newStrategy !== this.currentStrategy) {
      this.currentStrategy = newStrategy;
      this.adaptToStrategy();
      
      logger.game("AI strategy changed", {
        oldStrategy: this.currentStrategy,
        newStrategy,
        threatLevel: gameState.ball.threatLevel,
        scoreAdvantage: gameState.game.scoreAdvantage
      });
    }

    this.strategyTimer = currentTime;
  }

  /**
   * Adapt AI parameters to current strategy
   */
  adaptToStrategy() {
    switch (this.currentStrategy) {
      case "defensive":
        this.decisionWeights.goalDefense = 2.0;
        this.decisionWeights.ballChase = 0.8;
        this.decisionWeights.opportunisticShot = 0.6;
        break;
        
      case "offensive":
        this.decisionWeights.opportunisticShot = 1.8;
        this.decisionWeights.ballChase = 1.2;
        this.decisionWeights.goalDefense = 0.9;
        break;
        
      case "aggressive":
        this.decisionWeights.ballChase = 1.5;
        this.decisionWeights.opportunisticShot = 1.6;
        this.reactionTime = Math.max(20, this.reactionTime * 0.8);
        break;
        
      default: // balanced
        this.decisionWeights.goalDefense = 1.5;
        this.decisionWeights.ballChase = 1.0;
        this.decisionWeights.opportunisticShot = 1.2;
    }
  }

  /**
   * Update ball tracking and prediction
   */
  updateBallTracking() {
    const ball = this.scene.ball;
    if (!ball) return;

    // Add current position to history
    this.ballTracker.positions.push({
      x: ball.x,
      y: ball.y,
      vx: ball.body.velocity.x,
      vy: ball.body.velocity.y,
      time: this.scene.time.now
    });

    // Limit history size
    if (this.ballTracker.positions.length > this.ballTracker.maxHistory) {
      this.ballTracker.positions.shift();
    }

    // Update predictions
    this.updateBallPredictions();
    this.updateThreatLevel();
  }

  /**
   * Update ball position predictions
   */
  updateBallPredictions() {
    const ball = this.scene.ball;
    const prediction = this.predictBallPosition(this.ballTracker.lookAheadTime);
    
    this.ballTracker.predictedPosition = prediction;
    
    // Check if ball is approaching AI goal
    const goalX = GAME_CONFIG.CANVAS_WIDTH - 100;
    this.ballTracker.isApproachingGoal = 
      ball.body.velocity.x > 50 && 
      ball.x > GAME_CONFIG.CANVAS_WIDTH * 0.6 &&
      prediction.x > goalX - 200;
  }

  /**
   * Calculate threat level of current ball trajectory
   */
  updateThreatLevel() {
    const ball = this.scene.ball;
    const goalCenter = { 
      x: GAME_CONFIG.CANVAS_WIDTH - 100, 
      y: GAME_CONFIG.FIELD.GROUND_Y - 250 
    };

    let threat = 0;

    // Distance threat
    const distanceToGoal = Phaser.Math.Distance.Between(
      ball.x, ball.y, goalCenter.x, goalCenter.y
    );
    threat += Math.max(0, 1 - distanceToGoal / 500);

    // Velocity threat
    if (ball.body.velocity.x > 100) {
      threat += ball.body.velocity.x / 500;
    }

    // Direction threat
    const angleToGoal = Phaser.Math.Angle.Between(
      ball.x, ball.y, goalCenter.x, goalCenter.y
    );
    const ballAngle = Math.atan2(ball.body.velocity.y, ball.body.velocity.x);
    const angleDiff = Math.abs(angleToGoal - ballAngle);
    
    if (angleDiff < Math.PI / 4) { // Within 45 degrees
      threat += 0.5;
    }

    this.ballTracker.threatLevel = Math.min(1, threat);
  }

  /**
   * Predict ball position after given time with accuracy based on difficulty
   */
  predictBallPosition(timeAhead) {
    const ball = this.scene.ball;
    
    // Simple physics prediction with gravity and drag
    const gravity = GAME_CONFIG.GRAVITY / 60; // Per frame
    const dragX = 0.98;
    const dragY = 0.99;
    
    let x = ball.x;
    let y = ball.y;
    let vx = ball.body.velocity.x;
    let vy = ball.body.velocity.y;
    
    const frames = timeAhead * 60; // Convert to frames
    
    for (let i = 0; i < frames; i++) {
      x += vx / 60;
      y += vy / 60;
      
      vx *= dragX;
      vy = vy * dragY + gravity;
      
      // Simple boundary check
      if (y > GAME_CONFIG.FIELD.GROUND_Y) {
        y = GAME_CONFIG.FIELD.GROUND_Y;
        vy = -vy * 0.7; // Bounce
      }
    }
    
    // Apply prediction accuracy - add noise based on difficulty
    const accuracyNoise = 1 - this.predictionAccuracy;
    const noiseRange = timeAhead * 100 * accuracyNoise; // More noise for longer predictions
    
    const noisyX = x + (Math.random() - 0.5) * noiseRange;
    const noisyY = y + (Math.random() - 0.5) * noiseRange * 0.5; // Less Y noise
    
    return { 
      x: Math.max(0, Math.min(GAME_CONFIG.CANVAS_WIDTH, noisyX)),
      y: Math.max(0, Math.min(GAME_CONFIG.FIELD.GROUND_Y, noisyY))
    };
  }

  /**
   * Set AI difficulty level
   */
  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    
    switch (difficulty) {
      case "easy":
        this.reactionTime = 200;
        this.predictionAccuracy = 0.5;
        this.decisionWeights.ballChase = 0.8;
        this.decisionWeights.goalDefense = 1.0;
        this.decisionWeights.opportunisticShot = 0.6;
        this.strategyDuration = 8000;
        break;
        
      case "medium":
        this.reactionTime = 120;
        this.predictionAccuracy = 0.75;
        this.decisionWeights.ballChase = 1.0;
        this.decisionWeights.goalDefense = 1.3;
        this.decisionWeights.opportunisticShot = 0.9;
        this.strategyDuration = 6000;
        break;
        
      case "hard":
        this.reactionTime = 80;
        this.predictionAccuracy = 0.9;
        this.decisionWeights.ballChase = 1.2;
        this.decisionWeights.goalDefense = 1.5;
        this.decisionWeights.opportunisticShot = 1.3;
        this.strategyDuration = 4000;
        break;
        
      case "expert":
        this.reactionTime = 50;
        this.predictionAccuracy = 0.95;
        this.decisionWeights.ballChase = 1.4;
        this.decisionWeights.goalDefense = 1.8;
        this.decisionWeights.opportunisticShot = 1.6;
        this.strategyDuration = 3000;
        break;
    }
    
    logger.info("AI difficulty set", {
      difficulty,
      reactionTime: this.reactionTime,
      predictionAccuracy: this.predictionAccuracy
    });
  }

  /**
   * Helper Methods
   */
  
  getDifficultyMultiplier() {
    const multipliers = {
      easy: 0.7,
      medium: 1.0,
      hard: 1.3,
      expert: 1.6
    };
    return multipliers[this.difficulty] || 1.0;
  }

  canShootAtGoal(gameState) {
    const { ball } = gameState;
    const goalCenter = { x: 100, y: GAME_CONFIG.FIELD.GROUND_Y - 250 };
    
    return ball.distanceToOpponentGoal < 400 && 
           ball.distanceToPlayer < 120 &&
           this.hasLineOfSight(ball.position, goalCenter);
  }

  hasLineOfSight(from, to) {
    // Simplified line of sight check
    // In a more complex implementation, this would check for obstacles
    return true;
  }

  calculateFieldControl() {
    const ball = this.scene.ball;
    const player = this.sprite;
    
    // Simple field control calculation based on position
    const ballControl = ball.x < GAME_CONFIG.CANVAS_WIDTH / 2 ? 0.3 : 0.7;
    const playerControl = player.x < GAME_CONFIG.CANVAS_WIDTH / 2 ? 0.2 : 0.8;
    
    return (ballControl + playerControl) / 2;
  }

  isPowerPlayActive() {
    // Check if any power-ups are active
    return this.hasActivePowerup || (this.scene.powerups && this.scene.powerups.length > 0);
  }

  calculateInterceptionPoint() {
    const ball = this.scene.ball;
    const player = this.sprite;
    
    // Calculate where player and ball paths will intersect
    const timeToIntercept = this.calculateInterceptionTime(ball, player);
    
    if (timeToIntercept > 0 && timeToIntercept < 2.0) {
      return this.predictBallPosition(timeToIntercept);
    }
    
    return null;
  }

  calculateInterceptionTime(ball, player) {
    // Simplified interception calculation
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const playerSpeed = this.getCurrentSpeed();
    return distance / playerSpeed * 0.016; // Convert to seconds
  }

  executeSmartJump(ball) {
    const player = this.sprite;
    
    if (!this.isOnGround) return;
    
    // Jump if ball is above
    if (ball.y < player.y - 60) {
      this.executeJump();
      return;
    }
    
    // Predictive jumping
    const prediction = this.predictBallPosition(0.3);
    if (prediction.y < player.y - 40 && 
        Math.abs(prediction.x - player.x) < 80) {
      this.executeJump();
    }
  }

  executeJump() {
    if (this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }
  }

  moveTowardsTarget(targetX, targetY) {
    const player = this.sprite;
    const currentSpeed = this.getCurrentSpeed();
    
    // Horizontal movement
    if (player.x < targetX - 20) {
      player.setVelocityX(currentSpeed);
    } else if (player.x > targetX + 20) {
      player.setVelocityX(-currentSpeed);
    } else {
      player.setVelocityX(player.body.velocity.x * 0.9);
    }
    
    // Vertical movement (jumping)
    if (targetY < player.y - 40 && this.isOnGround) {
      this.executeJump();
    }
  }

  kickTowardsTarget(targetX, targetY, powerMultiplier = 1.0) {
    // This would integrate with the existing kick system
    // For now, just use the basic shoot method
    this.shoot(powerMultiplier);
  }

  calculateOptimalShootingAngle(goalCenter) {
    const ball = this.scene.ball;
    return Math.atan2(goalCenter.y - ball.y, goalCenter.x - ball.x);
  }

  calculateDefensivePosition(ball, goalCenter) {
    // Position between ball and goal, slightly towards ball
    const midX = (ball.x + goalCenter.x) / 2;
    const midY = (ball.y + goalCenter.y) / 2;
    
    return {
      x: Math.max(GAME_CONFIG.CANVAS_WIDTH * 0.7, midX - 50),
      y: GAME_CONFIG.FIELD.GROUND_Y
    };
  }

  anticipatedDefense() {
    // Quick reaction to incoming ball
    if (this.isOnGround) {
      this.executeJump();
    }
  }

  pressureOpponent() {
    // Move aggressively towards the ball
    this.chaseBall();
  }

  executeDesperateAttack() {
    // Very aggressive ball chasing and shooting
    this.behaviors.isAggressive = true;
    this.chaseBall();
  }

  executeConservativeDefense() {
    // Focus on defending goal area
    this.defendGoal();
  }

  makeContinuousAdjustments() {
    // Fine-tune movement and positioning
    if (!this.scene.ball || this.scene.gameOver) return;
    
    const ball = this.scene.ball;
    const player = this.sprite;
    
    // Micro-adjustments based on ball movement
    if (this.ballTracker.threatLevel > 0.5) {
      const defensivePos = this.calculateDefensivePosition(ball, {
        x: GAME_CONFIG.CANVAS_WIDTH - 100,
        y: GAME_CONFIG.FIELD.GROUND_Y - 200
      });
      
      this.moveTowardsTarget(defensivePos.x, defensivePos.y);
    }
  }

  updatePerformanceMetrics() {
    // Track AI performance for potential difficulty adjustment
    const currentTime = this.scene.time.now;
    
    if (currentTime - this.performance.lastUpdate > 1000) {
      // Update metrics every second
      this.performance.lastUpdate = currentTime;
      
      // Calculate average reaction time
      this.performance.averageReactionTime = 
        (this.performance.averageReactionTime + this.reactionTime) / 2;
    }
  }

  getPerformanceStats() {
    return {
      ...this.performance,
      currentStrategy: this.currentStrategy,
      threatLevel: this.ballTracker.threatLevel,
      difficulty: this.difficulty
    };
  }

  /**
   * Record action for learning system
   */
  recordAction(actionType, context, outcome = null) {
    this.gameData.actions.push({
      type: actionType,
      context,
      outcome,
      timestamp: Date.now(),
      gameState: this.currentStrategy
    });

    // Limit action history size
    if (this.gameData.actions.length > 100) {
      this.gameData.actions.shift();
    }
  }

  /**
   * Record positioning data for learning
   */
  recordPositioning(position, ballPosition, effectiveness) {
    this.gameData.positioning.push({
      playerPosition: position,
      ballPosition,
      effectiveness,
      timestamp: Date.now(),
      strategy: this.currentStrategy
    });

    if (this.gameData.positioning.length > 50) {
      this.gameData.positioning.shift();
    }
  }

  /**
   * Simulate making a mistake based on difficulty
   */
  shouldMakeMistake() {
    return Math.random() < this.mistakeChance;
  }

  /**
   * Apply mistake to action (for more realistic AI)
   */
  applyMistakeToAction(action) {
    if (!this.shouldMakeMistake()) {
      return action;
    }

    this.performance.mistakesMade++;
    
    // Different types of mistakes
    const mistakeTypes = ['delay', 'wrong_direction', 'overreaction', 'missed_opportunity'];
    const mistakeType = mistakeTypes[Math.floor(Math.random() * mistakeTypes.length)];

    const mistakenAction = { ...action };

    switch (mistakeType) {
      case 'delay':
        // Add artificial delay
        setTimeout(() => {
          // Action will be delayed
        }, 100 + Math.random() * 200);
        break;
        
      case 'wrong_direction':
        // Occasionally move in wrong direction
        if (action.type === 'chaseBall' || action.type === 'moveToOptimalPosition') {
          mistakenAction.type = 'moveToOptimalPosition'; // Less optimal choice
        }
        break;
        
      case 'overreaction':
        // Overly aggressive response
        mistakenAction.priority *= 1.5;
        break;
        
      case 'missed_opportunity':
        // Miss obvious opportunities
        if (action.type === 'shootAtGoal') {
          mistakenAction.type = 'kickBall'; // Less optimal choice
        }
        break;
    }

    logger.debug("AI made mistake", {
      mistakeType,
      originalAction: action.type,
      mistakenAction: mistakenAction.type
    });

    return mistakenAction;
  }

  /**
   * Update AI configuration based on learning
   */
  updateFromLearning(gameEndData) {
    const learningData = {
      ...gameEndData,
      actions: this.gameData.actions,
      positioning: this.gameData.positioning,
      performance: this.performance,
      finalScore: gameEndData.score,
      gameDuration: Date.now() - this.performance.gameStartTime
    };

    // Apply learning adaptations
    const adaptations = aiConfigManager.applyAdaptiveChanges(learningData);
    
    if (adaptations && Object.keys(adaptations).length > 0) {
      // Update AI configuration
      this.aiConfig = aiConfigManager.getAIConfig();
      this.decisionWeights = { ...this.aiConfig.weights };
      this.behaviors = { ...this.aiConfig.behaviors };
      this.performance.adaptations++;
      
      logger.info("AI adapted based on learning", {
        adaptations,
        newPersonality: this.aiConfig.personality.name,
        newDifficulty: this.aiConfig.difficulty.name
      });
    }

    // Reset game data for next game
    this.gameData = {
      actions: [],
      positioning: [],
      timing: [],
      decisions: [],
      outcomes: []
    };
  }

  /**
   * Get comprehensive AI status for debugging
   */
  getAIStatus() {
    return {
      personality: this.personality,
      difficulty: this.difficulty,
      currentStrategy: this.currentStrategy,
      threatLevel: this.ballTracker.threatLevel,
      performance: this.getPerformanceStats(),
      config: {
        reactionTime: this.reactionTime,
        predictionAccuracy: this.predictionAccuracy,
        mistakeChance: this.mistakeChance,
        weights: this.decisionWeights
      },
      behaviors: this.behaviors,
      gameDataSize: {
        actions: this.gameData.actions.length,
        positioning: this.gameData.positioning.length
      }
    };
  }

  /**
   * Override setDifficulty to use configuration system
   */
  setDifficulty(difficulty) {
    aiConfigManager.setDifficulty(difficulty);
    this.aiConfig = aiConfigManager.getAIConfig();
    
    // Update AI properties from new config
    this.difficulty = this.aiConfig.difficulty.id;
    this.reactionTime = this.aiConfig.difficulty.reactionTime;
    this.predictionAccuracy = this.aiConfig.difficulty.predictionAccuracy;
    this.mistakeChance = this.aiConfig.difficulty.mistakeChance;
    this.minActionDelay = Math.max(30, this.reactionTime * 0.3);
    this.decisionWeights = { ...this.aiConfig.weights };
    this.ballTracker.lookAheadTime = this.aiConfig.difficulty.maxLookAhead;
    
    logger.info("AI difficulty updated via configuration system", {
      difficulty,
      reactionTime: this.reactionTime,
      predictionAccuracy: this.predictionAccuracy
    });
  }

  /**
   * Set AI personality using configuration system
   */
  setPersonality(personality) {
    aiConfigManager.setPersonality(personality);
    this.aiConfig = aiConfigManager.getAIConfig();
    
    // Update AI properties from new config
    this.personality = this.aiConfig.personality.name;
    this.currentStrategy = this.aiConfig.behaviors.preferredStrategy;
    this.decisionWeights = { ...this.aiConfig.weights };
    this.behaviors = {
      ...this.aiConfig.behaviors,
      isAggressive: this.aiConfig.behaviors.aggressionLevel > 0.7,
      isDefensive: this.aiConfig.behaviors.riskTolerance < 0.4,
      isWaitingForOpportunity: false,
      lastBallTouch: 0,
      anticipationMode: false
    };
    
    logger.info("AI personality updated via configuration system", {
      personality,
      description: this.aiConfig.personality.description,
      preferredStrategy: this.currentStrategy
    });
  }

  destroy() {
    // Record final game data before destruction
    if (this.scene && this.scene.gameOver) {
      const gameEndData = {
        won: this.scene.player2Score > this.scene.player1Score,
        score: {
          ai: this.scene.player2Score,
          human: this.scene.player1Score
        },
        goalsScored: this.scene.player2Score,
        goalsConceeded: this.scene.player1Score,
        missedShots: Math.max(0, this.performance.shotsAttempted - this.scene.player2Score),
        successfulShots: this.scene.player2Score,
        ballTouches: this.performance.ballTouches,
        mistakesMade: this.performance.mistakesMade
      };
      
      this.updateFromLearning(gameEndData);
    }

    super.destroy();
    logger.debug("Advanced AI Player destroyed", {
      performance: this.getPerformanceStats(),
      gameDataCollected: {
        actions: this.gameData.actions.length,
        positioning: this.gameData.positioning.length
      }
    });
  }
}
