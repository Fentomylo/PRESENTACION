import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  color,
  hash,
  instanceIndex,
  instancedArray,
  max,
  mix,
  mod,
  pow,
  step,
  storage,
  uint,
  uv,
  vec3,
  vec4,
  sin,
  cos,
  floor,
  float,
  abs
} from 'three/tsl';

// Genera, en CPU, una nube de puntos que forma 3 flechas curvas dispuestas en
// círculo alrededor del centro (estilo símbolo de reciclaje).
function generateArrowRingPoints(count) {
  const points = new Float32Array(count * 3);

  const arrowCount = 3;
  const ringRadius = 4.0;      
  const shaftHalfW = 0.55;     
  const gapDeg = 22;           
  const headFracOfArc = 0.32;  
  const headHalfW = shaftHalfW * 2.4; 

  const arcDeg = 360 / arrowCount - gapDeg;
  const arcLen = (arcDeg * Math.PI / 180) * ringRadius;
  const headLen = arcLen * headFracOfArc;
  const shaftLen = arcLen - headLen;

  const inShapeLocal = (u, v) => {
    if (u >= 0 && u <= shaftLen && Math.abs(v) <= shaftHalfW) return true;
    if (u > shaftLen && u <= shaftLen + headLen) {
      const t = (u - shaftLen) / headLen;
      const halfW = headHalfW * (1.0 - t);
      if (Math.abs(v) <= halfW) return true;
    }
    return false;
  };

  const perArrow = Math.floor(count / arrowCount);
  let idx = 0;

  for (let a = 0; a < arrowCount; a++) {
    const startDeg = a * (360 / arrowCount) + gapDeg / 2;
    const startAngle = startDeg * Math.PI / 180;
    const targetCount = (a === arrowCount - 1) ? (count - idx) : perArrow;

    let placed = 0;
    let guard = 0;
    while (placed < targetCount && guard < targetCount * 400) {
      guard++;
      const u = Math.random() * (shaftLen + headLen);
      const v = (Math.random() * 2 - 1) * headHalfW;
      if (inShapeLocal(u, v)) {
        const angle = startAngle + (u / ringRadius); 
        const r = ringRadius + v;
        points[idx * 3 + 0] = r * Math.cos(angle);
        points[idx * 3 + 1] = r * Math.sin(angle);
        points[idx * 3 + 2] = (Math.random() - 0.5) * 0.6;
        idx++;
        placed++;
      }
    }
  }

  return points;
}

// Genera el Planeta Tierra y el Hilo de Coseno atravesándolo (con profundidad Z negativa)
function generateWorldAndRedThreadPoints(count) {
  const points = new Float32Array(count * 3);
  const sphereCount = Math.floor(count * 0.70);
  const threadCount = count - sphereCount;

  let idx = 0;
  const sphereRadius = 2.4;
  const sphereCenter = new THREE.Vector3(0.0, 0.0, -0.8);

  for (let i = 0; i < sphereCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const rVar = sphereRadius * (0.96 + Math.random() * 0.08);

    points[idx * 3 + 0] = sphereCenter.x + rVar * Math.sin(phi) * Math.cos(theta);
    points[idx * 3 + 1] = sphereCenter.y + rVar * Math.sin(phi) * Math.sin(theta);
    points[idx * 3 + 2] = sphereCenter.z + rVar * Math.cos(phi);
    idx++;
  }

  const startX = -6.5;
  const endX = 3.5;

  for (let i = 0; i < threadCount; i++) {
    const t = i / (threadCount - 1);
    const x = THREE.MathUtils.lerp(startX, endX, t);
    const frequency = 3.2; 
    const amplitude = 1.8;
    const y = Math.cos(t * Math.PI * frequency) * amplitude + (Math.random() - 0.5) * 0.15;
    const z = -0.8 + (Math.random() - 0.5) * 0.4;

    points[idx * 3 + 0] = x;
    points[idx * 3 + 1] = y;
    points[idx * 3 + 2] = z;
    idx++;
  }

  return points;
}

