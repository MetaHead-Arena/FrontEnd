import { logger } from './logger.js';

/**
 * AI Configuration and Personality System
 * Defines different AI personalities and adaptive behaviors
 */

export const AI_PERSONALITIES = {
  DEFENSIVE: {
    name: "Guardian",
    description: "Focuses on goal defense and conservative play",
    weights: {
      ballChase: 0.7,
      goalDefense: 2.0,
      positioning: 1.5,
      opportunisticShot: 0.4,
      powerPlay: 0.6
    },
    behaviors: {
      preferredStrategy: "defensive",
      riskTolerance: 0.3,
      aggressionLevel: 0.2,
      adaptationRate: 0.5
    },
    reactions: {
      onThreat: "immediate_defense",
      onOpportunity: "cautious_approach",
      onPowerUp: "defensive_use"
    }
  },

  AGGRESSIVE: {
    name: "Striker",
    description: "Aggressive attacking AI that pressures constantly",
    weights: {
      ballChase: 1.8,
      goalDefense: 0.8,
      positioning: 0.9,
      opportunisticShot: 1.7,
      powerPlay: 1.4
    },
    behaviors: {
      preferredStrategy: "aggressive",
      riskTolerance: 0.8,
      aggressionLevel: 0.9,
      adaptationRate: 0.8
    },
    reactions: {
      onThreat: "counter_attack",
      onOpportunity: "immediate_action",
      onPowerUp: "offensive_use"
    }
  },

  BALANCED: {
    name: "Tactician",
    description: "Well-rounded AI that adapts to game situations",
    weights: {
      ballChase: 1.0,
      goalDefense: 1.3,
      positioning: 1.2,
      opportunisticShot: 1.0,
      powerPlay: 1.0
    },
    behaviors: {
      preferredStrategy: "balanced",
      riskTolerance: 0.6,
      aggressionLevel: 0.5,
      adaptationRate: 1.0
    },
    reactions: {
      onThreat: "calculated_response",
      onOpportunity: "measured_approach",
      onPowerUp: "strategic_use"
    }
  },

  UNPREDICTABLE: {
    name: "Wildcard",
    description: "Unpredictable AI that changes tactics frequently",
    weights: {
      ballChase: 1.2,
      goalDefense: 1.1,
      positioning: 0.8,
      opportunisticShot: 1.3,
      powerPlay: 1.5
    },
    behaviors: {
      preferredStrategy: "random",
      riskTolerance: 0.7,
      aggressionLevel: 0.6,
      adaptationRate: 1.5
    },
    reactions: {
      onThreat: "unpredictable_response",
      onOpportunity: "creative_approach",
      onPowerUp: "experimental_use"
    }
  },

  TECHNICAL: {
    name: "Professor",
    description: "Highly analytical AI with perfect positioning",
    weights: {
      ballChase: 0.9,
      goalDefense: 1.6,
      positioning: 2.0,
      opportunisticShot: 1.1,
      powerPlay: 0.8
    },
    behaviors: {
      preferredStrategy: "technical",
      riskTolerance: 0.4,
      aggressionLevel: 0.3,
      adaptationRate: 0.7
    },
    reactions: {
      onThreat: "analytical_defense",
      onOpportunity: "precise_execution",
      onPowerUp: "calculated_timing"
    }
  }
};

export const DIFFICULTY_CONFIGS = {
  easy: {
    name: "Beginner",
    reactionTime: 200,
    predictionAccuracy: 0.5,
    mistakeChance: 0.3,
    learningRate: 0.1,
    adaptationSpeed: 0.3,
    maxLookAhead: 0.5,
    decisionComplexity: 0.6
  },

  medium: {
    name: "Amateur",
    reactionTime: 120,
    predictionAccuracy: 0.75,
    mistakeChance: 0.15,
    learningRate: 0.3,
    adaptationSpeed: 0.6,
    maxLookAhead: 1.0,
    decisionComplexity: 0.8
  },

  hard: {
    name: "Professional",
    reactionTime: 80,
    predictionAccuracy: 0.9,
    mistakeChance: 0.05,
    learningRate: 0.5,
    adaptationSpeed: 0.8,
    maxLookAhead: 1.5,
    decisionComplexity: 1.0
  },

  expert: {
    name: "Master",
    reactionTime: 50,
    predictionAccuracy: 0.95,
    mistakeChance: 0.02,
    learningRate: 0.7,
    adaptationSpeed: 1.0,
    maxLookAhead: 2.0,
    decisionComplexity: 1.2
  },

  legendary: {
    name: "Legendary",
    reactionTime: 30,
    predictionAccuracy: 0.98,
    mistakeChance: 0.01,
    learningRate: 1.0,
    adaptationSpeed: 1.2,
    maxLookAhead: 3.0,
    decisionComplexity: 1.5
  }
};

