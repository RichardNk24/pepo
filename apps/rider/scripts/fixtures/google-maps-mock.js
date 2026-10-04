/* Test double only. No real Google requests or real street data are used. */
(function () {
  const objects = [];
  class LatLng {
    constructor(p, b) {
      this.y = typeof p === "number" ? p : p.lat;
      this.x = typeof p === "number" ? b : p.lng;
    }
    lat() {
      return this.y;
    }
    lng() {
      return this.x;
    }
  }
  class Map {
    constructor(host, options) {
      this.host = host;
      this.center = new LatLng(options.center);
      this.zoom = options.zoom;
      this.events = {};
      this.overlays = [];
      this.fitCalls = 0;
      this.centerCalls = 0;
      window.__pepoTestMap = this;
      host.style.cssText =
        "background:#f1f0e8;position:relative;overflow:hidden;touch-action:none;";
      host.innerHTML =
        '<svg id="mock-layer" style="position:absolute;width:100%;height:100%"></svg><div style="position:absolute;bottom:5px;left:5px;font:9px system-ui;background:white;padding:4px;z-index:20">SIMULATION TECHNIQUE · aucune carte réelle</div>';
      this.svg = host.querySelector("svg");
      this.panes = {};
      for (const [name, layer] of [
        ["overlayLayer", 1],
        ["floatPane", 4],
      ]) {
        const pane = document.createElement("div");
        pane.dataset.pane = name;
        pane.style.cssText =
          "position:absolute;inset:0;pointer-events:none;z-index:" + layer;
        host.appendChild(pane);
        this.panes[name] = pane;
      }
      let down;
      host.addEventListener("pointerdown", (e) => {
        down = { x: e.clientX, y: e.clientY, center: this.center };
        host.setPointerCapture(e.pointerId);
      });
      host.addEventListener("pointermove", (e) => {
        if (!down) return;
        if (
          !down.moved &&
          Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3
        ) {
          down.moved = true;
          this.emit("dragstart");
        }
        if (down.moved)
          this.setCenter({
            lat: down.center.lat() + (e.clientY - down.y) * 0.00004,
            lng: down.center.lng() - (e.clientX - down.x) * 0.00004,
          });
      });
      host.addEventListener("pointerup", (e) => {
        if (down && !down.moved)
          this.emit("click", {
            latLng: new LatLng({
              lat:
                this.center.lat() +
                (host.clientHeight / 2 - e.offsetY) * 0.00004,
              lng:
                this.center.lng() +
                (e.offsetX - host.clientWidth / 2) * 0.00004,
            }),
          });
        down = null;
        this.emit("idle");
      });
      setTimeout(() => {
        this.render();
        this.emit("tilesloaded");
        this.emit("idle");
      }, 20);
    }
    addListener(name, fn) {
      (this.events[name] ??= []).push(fn);
      return { remove: () => {} };
    }
    emit(name, args) {
      for (const fn of this.events[name] || []) fn(args);
    }
    getDiv() {
      return this.host;
    }
    getCenter() {
      return this.center;
    }
    setCenter(p) {
      this.center = new LatLng(p);
      this.centerCalls++;
      this.render();
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.emit("idle"), 90);
    }
    setZoom(z) {
      this.zoom = z;
      this.emit("zoom_changed");
    }
    fitBounds(bounds) {
      this.fitCalls++;
      const ps = bounds.points;
      this.setCenter({
        lat: ps.reduce((s, p) => s + p.lat, 0) / ps.length,
        lng: ps.reduce((s, p) => s + p.lng, 0) / ps.length,
      });
      this.emit("zoom_changed");
    }
    project(p) {
      return {
        x: this.host.clientWidth / 2 + (p.lng - this.center.lng()) / 0.00004,
        y: this.host.clientHeight / 2 - (p.lat - this.center.lat()) / 0.00004,
      };
    }
    render() {
      if (!this.svg) return;
      const w = this.host.clientWidth,
        h = this.host.clientHeight;
      let content = '<rect width="100%" height="100%" fill="#f1f0e8"/>';
      for (let i = -6; i < 14; i++)
        content +=
          '<path d="M' +
          i * 48 +
          " 0 L" +
          (i * 48 + 100) +
          " " +
          h +
          '" stroke="white" stroke-width="7"/><path d="M0 ' +
          i * 55 +
          " L" +
          w +
          " " +
          (i * 55 - 50) +
          '" stroke="white" stroke-width="7"/>';
      for (const o of objects.filter((o) => o.map === this)) {
        if (o.kind === "line") {
          const points = o.path.map((p) => this.project(p));
          content +=
            '<polyline points="' +
            points.map((p) => p.x + "," + p.y).join(" ") +
            '" fill="none" stroke="' +
            o.options.strokeColor +
            '" stroke-width="' +
            o.options.strokeWeight +
            '" stroke-linecap="round" stroke-linejoin="round"/>';
        } else if (o.kind === "marker" && o.visible && o.position) {
          const p = this.project(o.position);
          content +=
            '<circle cx="' +
            p.x +
            '" cy="' +
            p.y +
            '" r="8" fill="' +
            (o.icon?.fillColor || o.options.icon.fillColor) +
            '" stroke="white" stroke-width="3"/>';
        }
      }
      this.svg.innerHTML = content;
      for (const overlay of this.overlays) overlay.draw();
    }
  }
  class Marker {
    constructor(options) {
      this.options = options;
      this.kind = "marker";
      this.map = options.map;
      this.visible = true;
      objects.push(this);
    }
    setVisible(v) {
      this.visible = v;
      this.map.render();
    }
    setPosition(p) {
      this.position = p;
      this.map.render();
    }
    setIcon(i) {
      this.icon = i;
    }
    setOpacity() {}
  }
  class Polyline {
    constructor(options) {
      this.options = options;
      this.kind = "line";
      this.map = options.map;
      this.path = [];
      objects.push(this);
    }
    setOptions(options) {
      Object.assign(this.options, options);
    }
    setPath(p) {
      this.path = p;
      this.map.render();
    }
  }
  class OverlayView {
    setMap(map) {
      if (this.map) {
        this.map.overlays = this.map.overlays.filter((o) => o !== this);
        this.onRemove?.();
      }
      this.map = map;
      if (map) {
        map.overlays.push(this);
        this.onAdd?.();
        this.draw?.();
      }
    }
    getPanes() {
      return this.map.panes;
    }
    getProjection() {
      const project = (p) => this.map.project({ lat: p.lat(), lng: p.lng() });
      return {
        fromLatLngToDivPixel: project,
        fromLatLngToContainerPixel: project,
      };
    }
  }
  class Circle {
    constructor() {}
    setCenter() {}
    setRadius() {}
    setVisible() {}
  }
  class LatLngBounds {
    constructor() {
      this.points = [];
    }
    extend(p) {
      this.points.push(p);
      return this;
    }
  }
  window.google = {
    maps: {
      Map,
      OverlayView,
      LatLng,
      Size: class {
        constructor(width, height) {
          this.width = width;
          this.height = height;
        }
      },
      Marker,
      Polyline,
      Circle,
      LatLngBounds,
      Point: class {
        constructor(x, y) {
          this.x = x;
          this.y = y;
        }
      },
      SymbolPath: { CIRCLE: "circle" },
    },
  };
  const update = window.pepoUpdate;
  window.pepoUpdate = (s) => {
    window.__pepoTestLastState = JSON.parse(JSON.stringify(s));
    update(s);
  };
  window.pepoInit();
})();
