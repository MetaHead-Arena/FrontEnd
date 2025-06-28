import { Player } from "./Player.js";

export class RemotePlayer extends Player {
  constructor(scene, x, y, playerKey) {
    super(scene, x, y, playerKey, "dummy");
  }

  update() {
    // Do nothing (wait for remote updates)
  }

  setRemoteState(data) {
    // Example: update position, animation, etc. from socket.io data
    if (data.x !== undefined && data.y !== undefined) {
      this.sprite.x = data.x;
      this.sprite.y = data.y;
    }
    // Add more as needed (velocity, animation, etc.)
  }
}