/**
 * AI Learning and Adaptation System
 */
export class AILearningSystem {
  constructor() {
    this.learningData = {
      playerPatterns: {},
      successfulStrategies: {},
      failedAttempts: {},
      situationalResponses: {},
      adaptationHistory: []
    };
    
    this.sessionStats = {
      gamesPlayed: 0,
      winRate: 0,
      averageScore: 0,
      strategiesUsed: {},
      adaptationTriggers: 0
    };
    
    this.adaptationThresholds = {
      strategyChange: 3, // Games before considering strategy change
      personalityShift: 5, // Games before personality adaptation
      difficultyAdjust: 10 // Games before difficulty self-adjustment
    };

    this.loadLearningData();
  }

  /**
   * Analyze player behavior and adapt AI accordingly
   */
  analyzePlayerBehavior(gameData) {
    const playerPatterns = this.extractPlayerPatterns(gameData);
    this.updateLearningData(playerPatterns);
    
    // Suggest adaptations based on analysis
    return this.generateAdaptations(playerPatterns);
  }

  extractPlayerPatterns(gameData) {
    return {
      playStyle: this.classifyPlayStyle(gameData),
      weaknesses: this.identifyWeaknesses(gameData),
      strengths: this.identifyStrengths(gameData),
      predictability: this.calculatePredictability(gameData),
      reactionTimes: this.analyzeReactionTimes(gameData),
      strategicPreferences: this.extractStrategicPreferences(gameData)
    };
  }

  classifyPlayStyle(gameData) {
    const { actions, positioning, timing } = gameData;
    
    let aggressionScore = 0;
    let defensiveScore = 0;
    let technicalScore = 0;

    // Analyze actions for play style indicators
    actions.forEach(action => {
      switch (action.type) {
        case 'attack':
        case 'shoot':
        case 'aggressive_move':
          aggressionScore++;
          break;
        case 'defend':
        case 'block':
        case 'retreat':
          defensiveScore++;
          break;
        case 'precise_positioning':
        case 'calculated_move':
          technicalScore++;
          break;
      }
    });

    const total = aggressionScore + defensiveScore + technicalScore;
    
    if (aggressionScore / total > 0.5) return 'aggressive';
    if (defensiveScore / total > 0.5) return 'defensive';
    if (technicalScore / total > 0.4) return 'technical';
    return 'balanced';
  }

  identifyWeaknesses(gameData) {
    const weaknesses = [];
    
    // Analyze common failure patterns
    if (gameData.goalsConceeded > gameData.goalsScored * 1.5) {
      weaknesses.push('poor_defense');
    }
    
    if (gameData.missedShots > gameData.successfulShots * 2) {
      weaknesses.push('poor_accuracy');
    }
    
    if (gameData.lateReactions > 5) {
      weaknesses.push('slow_reactions');
    }
    
    if (gameData.predictableMovements > 0.7) {
      weaknesses.push('predictable_behavior');
    }

    return weaknesses;
  }

  identifyStrengths(gameData) {
    const strengths = [];
    
    if (gameData.goalsScored > gameData.goalsConceeded) {
      strengths.push('good_offense');
    }
    
    if (gameData.successfulDefenses > 0.7) {
      strengths.push('strong_defense');
    }
    
    if (gameData.adaptiveResponses > 0.6) {
      strengths.push('adaptive_play');
    }

    return strengths;
  }

  generateAdaptations(playerPatterns) {
    const adaptations = {};

    // Adapt to player's play style
    switch (playerPatterns.playStyle) {
      case 'aggressive':
        adaptations.recommendedPersonality = 'DEFENSIVE';
        adaptations.strategyAdjustments = {
          increaseDefense: true,
          useCounterAttacks: true,
          focusOnPositioning: true
        };
        break;
        
      case 'defensive':
        adaptations.recommendedPersonality = 'AGGRESSIVE';
        adaptations.strategyAdjustments = {
          increasePressure: true,
          moreRiskyPlays: true,
          quickAttacks: true
        };
        break;
        
      case 'technical':
        adaptations.recommendedPersonality = 'UNPREDICTABLE';
        adaptations.strategyAdjustments = {
          varyStrategies: true,
          unexpectedMoves: true,
          adaptTiming: true
        };
        break;
        
      default:
        adaptations.recommendedPersonality = 'BALANCED';
        adaptations.strategyAdjustments = {
          maintainBalance: true,
          adaptToSituation: true
        };
    }

    // Adjust difficulty based on player performance
    if (playerPatterns.weaknesses.length > 2) {
      adaptations.difficultyAdjustment = 'decrease';
    } else if (playerPatterns.strengths.length > 2) {
      adaptations.difficultyAdjustment = 'increase';
    }

    return adaptations;
  }

