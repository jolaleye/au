import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

import _ from '../settings.json';
import script from '../script.json';
import { km2u, u2km } from './utils';
import UI from './UI';

// coordinates phases and flow
class Director {
  constructor(pov, sun, earth) {
    this.pov = pov;
    this.sun = sun;
    this.earth = earth;
    this.ui = new UI();
    this.updating = { distance: false, speed: false, eta: false };
  }

  update() {
    // get the distance from Earth & current speed
    const distanceFromEarth = this.earth.position.z - this.pov.position.z;
    const currentSpeed = this.pov.velocity.z;

    if (this.updating.distance) this.ui.updateDistance(u2km(distanceFromEarth));
    if (this.updating.speed) this.ui.updateSpeed(u2km(currentSpeed) * 3600);
    if (this.updating.eta) this.ui.updateETA(u2km(this.pov.position.z - km2u(_.sol.slowAt)) / u2km(currentSpeed));

    // check checkpoints
    if (script.checkpoints.length && distanceFromEarth >= script.checkpoints[0].distance) {
      const checkpoint = script.checkpoints.shift();
    }

    // check distance from Sun
    if (this.traveling && !this.reachedSun && this.pov.position.z <= km2u(_.sol.slowAt)) {
      this.reachedSun = true;
      this.updating.distance = false;
      this.updating.speed = false;
      this.updating.eta = false;
      this.startSol();
    }
  }

  // waiting for the scene to render and placeholder to fade out
  preWait() {
    this.earth.leo.add(this.pov.camera);
    this.pov.position.z = km2u(_.wait.povOrbitRadius);
    this.pov.lock();
  }

  // WAIT phase
  // - camera orbits Earth
  startWait() {
    // rotate Earth's orbit continuously
    const orbitTween = new TWEEN.Tween(this.earth.leo.rotation)
      .to({ x: 0, y: 2 * Math.PI, z: 0 }, _.wait.povOrbitPeriod)
      .repeat(Infinity)
      .start();

    document.querySelector('.landing__pulse').addEventListener('click', () => {
      const ui = document.querySelector('.landing');

      // fade out the landing page ui
      const uiTween = new TWEEN.Tween({ opacity: 1 })
        .to({ opacity: 0 }, _.wait.uiFadeOut)
        .onUpdate(({ opacity }) => (ui.style.opacity = opacity))
        .onComplete(() => (ui.style.display = 'none'))
        .start();

      // stop rotation and start intro phase
      orbitTween.stop();
      this.startIntro();
    });
  }

  // INTRO phase
  // - camera moves into position between Earth & Sun
  async startIntro() {
    this.pov.cameraCorrection = false;
    const rotation = (this.earth.leo.rotation.y + Math.PI) % (2 * Math.PI); // rotation of Earth orbit past the destination
    const diff = 2 * Math.PI - rotation; // amount to rotate

    const cameraTween = new TWEEN.Tween(this.pov.camera.rotation)
      .to({ x: 0, y: -Math.PI, z: 0 }, _.intro.povRotationDuration)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onComplete(() => this.pov.target.setFromEuler(new THREE.Euler(0, -Math.PI, 0)));

    const orbitTween = new TWEEN.Tween(this.earth.leo.rotation)
      .to({ x: 0, y: `+${diff}`, z: 0 }, _.intro.povOrbitDuration)
      .easing(TWEEN.Easing.Cubic.Out)
      .onComplete(() => this.sun.toggleLensflare(false))
      .chain(cameraTween)
      .start();

    // run through the intro lines
    for (const line of script.intro) await this.ui.subtitle(line.text, line.delay, line.fadeFor, line.showFor, 0, 0.8);
    // title card
    await this.ui.subtitle('', 500, 3000, 3000, 0, 1, ['intro-title'], '<span>ONE</span><span>AU</span>');

    this.startInstructions();
  }