// Genera la forma de una bomba atómica (hongo nuclear con base expansiva y columna) en CPU
function generateAtomicBombPoints(count) {
  const points = new Float32Array(count * 3);
  const stemCount = Math.floor(count * 0.35); // 35% para la columna del hongo
  const capCount = count - stemCount;         // 65% para la gran nube superior (sombrero)

  let idx = 0;
  const center = new THREE.Vector3(-1.2, -1.0, 0.0); // Ubicada más a la izquierda como pediste

  for (let i = 0; i < stemCount; i++) {
    const t = Math.random();
    const y = center.y + t * 3.5;
    const radius = (0.3 + (1.0 - t) * 0.5) * (0.8 + Math.random() * 0.4);
    const theta = Math.random() * Math.PI * 2.0;

    points[idx * 3 + 0] = center.x + Math.cos(theta) * radius;
    points[idx * 3 + 1] = y;
    points[idx * 3 + 2] = center.z + Math.sin(theta) * radius + (Math.random() - 0.5) * 0.3;
    idx++;
  }

  for (let i = 0; i < capCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);

    const rx = 2.8 * (0.8 + Math.random() * 0.3);
    const ry = 1.2 * (0.8 + Math.random() * 0.3);
    const rz = 1.8 * (0.8 + Math.random() * 0.3);

    const capCenterY = center.y + 3.2;

    points[idx * 3 + 0] = center.x + Math.sin(phi) * Math.cos(theta) * rx;
    points[idx * 3 + 1] = capCenterY + Math.cos(phi) * ry;
    points[idx * 3 + 2] = center.z + Math.sin(phi) * Math.sin(theta) * rz;
    idx++;
  }

  return points;
}

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  const shapeSeedBuffer = instancedArray(count, 'vec3');

  const arrowAttribute = new THREE.StorageInstancedBufferAttribute(generateArrowRingPoints(count), 3);
  const arrowTargetBuffer = storage(arrowAttribute, 'vec3', count);

  const worldThreadAttribute = new THREE.StorageInstancedBufferAttribute(generateWorldAndRedThreadPoints(count), 3);
  const worldThreadTargetBuffer = storage(worldThreadAttribute, 'vec3', count);

  const atomicBombAttribute = new THREE.StorageInstancedBufferAttribute(generateAtomicBombPoints(count), 3);
  const atomicBombTargetBuffer = storage(atomicBombAttribute, 'vec3', count);

  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);
    const seed = shapeSeedBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));
    const r5 = hash(i.add(uint(71)));
    const r6 = hash(i.add(uint(89)));

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45)));
    v.assign(vec3(0.0));
    seed.assign(vec3(r4, r5, r6));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);
    const seed = shapeSeedBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    // 1) ESCENA 1: Contiene Slide 1 (Flechas), Slide 2 (Vórtice) y Slide 3 (Planeta + Hilo Coseno)
    If(params.sceneId.equal(1.0), () => {
      const gx = seed.x.sub(0.5).mul(10.0);
      const gy = seed.y.sub(0.5).mul(10.0);
      const gz = seed.z.sub(0.5).mul(2.0);
      const gridTarget = vec3(gx, gy, gz);

      const s = params.slideId;
      const isSlide1 = step(s, 1.5);
      const isSlide2 = step(1.5, s).mul(step(s, 2.5));
      const isSlide3 = step(2.5, s).mul(step(s, 3.5));
      const isSlideAfter3 = step(3.5, s);

      const expansion = params.transitionProgress.mul(3.5).mul(isSlideAfter3);
      const gridExplodeTarget = gridTarget.add(gridTarget.normalize().mul(expansion)).add(params.formationOffset);

      const arrowRaw = arrowTargetBuffer.element(instanceIndex);
      const rotationSpeed = 0.18;
      const theta = params.elapsedTime.mul(rotationSpeed);
      const cosT = cos(theta);
      const sinT = sin(theta);
      const arrowX = arrowRaw.x.mul(cosT).sub(arrowRaw.y.mul(sinT));
      const arrowY = arrowRaw.x.mul(sinT).add(arrowRaw.y.mul(cosT));
      const arrowTarget = vec3(arrowX, arrowY, arrowRaw.z).add(params.formationOffset);

      const vt = seed.x;
      const strand = floor(seed.y.mul(2.0));
      const vRadius = mix(0.15, 2.8, pow(vt, 0.65));
      const vAngle = strand.mul(Math.PI)
        .add(vt.mul(2.2 * Math.PI * 2))
        .add(params.elapsedTime.mul(0.6));
      const vCenter = vec3(-4.6, 3.3, 0.0).add(vec3(0.7071, -0.7071, 0.0).mul(vt.mul(9.0)));
      const vPosXY = vCenter.add(vec3(cos(vAngle).mul(vRadius), sin(vAngle).mul(vRadius), 0.0));
      const vZJitter = seed.z.sub(0.5).mul(1.2);
      const vortexTarget = vec3(vPosXY.x, vPosXY.y, vZJitter).add(params.formationOffset);

      const worldThreadRaw = worldThreadTargetBuffer.element(instanceIndex);
      const worldThreadTarget = worldThreadRaw.add(params.formationOffset);

      const wArrow = isSlide1.add(isSlide2.mul(mix(1.0, 0.0, params.transitionProgress)));
      const wVortex = isSlide2.mul(params.transitionProgress).add(isSlide3.mul(mix(1.0, 0.0, params.transitionProgress)));
      const wWorldThread = isSlide3.mul(params.transitionProgress).add(isSlideAfter3.mul(mix(1.0, 0.0, params.transitionProgress)));

      const target = arrowTarget.mul(wArrow).add(vortexTarget.mul(wVortex)).add(worldThreadTarget.mul(wWorldThread)).add(gridExplodeTarget.mul(isSlideAfter3));

      force.addAssign(target.sub(p).mul(2.5));
    });

    // 2) ESCENA 2: Diapositiva 4 (Molinos originales), Diapositiva 5 (Bomba Atómica con pulsación rítmica) y Diapositiva 6 (Comunidad)
    If(params.sceneId.equal(2.0), () => {
      const s = params.slideId;
      const isSlide4 = step(s, 4.5); // Diapositiva 4 exacta
      const isSlide5 = step(4.5, s).mul(step(s, 5.5)); // Diapositiva 5: Bomba Atómica
      const isSlide6 = step(5.5, s); // Diapositiva 6

      // Círculos/Molinos exactos de la diapositiva 4
      const clusterId = floor(seed.x.mul(3.0));
      let wheelCenter = vec3(-0.8, 1.8, 0.0);
      const isInd = step(0.5, clusterId).sub(step(1.5, clusterId));
      const isCiu = step(1.5, clusterId);

      wheelCenter = mix(wheelCenter, vec3(2.5, -1.0, 0.0), isInd);
      wheelCenter = mix(wheelCenter, vec3(-0.8, -2.0, 0.0), isCiu);

      const rad = seed.y.mul(1.8).add(0.2);
      const rotAngle = seed.z.mul(Math.PI * 2.0).add(params.elapsedTime.mul(1.5).mul(mix(1.0, -1.2, isInd))); 
      const wheelX = wheelCenter.x.add(cos(rotAngle).mul(rad));
      const wheelY = wheelCenter.y.add(sin(rotAngle).mul(rad));
      const wheelZ = wheelCenter.z.add(seed.z.sub(0.5).mul(0.5));
      const windmillTarget = vec3(wheelX, wheelY, wheelZ).add(params.formationOffset);

      // Objetivo de la bomba atómica con pulsación rítmica de impacto periódico
      const bombRaw = atomicBombTargetBuffer.element(instanceIndex);
      const shockwave = abs(sin(params.elapsedTime.mul(4.0))).mul(0.18);
      const bombPulse = float(1.0).add(shockwave);
      const bombCenter = vec3(-1.2, -1.0, 0.0);
      const bombTarget = bombRaw.sub(bombCenter).mul(bombPulse).add(bombCenter).add(params.formationOffset);

      // Objetivo para la diapositiva 6
      let defaultCenter = vec3(-4.0, 2.0, 0.0);
      const isB = step(0.5, seed.x).sub(step(1.5, seed.x));
      const isC = step(1.5, seed.x);
      defaultCenter = mix(defaultCenter, vec3(4.0, 2.0, 0.0), isB);
      defaultCenter = mix(defaultCenter, vec3(0.0, -3.0, 0.0), isC);

      const centroid = vec3(0.0, 0.33, 0.0);
      const mergeFactor = isSlide6;
      defaultCenter = mix(defaultCenter, centroid, mergeFactor);
      const spread = vec3(seed.y.sub(0.5), seed.z.sub(0.5), hash(instanceIndex)).mul(3.0);
      const defaultTarget = defaultCenter.add(spread).add(params.formationOffset);

      // Selección de objetivo por diapositiva
      let target = mix(defaultTarget, windmillTarget, isSlide4);
      target = mix(target, bombTarget, isSlide5);

      force.addAssign(target.sub(p).mul(3.0));

      If(params.interactionActive.greaterThan(0.0), () => {
        const toMouse = params.attractor.sub(p);
        const d = max(toMouse.length(), 0.1);
        force.addAssign(toMouse.div(d).mul(1.5));
      });
    });

    // 3) ESCENA 3: Acoplamiento Generacional
    If(params.sceneId.equal(3.0), () => {
      const isYouth = step(0.5, seed.z);
      const s = params.slideId;

      const f8 = step(7.5, s).mul(step(s, 8.5));
      const convergeFactor = step(8.5, s);
      const f9 = step(8.5, s).mul(step(s, 9.5));

      const freq = mix(mix(2.0, 5.0, isYouth), 3.5, convergeFactor);
      const lag = f8.mul(0.6).mul(isYouth);
      const phaseGap = f9.mul(1.2).mul(isYouth);

      const waveY = sin(params.elapsedTime.sub(lag).mul(freq).add(seed.x.mul(10.0)).add(phaseGap)).mul(2.2);
      const waveX = seed.x.sub(0.5).mul(12.0);
      const target = vec3(waveX, waveY, seed.y.sub(0.5).mul(2.0)).add(params.formationOffset);

      force.addAssign(target.sub(p).mul(3.5));
    });

    // 4) ESCENA 4: El Núcleo Vivo
    If(params.sceneId.equal(4.0), () => {
      const isYouth = step(0.5, seed.z);
      const s = params.slideId;
      const f11 = step(10.5, s).mul(step(s, 11.5));
      const f13 = step(12.5, s);

      const centerDir = params.formationOffset.sub(p).normalize();
      const basePulse = sin(params.elapsedTime.mul(2.0)).mul(0.2).add(2.8);
      const youthLead = f11.mul(isYouth).mul(0.9);
      const radius = basePulse.sub(youthLead).add(f13.mul(1.1));

      let target = params.formationOffset.add(centerDir.negate().mul(radius));
      target = vec3(target.x, target.y, target.z.mul(mix(1.0, 0.35, f13)));

      const stiffness = mix(3.0, 1.8, f13);
      force.addAssign(target.sub(p).mul(stiffness));
    });

    force.addAssign(v.mul(params.dragCoefficient).mul(-1.0));
    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));
  })().compute(count).setName('Update Particles');

  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();

  material.scaleNode = Fn(() => {
    const sizeSeed = hash(instanceIndex.add(uint(211)));
    return params.particleSize.mul(mix(0.6, 1.8, sizeSeed));
  })();

  material.colorNode = Fn(() => {
    const col1 = color('#4fd6ff');
    const colArrow = color('#3ddc5a'); 
    const colGold = color('#ffd873');  
    const colMagentaRed = color('#ff1a53'); 
    const col2 = color('#ff5522');
    const col3 = color('#8a3ffc');
    const col4 = color('#ffdd44');

    let baseColor = mix(col1, col2, step(1.5, params.sceneId));
    baseColor = mix(baseColor, col3, step(2.5, params.sceneId));
    baseColor = mix(baseColor, col4, step(3.5, params.sceneId));

    const s = params.slideId;
    const isSlide1 = step(s, 1.5);
    const isSlide2 = step(1.5, s).mul(step(s, 2.5));
    const isSlide3 = step(2.5, s).mul(step(s, 3.5));
    const isScene1 = step(params.sceneId, 1.5);

    const arrowWeight = isSlide1.add(isSlide2.mul(mix(1.0, 0.0, params.transitionProgress))).mul(isScene1);
    baseColor = mix(baseColor, colArrow, arrowWeight);

    const vortexWeight = isSlide2.mul(params.transitionProgress)
      .add(isSlide3.mul(mix(1.0, 0.0, params.transitionProgress)))
      .mul(isScene1);
    const goldStrand = step(0.5, hash(instanceIndex.add(uint(701))));
    baseColor = mix(baseColor, colGold, vortexWeight.mul(goldStrand));

    const isThreadParticle = step(0.70, instanceIndex.toFloat().div(float(count)));
    baseColor = mix(baseColor, colMagentaRed, isSlide3.mul(isScene1).mul(isThreadParticle));

    // --- Colores para la Diapositiva 4 (Molinos originales) ---
    const isScene2 = step(1.5, params.sceneId).mul(step(params.sceneId, 2.5));
    const isSlide4Color = isScene2.mul(step(s, 4.5));
    
    const clusterId = floor(hash(instanceIndex.add(uint(413))).mul(3.0));
    const isAcademia = step(clusterId, 0.5);
    const isIndustria = step(0.5, clusterId).sub(step(1.5, clusterId));
    const isCiudad = step(1.5, clusterId);

    const colAcademia = color('#ff2a85');
    const colIndustria = color('#ff5522');
    const colCiudad = color('#4fd6ff');

    const windmillColorMix = colAcademia.mul(isAcademia)
      .add(colIndustria.mul(isIndustria))
      .add(colCiudad.mul(isCiudad));

    baseColor = mix(baseColor, windmillColorMix, isSlide4Color);

    // --- Colores para la Diapositiva 5 (Bomba Atómica: Blanco, Amarillo y Naranja con destello de impacto) ---
    const isSlide5Color = isScene2.mul(step(4.5, s)).mul(step(s, 5.5));
    
    const bombMixVal = hash(instanceIndex.add(uint(921)));
    const isWhiteCore = step(bombMixVal, 0.3);
    const isYellowCore = step(0.3, bombMixVal).sub(step(0.7, bombMixVal));
    const isOrangeOuter = step(0.7, bombMixVal);

    const colWhite = color('#ffffff');
    const colYellow = color('#ffe600');
    const colOrange = color('#ff5500');

    const atomicColorMix = colWhite.mul(isWhiteCore)
      .add(colYellow.mul(isYellowCore))
      .add(colOrange.mul(isOrangeOuter));

    const flash = abs(sin(params.elapsedTime.mul(4.0))).mul(0.4).add(0.8);
    baseColor = mix(baseColor, atomicColorMix.mul(flash), isSlide5Color);

    const brightnessSeed = hash(instanceIndex.add(uint(311)));
    baseColor = baseColor.mul(mix(0.8, 1.4, brightnessSeed));

    return vec4(baseColor, 0.95);
  })();

  material.opacityNode = Fn(() => {
    const falloff = max(uv().xy.sub(0.5).length().mul(-2.0).add(1.0), 0.0);
    return pow(falloff, 0.55);
  })();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function reset() {
    renderer.compute(initParticles);
  }

  function stepSimulation() {
    renderer.compute(updateParticles);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(mesh);
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    reset,
    stepSimulation,
    dispose
  };
}