  updateLearningData(patterns) {
    // Store patterns for future reference
    const sessionId = Date.now();
    this.learningData.playerPatterns[sessionId] = patterns;
    
    // Update session statistics
    this.sessionStats.gamesPlayed++;
    
    // Trigger adaptation if thresholds are met
    if (this.shouldTriggerAdaptation()) {
      this.triggerAdaptation();
    }
    
    this.saveLearningData();
  }

  shouldTriggerAdaptation() {
    return this.sessionStats.gamesPlayed % this.adaptationThresholds.strategyChange === 0;
  }

  triggerAdaptation() {
    this.sessionStats.adaptationTriggers++;
    
    logger.info("AI adaptation triggered", {
      gamesPlayed: this.sessionStats.gamesPlayed,
      adaptationCount: this.sessionStats.adaptationTriggers
    });
  }

  loadLearningData() {
    try {
      const savedData = localStorage.getItem('ai_learning_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        this.learningData = { ...this.learningData, ...parsed };
      }
    } catch (error) {
      logger.warn("Failed to load AI learning data", error);
    }
  }

  saveLearningData() {
    try {
      localStorage.setItem('ai_learning_data', JSON.stringify(this.learningData));
    } catch (error) {
      logger.warn("Failed to save AI learning data", error);
    }
  }

  resetLearningData() {
    this.learningData = {
      playerPatterns: {},
      successfulStrategies: {},
      failedAttempts: {},
      situationalResponses: {},
      adaptationHistory: []
    };
    
    this.sessionStats = {
      gamesPlayed: 0,
      winRate: 0,
      averageScore: 0,
      strategiesUsed: {},
      adaptationTriggers: 0
    };
    
    localStorage.removeItem('ai_learning_data');
    logger.info("AI learning data reset");
  }

  getAdaptationSummary() {
    return {
      gamesAnalyzed: Object.keys(this.learningData.playerPatterns).length,
      adaptationsMade: this.sessionStats.adaptationTriggers,
      currentWinRate: this.sessionStats.winRate,
      mostUsedStrategy: this.getMostUsedStrategy(),
      learningProgress: this.calculateLearningProgress()
    };
  }

  getMostUsedStrategy() {
    const strategies = this.sessionStats.strategiesUsed;
    return Object.keys(strategies).reduce((a, b) => 
      strategies[a] > strategies[b] ? a : b, 'balanced');
  }

  calculateLearningProgress() {
    const totalGames = this.sessionStats.gamesPlayed;
    const adaptations = this.sessionStats.adaptationTriggers;
    
    if (totalGames === 0) return 0;
    return Math.min(1, (adaptations / totalGames) * 5); // Scale to 0-1
  }
}

/**
 * AI Configuration Manager
 */
export class AIConfigManager {
  constructor() {
    this.currentPersonality = 'BALANCED';
    this.currentDifficulty = 'medium';
    this.learningSystem = new AILearningSystem();
    this.customConfig = null;
    
    this.loadConfiguration();
  }

  /**
   * Get AI configuration for specified personality and difficulty
   */
  getAIConfig(personality = null, difficulty = null) {
    const selectedPersonality = personality || this.currentPersonality;
    const selectedDifficulty = difficulty || this.currentDifficulty;
    
    const personalityConfig = AI_PERSONALITIES[selectedPersonality];
    const difficultyConfig = DIFFICULTY_CONFIGS[selectedDifficulty];
    
    if (!personalityConfig || !difficultyConfig) {
      logger.warn("Invalid AI configuration", { personality: selectedPersonality, difficulty: selectedDifficulty });
      return this.getDefaultConfig();
    }

    // Merge personality and difficulty configurations
    const config = {
      personality: {
        name: personalityConfig.name,
        description: personalityConfig.description,
        ...personalityConfig
      },
      difficulty: {
        name: difficultyConfig.name,
        ...difficultyConfig
      },
      // Merge weights with difficulty modifiers
      weights: this.applyDifficultyToWeights(
        personalityConfig.weights, 
        difficultyConfig.decisionComplexity
      ),
      behaviors: personalityConfig.behaviors,
      reactions: personalityConfig.reactions
    };

    // Apply any custom overrides
    if (this.customConfig) {
      return this.mergeConfigurations(config, this.customConfig);
    }

    return config;
  }

  applyDifficultyToWeights(weights, complexityMultiplier) {
    const adjustedWeights = {};
    
    for (const [key, value] of Object.entries(weights)) {
      adjustedWeights[key] = value * complexityMultiplier;
    }
    
    return adjustedWeights;
  }

  mergeConfigurations(baseConfig, customConfig) {
    return {
      ...baseConfig,
      weights: { ...baseConfig.weights, ...customConfig.weights },
      behaviors: { ...baseConfig.behaviors, ...customConfig.behaviors },
      reactions: { ...baseConfig.reactions, ...customConfig.reactions }
    };
  }

