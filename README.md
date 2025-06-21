# Head Ball Game - Next.js Version

A fun football game built with Phaser 3 and Next.js.

## Features

- 2-Player Mode: Human vs Human
- AI Mode: Human vs AI with configurable difficulty
- Power-up System: Speed, Jump, Kick Power, and Shoot Power boosts
- Physics-based Gameplay: Realistic ball physics and player movement
- Timer System: 60-second matches with visual countdown
- Goal Detection: Automatic scoring and game state management
- Visual Effects: Particle effects, screen shake, and goal celebrations

## Controls

- **Player 1**: Arrow Keys for movement, Right Shift for shooting
- **Player 2**: WASD Keys for movement, Space for shooting

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Game Modes

1. **2 Player Game**: Play against another human player
2. **Play vs AI**: Play against an AI opponent with medium difficulty

## Power-ups

- ⚡ **Speed Boost**: Increases player movement speed
- ↑ **Jump Boost**: Increases jump height
- 💥 **Kick Power**: Increases kick force
- 🎯 **Shoot Power**: Increases shooting power

## Development

The game is built using:
- **Next.js 14**: React framework with app router
- **Phaser 3.80.0**: HTML5 game framework
- **React 18**: UI library

### Project Structure

```
FrontEnd-master/
├── app/                    # Next.js app directory
│   ├── layout.js          # Root layout component
│   ├── page.js            # Main game page
│   └── globals.css        # Global styles
├── public/                # Static assets
│   ├── ball.png           # Ball sprite
│   ├── head-1.png         # Player 1 sprite
│   └── head-2.png         # Player 2 sprite
├── config.js              # Game configuration
├── MenuScene.js           # Main menu scene
├── GameScene.js           # Main game scene
├── Player.js              # Player class
├── AIPlayer.js            # AI player class
└── package.json           # Dependencies and scripts
```

## Original vs Next.js Version

This is a refactored version of the original Head Ball game that:
- Uses Next.js for easier development and testing
- Maintains all original functionality
- Provides a built-in development server
- Improves asset serving through Next.js public directory
- Maintains the same game mechanics and visual assets

The game works exactly the same as the original version but is now easier to develop and deploy. 