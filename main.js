const {
  Record,
  StoreOf,
  ListOf,
  Component,
} = window.Torus;

class Thing extends Record { }
class ThingStore extends StoreOf(Thing) { }

const debounce = (fn, delay) => {
  let to = null;
  return (...args) => {
    const dfn = () => fn(...args);
    clearTimeout(to);
    to = setTimeout(dfn, delay);
  }
}

function xy(evt) {
  let event = evt;
  if (!evt.clientX) {
    if (evt.touches && evt.touches.length) {
      event = evt.touches[0];
    } else if (evt.changedTouches && evt.changedTouches.length) {
      event = evt.changedTouches[0];
    }
  }
  return {
    x: event.clientX,
    y: event.clientY,
  }
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

    const setDimensions = debounce((width, height) => {
      this.record.update({ width, height });
    }, 500);
    const observer = new MutationObserver(mutationList => {
      for (const mutation of mutationList) {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'style') {
          continue;
        }

        const { width, height } = mutation.target.getBoundingClientRect();
        if (width !== this.record.get('width') || height !== this.record.get('height')) {
          setDimensions(width, height);
        }
        return;
      }
    });
    observer.observe(this.node.querySelector('textarea'), {
      attributes: true,
    });
  }
  handleDown(evt) {
    if (!evt.ctrlKey && !evt.metaKey) return;

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
  compose(data) {
    const { value, x, y, width, height } = data;
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
          width: t.width,
          height: t.height,
        });
      }}>clone</button>
        <button class="tb-button movable paper"
          onclick=${this.remover}>delete</button>
        <button class="tb-button movable paper"
          onclick=${() => {
        this.record.update({
          width: 300,
          height: 200,
        });
      }}>reset</button>
      </div>
      <textarea class="tb-textarea paper paper-border-top"
        style="width:${width}px;height:${height}px"
        value=${value}
        placeholder="say something..."
        onmousedown=${this.handleDown}
        ontouchstart=${this.handleDown}
        onmouseup=${(evt) => {
        // on Safari/Webkit, MutationObserver doesn't detect
        // textarea size changes. So this is a nice surrogate.
        const { width, height } = evt.target.getBoundingClientRect();
        if (width !== this.record.get('width') || height !== this.record.get('height')) {
          this.record.update({ width, height });
        }
      }}
        onfocus=${() => {
        this.active = true;
        this.render(data);
      }}
        onblur=${() => {
        setTimeout(() => {
          this.active = false;
          if (!this.record) {
            return;
          }
          this.render(this.record.summarize());
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
    this.toast = '';
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleDown = this.handleDown.bind(this);
    this.save = debounce(this.save.bind(this), 500);

    this.things.addHandler(this.save);
    for (const thing of this.things) {
      thing.addHandler(this.save);
    }
    this.bind(this.things, () => this.render());

    window.addEventListener('keydown', this.handleKeydown);
  }
  save() {
    localStorage.setItem('thingboard', JSON.stringify(this.things.serialize()));

    this.toast = '...';
    this.render();
    setTimeout(() => {
      this.toast = '';
      this.render();
    }, 1200);
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
    if (evt.key === 'Control' || evt.key === 'Meta') {
      this.ctrlDown = true;
    }
    this.render();

    const up = evt => {
      if (evt.key === 'Control' || evt.key === 'Meta') {
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
        const thing = this.things.create({
          ...a,
          width: 300,
          height: 200,
          value: '',
        });
        thing.addHandler(this.save);
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
      <header class="tb-header">
        <div class="left">
          <span class="title">thingboard</span>
          (${this.toast || this.things.records.size})
        </div>
        <div class="right">
          <a class="tb-button movable paper" target="_blank"
            href="https://github.com/thesephist/thingboard">about</a>
          <button class="tb-button movable paper"
            onclick=${() => this.things.reset()}>clear</button>
          <button class="tb-button movable paper"
            onclick=${() => {
        let i = 1;
        const { height } = this.node.querySelector('header').getBoundingClientRect();
        for (const thing of this.things) {
          thing.update({
            x: i * 10,
            y: i * 10 + height,
          });
          i++;
        }
      }}>stack</button>
        </div>
      </header>
      ${this.things.records.size ? this.thingList.node : (
        jdom`<div class="tb-slate">
          Tap to create a thing. <br/>
          Ctrl/Cmd + drag to move things.
        </div>`
      )}
    </div>`;
  }
}

const board = new Board();
document.body.appendChild(board.node);
