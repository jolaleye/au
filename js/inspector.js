import * as THREE from 'three';

import _ from '../settings.json';

// helper class to fly around the scene
class Inspector {
  constructor() {
    this.locked = false;
    this.camera = new THREE.PerspectiveCamera(
      _.camera.fov,
      window.innerWidth / window.innerHeight,
      _.camera.near,
      _.camera.far
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.position.z = _.earth.orbitRadius - _.earth.radius * 1.5;

    this.speed = 0.2;
    this.moving = { forward: false, back: false };
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    document.addEventListener('pointerlockchange', () => (this.locked = document.pointerLockElement === document.body));
    document.querySelector('canvas').addEventListener('click', () => document.body.requestPointerLock());
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  update(ts) {
    if (!this.locked) return;

    this.camera.getWorldDirection(this.direction);
    const backOrForth = Number(this.moving.forward) - Number(this.moving.back);
    this.velocity = this.direction.multiplyScalar(this.speed * backOrForth * ts);

    this.camera.position.add(this.velocity);
  }

  onMouseMove(event) {
    if (!this.locked) return;

    const dx = event.movementX || 0;
    const dy = event.movementY || 0;

    this.camera.rotation.y -= dx * 0.002;
    this.camera.rotation.x -= dy * 0.002;

    const pi2 = Math.PI / 2;
    this.camera.rotation.x = Math.max(-pi2, Math.min(pi2, this.camera.rotation.x));
  }

  onKeyDown(event) {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
        this.moving.forward = true;
        break;
      case 'ArrowDown':
      case 's':
        this.moving.back = true;
        break;
    }
  }

  onKeyUp(event) {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
        this.moving.forward = false;
        break;
      case 'ArrowDown':
      case 's':
        this.moving.back = false;
        break;
    }
  }
}

export default Inspector;
