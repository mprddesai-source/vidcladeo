// "Kite Day": original 2.5 s timing-test scene. A kid on a grassy hill waves at the camera; windmill, trees,
// flowers and a drifting red kite behind; slow camera push-in. Uses the cartoon-3d-short look modules
// (two-tone world shading, ink pass, lens blur, bloom, grade, toon character cards) with a new scene and character.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { loadKit } from "../bridge/world";
import { Kit, lam, kitClone } from "../bridge/build";
import { rep, grassHD, cloudHD } from "../bridge/paint";
import { LIGHTS, LOOK } from "../bridge/lights";
import { TONE, CHAR, untone } from "../bridge/shade";
import { InkPass, NOINK, noInkFallback } from "../bridge/ink";
import { LensBlur } from "../bridge/lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "../bridge/grade";
import { Pool, Actor, Fx } from "../bridge/cast";
import { Outfit, bodyFront, fxContact, INK } from "../bridge/toon";

export const MEADOW_FRAMES = 75;
const FPS = 30;
const L = LIGHTS.day, K = LOOK.day;

// our own character: Pip, green jacket, mustard trousers, red sneakers, yellow cap
const PIP: Outfit = { jacket: "#2f9e6e", pants: "#d8a23a", boots: "#d8433a", hat: "cap", cap: "#f2c641", build: "kid" };

const ss = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * t * (t * (6 * t - 15) + 10); };

class Meadow {
  root = new THREE.Group();
  pool = new Pool();
  kid: Actor; kite: Fx; contact: Fx;
  sun = new THREE.DirectionalLight("#fff0d6", 2.6);
  hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
  fog = new THREE.Fog("#b8d0ec", 25, 300);
  skyMat: THREE.ShaderMaterial; sky: THREE.Mesh;
  clouds: THREE.Mesh[] = [];

