const {
  Record,
  StoreOf,
  ListOf,
  Component,
} = window.Torus;

class Thing extends Record { }
class ThingStore extends StoreOf(Thing) { }

function xy(evt) {
  const x = evt.clientX || (evt.touches && evt.touches[0].clientX);
  const y = evt.clientY || (evt.touches && evt.touches[0].clientY);
  return { x, y }
}

class ThingCard extends Component {
  init(thing, remover, creator) {
    this.remover = remover;
    this.creator = creator;

    this.startX = 0;
    this.startY = 0;
    this.tempX = 0;
    this.tempY = 0;
    this.active = false;

    this.handleDown = this.handleDown.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleUp = this.handleUp.bind(this);

    this.bind(thing, data => this.render(data));
  }
  handleDown(evt) {
    if (!evt.ctrlKey) return;

    evt.preventDefault();

    const { x, y } = xy(evt);
    this.startX = x;
    this.startY = y;
    this.tempX = 0;
    this.tempY = 0;
    document.addEventListener('mousemove', this.handleMove, {
      passive: true,
    });
    document.addEventListener('mouseup', this.handleUp);
    document.addEventListener('touchmove', this.handleMove, {
      passive: true,
    });
    document.addEventListener('touchend', this.handleUp);
  }
  handleMove(evt) {
    const { x, y } = xy(evt);
    this.tempX = x - this.startX;
    this.tempY = y - this.startY;
    this.render();
  }
  handleUp(evt) {
    evt.preventDefault();

    const { tempX, tempY } = this;
    this.startX = 0;
    this.startY = 0;
    this.tempX = 0;
    this.tempY = 0;

    this.record.update({
      x: this.record.get('x') + tempX,
      y: this.record.get('y') + tempY,
    });

    document.removeEventListener('mousemove', this.handleMove);
    document.removeEventListener('mouseup', this.handleUp);
    document.removeEventListener('touchmove', this.handleMove);
    document.removeEventListener('touchend', this.handleUp);
  }
  compose({ value, x, y }) {
    return jdom`<div class="tb-thing ${this.active ? 'active' : 'inactive'}"
      style="transform: translate(${x + this.tempX}px,${y + this.tempY}px)">
      <div class="tb-buttons">
        <button class="tb-button movable paper"
          onclick=${() => {
        const t = this.record.serialize();
        this.creator({
          value: t.value,
          x: t.x + 10,
          y: t.y + 10,
        })
      }}>cln</button>
        <button class="tb-button movable paper"
          onclick=${this.remover}>del</button>
        <button class="tb-button movable paper"
          onclick=${() => {
        const ta = this.node.querySelector('textarea');
        ta.style.height = '12em';
        ta.style.width = '16em';
      }}>rst</button>
      </div>
      <textarea class="tb-textarea paper paper-border-top"
        value=${value}
        onmousedown=${this.handleDown}
        ontouchstart=${this.handleDown}
        onfocus=${() => {
        this.active = true;
        this.render({ value, x, y });
      }}
        onblur=${() => {
        setTimeout(() => {
          this.active = false;
          this.render({ value, x, y })
        }, 250);
      }}
        oninput=${evt => {
        this.record.update({ value: evt.target.value });
      }}>
      </textarea>
    </div>`;
  }
}

class ThingList extends ListOf(ThingCard) {
  compose() {
    return jdom`<div class="tb-things">${this.nodes}</div>`;
  }
}

class Board extends Component {
  init() {
    this.things = new ThingStore();
    this.thingList = new ThingList(
      this.things,
      t => this.things.create(t),
    );
    this.restore();

    this.ctrlDown = false;
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleDown = this.handleDown.bind(this);

    this.bind(this.things, () => this.render());

    window.addEventListener('keydown', this.handleKeydown);
  }
  save() {
    localStorage.setItem('thingboard', JSON.stringify(this.things.serialize()));
  }
  restore() {
    try {
      const saved = localStorage.getItem('thingboard');
      if (!saved) return;

      const thingsRaw = JSON.parse(saved);
      for (const thing of thingsRaw) {
        this.things.create(thing);
      }
    } catch (e) {
      localStorage.clear();
      console.error(`Error serializing saved data`, e);
    }
  }
  handleKeydown(evt) {
    if (evt.key === 'Control') {
      this.ctrlDown = true;
    }
    this.render();

    const up = evt => {
      if (evt.key === 'Control') {
        this.ctrlDown = false;
        window.removeEventListener('keyup', up);
        this.render();
      }
    }
    window.addEventListener('keyup', up);
  }
  handleDown(evt) {
    if (evt.target !== this.node) {
      return;
    }
    evt.preventDefault();

    const up = fvt => {
      fvt.preventDefault();

      const a = xy(evt);
      const b = xy(fvt);
      const closeEnough = (n, m) => Math.abs(n - m) < 2;

      if (closeEnough(a.x, a.x) && closeEnough(a.y, b.y)
        && fvt.target === this.node) {
        this.things.create({
          ...a,
          value: 'new.',
        });
      }
      this.node.removeEventListener('mouseup', up);
      this.node.removeEventListener('touchend', up);
    }
    this.node.addEventListener('mouseup', up);
    this.node.addEventListener('touchend', up);
  }
  compose() {
    return jdom`<div class="tb-board ${this.ctrlDown ? 'ctrlDown' : ''}"
      onmousedown=${this.handleDown}
      ontouchstart=${this.handleDown}>
      <header class="tb-header accent paper">
        <div class="left">
          <span class="title">thingboard</span>
          (${this.things.records.size})
        </div>
        <div class="right">
          <button class="tb-button movable paper"
            onclick=${() => this.things.reset()}>clr</button>
          <button class="tb-button movable paper"
            onclick=${() => {
        let i = 1;
        for (const thing of this.things) {
          thing.update({
            x: i * 10,
            y: i * 10,
          });
          i++;
        }
      }}>rst</button>
        </div>
      </header>
      ${this.thingList.node}
    </div>`;
  }
}

const board = new Board();
document.body.appendChild(board.node);