  /**
   * Set AI personality
   */
  setPersonality(personality) {
    if (AI_PERSONALITIES[personality]) {
      this.currentPersonality = personality;
      this.saveConfiguration();
      
      logger.info("AI personality changed", {
        newPersonality: personality,
        description: AI_PERSONALITIES[personality].description
      });
    } else {
      logger.warn("Invalid AI personality", { personality });
    }
  }

  /**
   * Set AI difficulty
   */
  setDifficulty(difficulty) {
    if (DIFFICULTY_CONFIGS[difficulty]) {
      this.currentDifficulty = difficulty;
      this.saveConfiguration();
      
      logger.info("AI difficulty changed", {
        newDifficulty: difficulty,
        name: DIFFICULTY_CONFIGS[difficulty].name
      });
    } else {
      logger.warn("Invalid AI difficulty", { difficulty });
    }
  }

  /**
   * Apply adaptive changes based on learning
   */
  applyAdaptiveChanges(gameData) {
    const adaptations = this.learningSystem.analyzePlayerBehavior(gameData);
    
    if (adaptations.recommendedPersonality && 
        adaptations.recommendedPersonality !== this.currentPersonality) {
      
      logger.info("AI adapting personality based on player behavior", {
        oldPersonality: this.currentPersonality,
        newPersonality: adaptations.recommendedPersonality,
        reason: "player_adaptation"
      });
      
      this.setPersonality(adaptations.recommendedPersonality);
    }

    if (adaptations.difficultyAdjustment) {
      this.adjustDifficultyAdaptively(adaptations.difficultyAdjustment);
    }

    return adaptations;
  }

  adjustDifficultyAdaptively(adjustment) {
    const difficulties = Object.keys(DIFFICULTY_CONFIGS);
    const currentIndex = difficulties.indexOf(this.currentDifficulty);
    
    let newIndex = currentIndex;
    
    if (adjustment === 'increase' && currentIndex < difficulties.length - 1) {
      newIndex = currentIndex + 1;
    } else if (adjustment === 'decrease' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    }
    
    if (newIndex !== currentIndex) {
      const newDifficulty = difficulties[newIndex];
      
      logger.info("AI adapting difficulty", {
        oldDifficulty: this.currentDifficulty,
        newDifficulty,
        reason: adjustment
      });
      
      this.setDifficulty(newDifficulty);
    }
  }

  /**
   * Create custom AI configuration
   */
  createCustomConfig(customSettings) {
    this.customConfig = customSettings;
    this.saveConfiguration();
    
    logger.info("Custom AI configuration applied", customSettings);
  }

  /**
   * Reset to default configuration
   */
  resetToDefault() {
    this.currentPersonality = 'BALANCED';
    this.currentDifficulty = 'medium';
    this.customConfig = null;
    this.saveConfiguration();
    
    logger.info("AI configuration reset to defaults");
  }

  /**
   * Get available personalities and difficulties
   */
  getAvailableOptions() {
    return {
      personalities: Object.keys(AI_PERSONALITIES).map(key => ({
        id: key,
        name: AI_PERSONALITIES[key].name,
        description: AI_PERSONALITIES[key].description
      })),
      difficulties: Object.keys(DIFFICULTY_CONFIGS).map(key => ({
        id: key,
        name: DIFFICULTY_CONFIGS[key].name,
        reactionTime: DIFFICULTY_CONFIGS[key].reactionTime
      }))
    };
  }

  /**
   * Get current configuration summary
   */
  getCurrentConfig() {
    return {
      personality: {
        id: this.currentPersonality,
        ...AI_PERSONALITIES[this.currentPersonality]
      },
      difficulty: {
        id: this.currentDifficulty,
        ...DIFFICULTY_CONFIGS[this.currentDifficulty]
      },
      learning: this.learningSystem.getAdaptationSummary(),
      hasCustomConfig: !!this.customConfig
    };
  }

  getDefaultConfig() {
    return this.getAIConfig('BALANCED', 'medium');
  }

  loadConfiguration() {
    try {
      const savedConfig = localStorage.getItem('ai_configuration');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        this.currentPersonality = config.personality || 'BALANCED';
        this.currentDifficulty = config.difficulty || 'medium';
        this.customConfig = config.customConfig || null;
      }
    } catch (error) {
      logger.warn("Failed to load AI configuration", error);
    }
  }

  saveConfiguration() {
    try {
      const config = {
        personality: this.currentPersonality,
        difficulty: this.currentDifficulty,
        customConfig: this.customConfig
      };
      
      localStorage.setItem('ai_configuration', JSON.stringify(config));
    } catch (error) {
      logger.warn("Failed to save AI configuration", error);
    }
  }
}

// Create singleton instance
export const aiConfigManager = new AIConfigManager();