  constructor(kit: Kit) {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    K.sky.c.forEach((h, i) => untone(h, this.skyMat.uniforms["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d));
    this.skyMat.uniforms.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);

    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);

    // rolling hill: the kid's knoll at the origin, a long slope down to the windmill field
    const g = new THREE.PlaneGeometry(400, 400, 160, 160); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, 1.2 * Math.exp(-(x * x + z * z) / 60) + 2.5 * Math.exp(-((x + 30) ** 2 + (z + 70) ** 2) / 900) - 0.004 * Math.max(0, -z));
    }
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, lam("meadowGrass", () => ({ map: rep(grassHD(), 60, 60) })));
    ground.receiveShadow = true; R.add(ground);
    const hY = (x: number, z: number) => 1.2 * Math.exp(-(x * x + z * z) / 60) + 2.5 * Math.exp(-((x + 30) ** 2 + (z + 70) ** 2) / 900) - 0.004 * Math.max(0, -z);

    const put = (name: string, x: number, z: number, h: number, yaw = 0, cast = true) => {
      const o = kitClone(kit, name, h); if (!o) return;
      o.position.set(x, hY(x, z) - 0.05, z); o.rotation.y = yaw;
      o.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = cast; });
      R.add(o);
    };
    put("windmill", 7, -48, 12, -0.9);
    for (const [n, x, z, h] of [["tree_oak", -9, -16, 7], ["tree_fat", -15, -24, 8], ["tree_detailed", 16, -22, 7.5], ["tree_cone", 22, -45, 9],
      ["tree-high-round", -26, -50, 10], ["tree_default", 4, -60, 8], ["tree_oak", -40, -80, 9], ["plant_bushLarge", -4.5, -6, 1.6],
      ["plant_bushDetailed", 5, -8, 1.4], ["plant_bush", 3.2, -3.5, 0.9]] as const) put(n, x, z, h, x * 0.3);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, d = 2 + r() * 9, x = Math.cos(a) * d, z = Math.sin(a) * d - 2;
      if (z > 2.5 && Math.abs(x) < 2) continue; // keep the lens path clear
      put(["flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass"][i % 5], x, z, 0.35 + r() * 0.3, r() * 6, false);
    }
    put("lantern", -2.2, -1.2, 1.9, 0.4);

    const cm = [0, 1, 2, 3].map((k) => cloudHD(k, K.cloud));
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32, d = 640;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cm[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 150 + (i % 3) * 40;
      m.scale.set(w, w / 2, 1); m.position.set(Math.cos(a) * d, 70 + (i % 3) * 45, Math.sin(a) * d);
      m.layers.set(NOINK); m.renderOrder = -0.8; this.clouds.push(m); R.add(m);
    }

    this.kid = new Actor(R);
    this.contact = new Fx(R);
    this.kite = new Fx(R);
  }

  update(f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, u = ss(f / (MEADOW_FRAMES - 1));
    const kidY = 1.2;
    // camera: low, slow push-in with a gentle arc and a small roll
    cam.position.set(1.0 - 0.7 * u, kidY + 1.25 - 0.1 * u, 5.2 - 1.0 * u);
    cam.up.set(0, 1, 0); cam.lookAt(0.1 * u, kidY + 1.75, -4); cam.rotateZ(THREE.MathUtils.degToRad(-2 + 3 * u));
    cam.fov = 38; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);

    // sun camera-relative (day preset: az 75 deg to screen right, el 48), frozen for the shot
    const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
    const fx0 = 0.12, fz0 = -0.99, hx = fx0 * Math.cos(az) - fz0 * Math.sin(az), hz = fz0 * Math.cos(az) + fx0 * Math.sin(az);
    const sunDir = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const focus = new THREE.Vector3(0, kidY + 1, 0);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera, Rr = 30;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) m.lookAt(cam.position.x, m.position.y, cam.position.z);

    // Pip: grins and waves (2 waves/s), one blink at ~1.2 s
    const fb = f - 36, blink = fb >= 0 && fb < 4 ? [0.5, 1, 1, 0.5][fb] : 0;
    const wave = Math.sin(t * Math.PI * 4);
    const opts = { mode: "stand" as const, expr: "grin" as const, wave, blink, look: 0.15, seed: 3 };
    const key = `pip|${opts.wave.toFixed(2)}|${blink}`;
    this.kid.r = this.pool.req(key, 600, 1000, 1, (p) => bodyFront(p, PIP, opts));
    this.contact.r = this.pool.req("blob|contact|#5a5c86", 128, 128, 1, (p) => fxContact(p, "#5a5c86"));
    // kite: red diamond with a bow tail, drifting and bobbing high up-left
    const sway = Math.sin(t * 2.6) * 0.25;
    this.kite.r = this.pool.req(`kite|${sway.toFixed(2)}`, 256, 512, 1, (p) => {
      p.poly([[128, 20], [215, 130], [128, 250], [41, 130]], "#e2453c", 6);
      p.poly([[128, 20], [215, 130], [128, 130]], "#f2c641", 0);
      p.stroke([[128, 20], [128, 250]], 4, INK); p.stroke([[41, 130], [215, 130]], 4, INK);
      const tail: [number, number][] = [];
      for (let i = 0; i <= 10; i++) tail.push([128 + Math.sin(i * 0.9 + sway * 6) * 22, 250 + i * 25]);
      p.stroke(tail, 4, INK);
      for (const k of [3, 6, 9]) p.ell(tail[k][0], tail[k][1], 14, 8, ["#2f9e6e", "#f2c641", "#3b7dd8"][k % 3], 3);
    });
    this.pool.flush();
    this.kid.bind(); this.contact.bind(); this.kite.bind();

    const km = this.kid.mesh;
    km.visible = true; km.position.set(0, kidY - 0.02, 0); km.scale.setScalar(1);
    km.rotation.set(0, Math.atan2(cam.position.x, cam.position.z), 0);
    const cb = this.contact.mesh;
    cb.visible = true; cb.position.set(0.02, kidY + 0.02, 0.02); cb.rotation.set(-Math.PI / 2, 0, 0); cb.scale.set(0.9, 0.6, 1);
    const kt = this.kite.mesh;
    kt.visible = true; kt.position.set(-2.4 + 0.5 * t, 5.6 + 0.3 * Math.sin(t * 2.1), -7); kt.scale.set(0.9, 1.8, 1);
    kt.lookAt(cam.position); kt.rotateZ(sway * 0.6);
    return focus;
  }
}

const Inner: React.FC<{ kit: Kit }> = ({ kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new Meadow(kit), [kit]);
  const fx = useMemo(() => {
    const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
    const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
    mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
    return { ink: new InkPass(scene, camera as THREE.PerspectiveCamera), lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }), bloom: b,
      tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day) };
  }, [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const cam = camera as THREE.PerspectiveCamera;
  const focus = world.update(f, cam, scene);
  noInkFallback(world.root);
  const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
  fx.lens.focus = Math.max(0.3, focus.clone().sub(cam.position).dot(fwd));
  fx.lens.cInf = 12;
  gradeFor(fx.grade, "day");
  return (
    <>
      <primitive object={world.root} dispose={null} />
      <EffectComposer multisampling={4}>
        <primitive object={fx.ink} dispose={null} />
        <primitive object={fx.lens.pre} dispose={null} />
        <primitive object={fx.lens.main} dispose={null} />
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
        <primitive object={fx.grade} dispose={null} />
      </EffectComposer>
    </>
  );
};

export const KiteDay: React.FC = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("meadow kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {kit && (
        <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, toneMappingExposure: 1.0 }} camera={{ fov: 38, near: 0.2, far: 1500 }}>
          <Inner kit={kit} />
        </ThreeCanvas>
      )}
    </AbsoluteFill>
  );
};
