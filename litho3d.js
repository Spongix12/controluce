// Viewer 3D della litofania in cornice (three.js r149, build classica).
// Espone window.LithoViewer. Unità di scena: 1 = 1 cm.
(function () {
  const FRAME_BORDER = 1.1;   // larghezza bordo cornice
  const FRAME_DEPTH = 1.2;    // profondità cornice
  const T_MIN = 0.8;          // spessore minimo lastra (mm): zone chiare
  const T_MAX = 3.0;          // spessore massimo lastra (mm): zone scure

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  // Luce trasmessa: legge di Beer-Lambert sullo spessore, con assorbimento
  // maggiore sul blu (PLA bianco controluce vira al caldo nelle zone spesse).
  // Spenta: plastica bianca illuminata frontalmente, il rilievo dà solo ombreggiature.
  const fragmentShader = `
    uniform sampler2D map;
    uniform vec2 texel;
    uniform float lit;
    uniform vec3 lamp;
    uniform float tMin;
    uniform float tMax;
    varying vec2 vUv;

    float thick(vec2 uv) { return 1.0 - texture2D(map, uv).r; }

    void main() {
      float th = thick(vUv);
      float mm = mix(tMin, tMax, th);

      vec3 mu = vec3(1.05, 1.45, 2.15);
      vec3 trans = lamp * exp(-mu * (mm - tMin));
      float d = distance(vUv, vec2(0.5, 0.46));
      float falloff = 1.0 - 0.55 * d * d;
      vec3 litColor = trans * falloff * 1.08;

      float hx = thick(vUv + vec2(texel.x, 0.0)) - thick(vUv - vec2(texel.x, 0.0));
      float hy = thick(vUv + vec2(0.0, texel.y)) - thick(vUv - vec2(0.0, texel.y));
      vec3 n = normalize(vec3(-hx * 2.2, -hy * 2.2, 1.0));
      float diff = clamp(dot(n, normalize(vec3(-0.45, 0.55, 0.75))), 0.0, 1.0);
      vec3 plastic = vec3(0.925, 0.915, 0.895);
      vec3 unlitColor = plastic * (0.80 + 0.20 * diff) - th * 0.05;

      // righe di layer appena percettibili
      float lines = 1.0 - 0.012 * step(0.5, fract(vUv.y * 240.0));
      gl_FragColor = vec4(mix(unlitColor, litColor, lit) * lines, 1.0);
    }`;

  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function rectPath(w, h) {
    const p = new THREE.Path();
    p.moveTo(-w / 2, -h / 2);
    p.lineTo(-w / 2, h / 2);
    p.lineTo(w / 2, h / 2);
    p.lineTo(w / 2, -h / 2);
    p.lineTo(-w / 2, -h / 2);
    return p;
  }

  // Staffa ad anello trapezoidale, come quella del generatore MakerLab
  function kickstandShape(topW, botW, len, bar) {
    const outer = new THREE.Shape();
    outer.moveTo(-topW / 2, 0);
    outer.lineTo(topW / 2, 0);
    outer.lineTo(botW / 2, -len);
    outer.lineTo(-botW / 2, -len);
    outer.lineTo(-topW / 2, 0);
    const k = bar * 1.4;
    const hole = new THREE.Path();
    hole.moveTo(-topW / 2 + k, -bar);
    hole.lineTo(-botW / 2 + k, -len + bar);
    hole.lineTo(botW / 2 - k, -len + bar);
    hole.lineTo(topW / 2 - k, -bar);
    hole.lineTo(-topW / 2 + k, -bar);
    outer.holes.push(hole);
    return outer;
  }

  class LithoViewer {
    constructor(container, opts = {}) {
      this.container = container;
      this.opts = Object.assign({ autoRotate: false, interactive: true, startAngle: -0.55 }, opts);
      this.litTarget = 1;
      this.litValue = 1;
      this.visible = true;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      this.renderer = renderer;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);

      this.scene.add(new THREE.HemisphereLight(0xfff4e6, 0x2a2420, 0.45));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(-18, 26, 30);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.radius = 6;
      Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xffc68a, 0.55);
      rim.position.set(20, 10, -30);
      this.scene.add(rim);
      // luce calda dietro la lastra: illumina il bordo interno della cornice da accesa
      this.backLight = new THREE.PointLight(0xffb15c, 0, 30, 2);
      this.scene.add(this.backLight);

      this.panelMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          map: { value: null },
          texel: { value: new THREE.Vector2(1 / 600, 1 / 800) },
          lit: { value: 1 },
          lamp: { value: new THREE.Color(1.0, 0.93, 0.80) },
          tMin: { value: T_MIN },
          tMax: { value: T_MAX },
        },
      });
      this.frameMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0b0b, roughness: 0.55, metalness: 0.05 });
      this.backMaterial = new THREE.MeshStandardMaterial({ color: 0x090808, roughness: 0.75 });

      this.root = new THREE.Group();
      this.scene.add(this.root);

      this.ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.22 }));
      this.ground.rotation.x = -Math.PI / 2;
      this.ground.receiveShadow = true;
      this.scene.add(this.ground);

      if (this.opts.interactive && THREE.OrbitControls) {
        const c = new THREE.OrbitControls(this.camera, renderer.domElement);
        c.enableDamping = true;
        c.dampingFactor = 0.08;
        c.enablePan = false;
        c.rotateSpeed = 0.7;
        c.minPolarAngle = 0.25;
        c.maxPolarAngle = Math.PI / 2 - 0.02;
        c.autoRotate = this.opts.autoRotate;
        c.autoRotateSpeed = 1.1;
        c.addEventListener("start", () => { c.autoRotate = false; container.classList.add("is-grabbing"); });
        c.addEventListener("end", () => container.classList.remove("is-grabbing"));
        this.controls = c;
      }

      this.setSize(15, 20);

      new ResizeObserver(() => this.resize()).observe(container);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(container);
      this.resize();
      this.clock = new THREE.Clock();
      this.loop();
    }

    // Dimensioni della lastra in cm
    setSize(w, h) {
      this.w = w;
      this.h = h;
      this.root.children.slice().forEach((m) => { this.root.remove(m); m.geometry?.dispose(); });
      const b = FRAME_BORDER, d = FRAME_DEPTH;

      const outer = roundedRectShape(w + 2 * b, h + 2 * b, 0.35);
      outer.holes.push(rectPath(w, h));
      const frameGeo = new THREE.ExtrudeGeometry(outer, {
        depth: d, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 6,
      });
      frameGeo.translate(0, 0, -d / 2);
      const frame = new THREE.Mesh(frameGeo, this.frameMaterial);
      frame.castShadow = true;
      this.root.add(frame);

      // battuta interna: la lastra è incassata di qualche mm
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.panelMaterial);
      panel.position.z = d / 2 - 0.3;
      this.root.add(panel);

      const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.25), this.backMaterial);
      back.position.z = -d / 2 + 0.125;
      back.castShadow = true;
      this.root.add(back);

      // staffa: cerniera sul retro, piede appoggiato a terra
      const angle = 0.42;
      const groundY = -(h / 2 + b) - 0.08;
      const hingeY = h * 0.12;
      const len = (hingeY - groundY) / Math.cos(angle);
      const standW = Math.min(w * 0.42, 7);
      const stand = new THREE.Mesh(
        new THREE.ExtrudeGeometry(kickstandShape(standW * 0.55, standW, len, 0.75), {
          depth: 0.35, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2,
        }),
        this.frameMaterial
      );
      stand.geometry.translate(0, 0, -0.35);
      stand.position.set(0, hingeY, -d / 2);
      stand.rotation.x = angle;
      stand.castShadow = true;
      this.root.add(stand);

      // ganci della cerniera
      [-1, 1].forEach((s) => {
        const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.5), this.frameMaterial);
        hinge.position.set(s * standW * 0.24, hingeY - 0.2, -d / 2 - 0.2);
        this.root.add(hinge);
      });

      this.ground.position.y = groundY;
      this.backLight.position.set(0, 0, -d / 2 + 0.4);
      this.panelMaterial.uniforms.texel.value.set(1 / 600, 1 / (600 * h / w));
      this.frameCamera();
    }

    frameCamera() {
      const size = Math.max(this.w, this.h) + 2 * FRAME_BORDER;
      const dist = size * 3.3;
      const a = this.opts.startAngle;
      this.camera.position.set(Math.sin(a) * dist, size * 0.22, Math.cos(a) * dist);
      const target = new THREE.Vector3(0, -size * 0.04, 0);
      this.camera.lookAt(target);
      if (this.controls) {
        this.controls.target.copy(target);
        this.controls.minDistance = size * 1.8;
        this.controls.maxDistance = size * 5;
        this.controls.update();
      }
    }

    setTexture(canvas) {
      if (!this.texture || this.texture.image !== canvas) {
        this.texture?.dispose();
        this.texture = new THREE.CanvasTexture(canvas);
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture.anisotropy = 4;
        this.panelMaterial.uniforms.map.value = this.texture;
      }
      this.texture.needsUpdate = true;
    }

    setLit(on) { this.litTarget = on ? 1 : 0; }

    resize() {
      const { clientWidth: w, clientHeight: h } = this.container;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    loop() {
      requestAnimationFrame(() => this.loop());
      const dt = this.clock.getDelta();
      if (!this.visible) return;
      this.litValue += (this.litTarget - this.litValue) * Math.min(1, dt * 4);
      this.panelMaterial.uniforms.lit.value = this.litValue;
      this.backLight.intensity = this.litValue * 1.6;
      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
    }
  }

  LithoViewer.supported = (() => {
    try {
      const c = document.createElement("canvas");
      return !!(window.THREE && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch { return false; }
  })();

  window.LithoViewer = LithoViewer;
})();
