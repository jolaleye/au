import TWEEN from '@tweenjs/tween.js';

import _ from '../settings.json';

class UI {
  constructor() {
    this.overlay = document.querySelector('.overlay');
    this.distance = document.querySelector('.overlay__distance span');
    this.speed = document.querySelector('.overlay__speed span');
    this.eta = document.querySelector('.overlay__eta span');

    // object used for storing current subtitle
    this.sub = { el: null, in: null, out: null };
  }

  fade(els = [], o1 = 0, o2 = 1, duration = 3000) {
    for (const el of els) el.style.setProperty('display', 'initial');
    const tween = new TWEEN.Tween({ o: o1 })
      .to({ o: o2 }, duration)
      .easing(TWEEN.Easing.Quadratic[o2 > o1 ? 'In' : 'Out'])
      .onUpdate(({ o }) => {
        for (const el of els) el.style.setProperty('opacity', o);
      });
    return tween;
  }

  overrideSubtitle() {
    this.sub.in.stop();
    this.sub.out.stop();
    return new Promise(resolve => {
      this.fade([this.sub.el], this.sub.el.style.opacity, 0, _.subtitleOverride)
        .onComplete(() => {
          this.overlay.removeChild(this.sub.el);
          this.sub.el = null;
          resolve();
        })
        .start();
    });
  }

  async subtitle(text = '', delay = 0, fadeFor = 2000, showFor = 3000, o1 = 0, o2 = 1, classes = [], html) {
    // override the current subtitle if necessary
    if (this.sub.el) await this.overrideSubtitle();

    this.sub.el = document.createElement('div');
    this.sub.el.classList.add('overlay__subtitle', ...classes);
    this.sub.el.innerHTML = html ? html : `<p>${text}</p>`;
    this.sub.el.style.setProperty('opacity', o1);
    this.overlay.appendChild(this.sub.el);

    return new Promise(resolve => {
      this.sub.in = this.fade([this.sub.el], o1, o2, fadeFor).delay(delay);
      this.sub.out = this.fade([this.sub.el], o2, o1, fadeFor)
        .delay(showFor)
        .onComplete(() => {
          if (!this.sub.el) return;
          this.overlay.removeChild(this.sub.el);
          this.sub.el = null;
          resolve();
        });
      this.sub.in.chain(this.sub.out).start();
    });
  }

  updateDistance(distance) {
    this.distance.innerHTML = distance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  updateSpeed(speed) {
    this.speed.innerHTML = speed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // eta in seconds
  updateETA(eta) {
    const hours = Math.floor(eta / 3600).toLocaleString('en-US', { minimumIntegerDigits: 2 });
    const mins = Math.floor((eta % 3600) / 60).toLocaleString('en-US', { minimumIntegerDigits: 2 });
    const secs = Math.round((eta % 3600) % 60).toLocaleString('en-US', { minimumIntegerDigits: 2 });
    this.eta.innerHTML = `${hours}:${mins}:${secs}`;
  }
}

export default UI;