  // INSTRUCTIONS phase
  // - hud appears, prep for travel
  async startInstructions() {
    this.updating.distance = true;
    this.updating.speed = true;
    this.updating.eta = true;

    // remove the pov from earth orbit and reset
    this.earth.leo.remove(this.pov.camera);
    this.pov.position.set(0, 0, km2u(_.earth.orbitRadius - _.wait.povOrbitRadius));
    this.pov.target.setFromEuler(new THREE.Euler(0, 0, 0));
    this.pov.rotation.set(0, 0, 0);
    this.pov.cameraCorrection = true;

    // run through the instruction lines
    for (let i = 0; i < script.instructions.length; i++) {
      const line = script.instructions[i];
      await this.ui.subtitle(line.text, line.delay, line.fadeFor, line.showFor, 0, 0.8);

      // add the distance overlay after the first line
      if (i === 0) this.ui.fade([document.querySelector(`.overlay .distance`)], 0, 0.5, 3000).start();
      // start moving and show the speed after the second line (at 277.87mph or 0.12422km/s)
      if (i === 1) {
        this.pov.setSpeed(0.12422);
        this.ui.fade([document.querySelector(`.overlay .speed`)], 0, 0.5, 3000).start();
      }
      // unlock pov controls after line 5
      if (i === 4) this.pov.unlock();
      // unlock speed controls after line 6
      if (i === 5) this.pov.scrollLocked = false;
    }

    this.startAU();
  }

  // AU phase
  // - user travels towards the sun with periodic subtitles
  startAU() {
    this.traveling = true;
    this.ui.fade([document.querySelector(`.overlay .eta`)], 0, 0.3, 3000).start();
    this.ui.fade([document.querySelector(`.overlay .boost`)], 0, 0.5, 3000).start();
    document.querySelector('.overlay .boost').addEventListener('click', this.boost.bind(this));
  }

  // SOL phase
  // - cinematic sun scene to conclude
  async startSol() {
    this.pov.scrollLocked = true;
    this.pov.lock();
    this.pov.setSpeed(0);

    // add pov to the Sun's orbit
    this.sun.orbit.add(this.pov.camera);
    this.pov.position.set(0, 0, km2u(_.sol.slowAt));

    // gradually approach the sun
    const drift = new TWEEN.Tween({ z: this.pov.position.z })
      .to({ z: km2u(_.sol.stopAt) }, _.sol.driftDuration)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate(({ z }) => this.pov.position.setZ(z));

    // orbit the sun
    const orbit = new TWEEN.Tween({ y: this.sun.orbit.rotation.y })
      .to({ y: 2 * Math.PI }, _.sol.povOrbitPeriod)
      .onUpdate(({ y }) => {
        this.sun.orbit.rotation.y = y;
        this.sun.corona.rotation.y = y;
      })
      .repeat(Infinity);

    drift.chain(orbit).start();

    this.ui.fade(document.querySelectorAll(`.distance, .speed, .boost`), 0.5, 0, 3000).start();
    this.ui.fade([document.querySelector(`.eta`)], 0.3, 0, 3000).start();

    await this.ui.subtitle('', 3000, 4000, 4000, 0, 1, ['sol-title'], '<span>THE</span><span>SUN</span>');

    for (const line of script.sol) {
      await this.ui.subtitle(line.text, line.delay, line.fadeFor, line.showFor, 0, 0.8, ['black']);
    }

    this.ui.fade(document.querySelectorAll('.end-title, .end-by'), 0, 1, 5000).start();
  }

  // start moving real fast
  async boost() {
    if (document.querySelector('.overlay .speed-sub')) return;

    this.pov.setSpeed(1498960, true);

    const sub1 = "You're now moving at about five times the speed of light.";
    await this.ui.subtitle(sub1, 0, 1000, 3500, 0, 0.6, ['speed-sub']);
    const sub2 = "This really isn't possible, but for the sake of speeding things up a bit we'll ignore that.";
    this.ui.subtitle(sub2, 0, 1000, 4500, 0, 0.6, ['speed-sub']);
  }
}

export default Director;
