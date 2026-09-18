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
  abs,
  sqrt,
  clamp
} from 'three/tsl';

// Genera, en CPU, una nube de puntos que forma 3 flechas curvas dispuestas en círculo
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

// Genera el Planeta Tierra y el Hilo de Coseno atravesándolo
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

// Genera anillos concéntricos / ondas de choque para la diapositiva 5
function generateWaveRipplePoints(count) {
  const points = new Float32Array(count * 3);
  const center = new THREE.Vector3(-1.5, 0.5, 0.0);

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const theta = u * Math.PI * 2.0;
    
    const ringIndex = Math.floor(Math.random() * 5);
    const baseRadius = 0.8 + ringIndex * 0.9;
    const rVar = baseRadius + (Math.random() - 0.5) * 0.4;

    points[i * 3 + 0] = center.x + Math.cos(theta) * rVar;
    points[i * 3 + 1] = center.y + Math.sin(theta) * rVar;
    points[i * 3 + 2] = center.z + (Math.random() - 0.5) * 0.5;
  }

  return points;
}

// Calcula la posición y el progreso (0 = arriba, 1 = abajo) de una "gota" de
// lluvia de personas para la diapositiva 6: agrupa las partículas en columnas
// y en pequeñas "gotas" (discos, como una persona vista desde arriba) que caen
// en bucle continuo, cada gota desfasada en el tiempo respecto a las demás para
// que el efecto se vea como una lluvia continua en vez de todas cayendo juntas.
// seedX debe ser el mismo valor usado como shapeSeedBuffer.x (hash(idx + 53))
// para que la posición calculada aquí coincida con la del compute shader.
function computeRainDrop(seedX, idx, params) {
  const columnsCount = 6.0;
  const dropsPerColumn = 4.0;
  const columnSpacing = 2.3;
  const topY = 7.5;
  const bottomY = -6.5;
  const loopDuration = 4.0; // segundos que tarda una gota en caer de arriba a abajo
  const personRadius = 0.4;

  const columnId = floor(seedX.mul(columnsCount));
  const columnX = columnId.sub(float((columnsCount - 1) * 0.5)).mul(columnSpacing);

  const dropId = floor(hash(idx.add(uint(919))).mul(dropsPerColumn));
  const jitter = hash(idx.add(uint(577)));
  const phase = dropId.add(jitter).div(dropsPerColumn);

  const rawT = mod(params.elapsedTime.div(loopDuration).add(phase), 1.0);

  const angle = hash(idx.add(uint(733))).mul(Math.PI * 2.0);
  const rNorm = sqrt(hash(idx.add(uint(347))));
  const localX = cos(angle).mul(rNorm).mul(personRadius);
  const localZ = sin(angle).mul(rNorm).mul(personRadius);

  const y = mix(topY, bottomY, rawT);
  const target = vec3(columnX.add(localX), y, localZ);

  return { target, rawT };
}

// Genera, en CPU, una red tipo "vena": un tronco vertical (de arriba hacia
// abajo) con varias ramas que se desprenden en ángulo, y sub-ramas más
// pequeñas — como una vena real con tributarias. mainX ubica el tronco en X,
// leanBias inclina el tronco y sus ramas hacia un lado (para poder generar
// dos venas que se crucen ligeramente, como en una referencia anatómica).
function generateVeinNetworkPoints(count, mainX, leanBias) {
  const points = new Float32Array(count * 3);
  const topY = 7.5;
  const bottomY = -7.5;
  const segments = [];

  const addSegment = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.001;
    segments.push({ x0, y0, x1, y1, len });
  };

  const trunkSegs = 6;
  let prevX = mainX;
  let prevY = topY;

  for (let i = 1; i <= trunkSegs; i++) {
    const t = i / trunkSegs;
    const y = THREE.MathUtils.lerp(topY, bottomY, t);
    const wiggle = Math.sin(t * Math.PI * 2.4 + mainX) * 0.35;
    const x = mainX + wiggle + leanBias * t * 1.4;
    addSegment(prevX, prevY, x, y);

    // Rama principal en la mayoría de los nudos del tronco
    if (i > 1 && i < trunkSegs) {
      const side = (i % 2 === 0 ? 1 : -1);
      const branchLen = 2.0 + Math.random() * 1.6;
      const angle = (0.35 + Math.random() * 0.35) * Math.PI * side;
      const bx = x + Math.cos(angle) * branchLen;
      const by = y - Math.abs(Math.sin(angle)) * branchLen * 0.85;
      addSegment(x, y, bx, by);

      // Sub-rama pequeña, como una tributaria menor
      if (Math.random() < 0.7) {
        const subLen = branchLen * 0.5;
        const subAngle = angle + (Math.random() - 0.5) * 0.7;
        const sx = bx + Math.cos(subAngle) * subLen;
        const sy = by - Math.abs(Math.sin(subAngle)) * subLen * 0.75;
        addSegment(bx, by, sx, sy);
      }
    }

    prevX = x;
    prevY = y;
  }

  const totalLen = segments.reduce((sum, seg) => sum + seg.len, 0);
  let idx = 0;

  for (const seg of segments) {
    const segCount = Math.max(1, Math.round((count - trunkSegs) * seg.len / totalLen));
    for (let i = 0; i < segCount && idx < count; i++) {
      const t = Math.random();
      points[idx * 3 + 0] = THREE.MathUtils.lerp(seg.x0, seg.x1, t) + (Math.random() - 0.5) * 0.1;
      points[idx * 3 + 1] = THREE.MathUtils.lerp(seg.y0, seg.y1, t) + (Math.random() - 0.5) * 0.1;
      points[idx * 3 + 2] = (Math.random() - 0.5) * 0.5;
      idx++;
    }
  }

  // Completa cualquier resto por redondeo repartiéndolo entre los segmentos
  while (idx < count) {
    const seg = segments[Math.floor(Math.random() * segments.length)];
    const t = Math.random();
    points[idx * 3 + 0] = THREE.MathUtils.lerp(seg.x0, seg.x1, t);
    points[idx * 3 + 1] = THREE.MathUtils.lerp(seg.y0, seg.y1, t);
    points[idx * 3 + 2] = (Math.random() - 0.5) * 0.5;
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

  const waveRippleAttribute = new THREE.StorageInstancedBufferAttribute(generateWaveRipplePoints(count), 3);
  const waveRippleTargetBuffer = storage(waveRippleAttribute, 'vec3', count);

  // Dos redes de venas para la diapositiva 8 (camino / experiencia), inclinadas
  // en direcciones opuestas para que se crucen ligeramente, como dos venas reales.
  const veinAAttribute = new THREE.StorageInstancedBufferAttribute(generateVeinNetworkPoints(count, -1.6, 1.1), 3);
  const veinATargetBuffer = storage(veinAAttribute, 'vec3', count);

  const veinBAttribute = new THREE.StorageInstancedBufferAttribute(generateVeinNetworkPoints(count, 1.6, -1.1), 3);
  const veinBTargetBuffer = storage(veinBAttribute, 'vec3', count);

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

    // 1) ESCENA 1: Flechas, Vórtice, Planeta + Hilo Coseno
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

    // 2) ESCENA 2: Diapositiva 4 (Molinos), Diapositiva 5 (Ondas Concéntricas Lentas) y Diapositiva 6
    If(params.sceneId.equal(2.0), () => {
      const s = params.slideId;
      const isSlide4 = step(s, 4.5); 
      const isSlide5 = step(4.5, s).mul(step(s, 5.5)); // Diapositiva 5
      const isSlide6 = step(5.5, s);

      // Molinos de la diapositiva 4
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

      // Ondas concéntricas con ciclo de expansión más lento y suave (multiplicador reducido a 0.4 y ciclo de 5 segundos)
      const waveRaw = waveRippleTargetBuffer.element(instanceIndex);
      const waveCenter = vec3(-1.5, 0.5, 0.0);
      const pulseCycle = mod(params.elapsedTime.mul(0.4), 5.0); 
      const scaleFactor = float(1.0).add(pulseCycle.mul(0.35));
      const waveTarget = waveRaw.sub(waveCenter).mul(scaleFactor).add(waveCenter).add(params.formationOffset);

      // Diapositiva 6: lluvia continua de "personas" (pequeños círculos vistos
      // desde arriba) cayendo de arriba hacia abajo en columnas, en bucle. Se
      // mueve la posición directamente (en vez de con el resorte de fuerza)
      // para que el reinicio del bucle sea un salto limpio, oculto por el
      // desvanecimiento de opacidad que hace opacityNode justo antes de llegar
      // abajo y justo después de reaparecer arriba.
      // Al ENTRAR a esta diapositiva (viniendo de las ondas de la 5), en vez de
      // saltar de golpe a la lluvia, se mezcla gradualmente desde el objetivo
      // de las ondas hacia el objetivo de la lluvia usando transitionProgress
      // (0 al cambiar de diapositiva → 1 tras ~0.6s), para que las partículas
      // de la diapositiva 5 literalmente se conviertan en las de la 6.
      If(isSlide6.greaterThan(0.5), () => {
        const rain = computeRainDrop(seed.x, instanceIndex, params);
        const rainTarget = rain.target.add(params.formationOffset);
        const entryBlend = mix(waveTarget, rainTarget, params.transitionProgress);
        p.assign(entryBlend);
        v.assign(vec3(0.0));
      }).Else(() => {
        const target = mix(windmillTarget, waveTarget, isSlide5);
        force.addAssign(target.sub(p).mul(3.0));

        If(params.interactionActive.greaterThan(0.0), () => {
          const toMouse = params.attractor.sub(p);
          const d = max(toMouse.length(), 0.1);
          force.addAssign(toMouse.div(d).mul(1.5));
        });
      });
    });

    // 3) ESCENA 3: Acoplamiento Generacional
    If(params.sceneId.equal(3.0), () => {
      const isYouth = step(0.5, seed.z);
      const s = params.slideId;

      const f8 = step(7.5, s).mul(step(s, 8.5));
      const convergeFactor = step(8.5, s);
      const f9 = step(8.5, s).mul(step(s, 9.5));
      const f10 = step(9.5, s).mul(step(s, 10.5));

      const freq = mix(mix(2.0, 5.0, isYouth), 3.5, convergeFactor);
      const lag = f8.mul(0.6).mul(isYouth);
      const phaseGap = f9.mul(1.2).mul(isYouth);

      const waveY = sin(params.elapsedTime.sub(lag).mul(freq).add(seed.x.mul(10.0)).add(phaseGap)).mul(2.2);
      const waveX = seed.x.sub(0.5).mul(12.0);
      const waveTarget3 = vec3(waveX, waveY, seed.y.sub(0.5).mul(2.0)).add(params.formationOffset);

      // Diapositiva 8: en vez de la onda, las 2 líneas son redes de venas
      // verticales (de arriba hacia abajo) con varias ramas, una por generación.
      If(f8.greaterThan(0.5), () => {
        const veinARaw = veinATargetBuffer.element(instanceIndex);
        const veinBRaw = veinBTargetBuffer.element(instanceIndex);
        const veinTarget = mix(veinARaw, veinBRaw, isYouth).add(params.formationOffset);
        force.addAssign(veinTarget.sub(p).mul(3.5));
      }).Else(() => {
        // Diapositiva 9: 2 hélices de ADN verticales (de arriba hacia abajo),
        // una por lado, en vez de una sola onda cruzada.
        If(f9.greaterThan(0.5), () => {
          // Diapositiva 9: cada lado es ahora una doble hélice de ADN (2 hebras
          // entrelazadas + peldaños), en vez de una sola línea ondulada.
          const t9 = seed.x; // 0 = arriba, 1 = abajo
          const y9 = mix(7.5, -7.5, t9);
          const sideX = mix(-3.4, 3.4, isYouth); // izquierda (old) / derecha (youth)

          const turns9 = 2.2; // vueltas completas de la hélice en toda la altura
          const helixRadius = 0.85;
          const phase9 = t9.mul(Math.PI * 2.0 * turns9).add(params.elapsedTime.mul(0.6));

          // Reparte las partículas de cada lado entre: hebra A, hebra B, o
          // peldaño (par de bases) que une ambas hebras.
          const roleSeed9 = hash(instanceIndex.add(uint(947)));
          const isRung9 = step(roleSeed9, 0.2);
          const strandSeed9 = hash(instanceIndex.add(uint(613)));
          const isStrandB9 = step(0.5, strandSeed9);

          // Hebras: giran desfasadas 180° entre sí, dando el efecto de cruce
          // típico de la doble hélice.
          const strandPhase = mix(phase9, phase9.add(Math.PI), isStrandB9);
          const strandX = sideX.add(cos(strandPhase).mul(helixRadius));
          const strandZ = sin(strandPhase).mul(helixRadius * 0.9);
          const strandTarget = vec3(strandX, y9, strandZ.add(seed.y.sub(0.5).mul(0.15)));

          // Peldaños: repartidos en niveles regulares a lo largo de la altura
          // (en vez de continuos) para que se vean como escalones separados,
          // atravesando de una hebra a la otra en ese mismo punto de giro.
          const rungLevels = 16.0;
          const rungT = floor(t9.mul(rungLevels).add(0.5)).div(rungLevels);
          const rungY = mix(7.5, -7.5, rungT);
          const rungPhase = rungT.mul(Math.PI * 2.0 * turns9).add(params.elapsedTime.mul(0.6));
          const rungU = seed.y; // posición a lo largo del peldaño: 0 = hebra A, 1 = hebra B
          const rungX = sideX.add(mix(cos(rungPhase), cos(rungPhase.add(Math.PI)), rungU).mul(helixRadius));
          const rungZ = mix(sin(rungPhase), sin(rungPhase.add(Math.PI)), rungU).mul(helixRadius * 0.9);
          const rungTarget = vec3(rungX, rungY, rungZ);

          const vertTarget = mix(strandTarget, rungTarget, isRung9).add(params.formationOffset);
          force.addAssign(vertTarget.sub(p).mul(3.5));
        }).Else(() => {
          // Diapositiva 10: las 2 hélices ya no quedan separadas a cada lado;
          // se funden en una sola espiral central de 3 brazos entrelazados
          // (blanco, azul eléctrico, fucsia) en partes iguales, como un
          // remolino de colores.
          If(f10.greaterThan(0.5), () => {
            const t10 = seed.x; // 0 = centro, 1 = borde exterior
            const maxRadius10 = 4.2;
            const turns10 = 3.0;

            // Reparte cada partícula en 1 de 3 brazos iguales del remolino.
            const armId10 = floor(hash(instanceIndex.add(uint(571))).mul(3.0));
            const armAngleOffset10 = armId10.mul((Math.PI * 2.0) / 3.0);

            const angle10 = armAngleOffset10.add(t10.mul(Math.PI * 2.0 * turns10)).add(params.elapsedTime.mul(0.15));
            const radius10 = t10.mul(maxRadius10);

            // Grosor de banda: desplazamiento tangencial (perpendicular al
            // radio) para que cada brazo se vea como una franja, no una línea.
            const bandWidth10 = 0.4;
            const tangentOffset10 = seed.y.sub(0.5).mul(bandWidth10);
            const px10 = cos(angle10).mul(radius10).sub(sin(angle10).mul(tangentOffset10));
            const py10 = sin(angle10).mul(radius10).add(cos(angle10).mul(tangentOffset10));
            const pz10 = seed.z.sub(0.5).mul(0.3);

            const spiralTarget = vec3(px10, py10, pz10).add(params.formationOffset);
            force.addAssign(spiralTarget.sub(p).mul(3.2));
          }).Else(() => {
            force.addAssign(waveTarget3.sub(p).mul(3.5));
          });
        });
      });
    });

    // 4) ESCENA 4: El Núcleo Vivo
    If(params.sceneId.equal(4.0), () => {
      const isYouth = step(0.5, seed.z);
      const s = params.slideId;
      const f11 = step(10.5, s).mul(step(s, 11.5));
      const f12 = step(11.5, s).mul(step(s, 12.5));
      const f13 = step(12.5, s);

      const centerDir = params.formationOffset.sub(p).normalize();
      const basePulse = sin(params.elapsedTime.mul(2.0)).mul(0.2).add(2.8);
      const youthLead = f11.mul(isYouth).mul(0.9);
      const radius = basePulse.sub(youthLead).add(f13.mul(1.1));

      let target = params.formationOffset.add(centerDir.negate().mul(radius));
      target = vec3(target.x, target.y, target.z.mul(mix(1.0, 0.35, f13)));

      const stiffness = mix(3.0, 1.8, f13);

      If(f12.greaterThan(0.5), () => {
        // Diapositiva 12: en vez de la esfera lisa, pequeños "bloques" de
        // partículas orbitan alrededor del núcleo y van encajando en su
        // lugar sobre la superficie, como si se construyera en tiempo real.
        // Cada bloque tiene su propio ciclo (acercarse → encajar → soltarse
        // de nuevo) desfasado en el tiempo, para que siempre haya algo
        // ensamblándose, nunca una imagen fija y "ya terminada".
        const numBlocks12 = 28.0;
        const blockSeed12 = hash(instanceIndex.add(uint(383)));
        const blockId12 = floor(blockSeed12.mul(numBlocks12));

        // Dos valores pseudoaleatorios estables por bloque (iguales para
        // todas las partículas de ese bloque), derivados solo de blockId12.
        const randA12 = sin(blockId12.mul(12.9898).add(78.233)).mul(43758.5453);
        const bRand1 = randA12.sub(floor(randA12));
        const randB12 = sin(blockId12.mul(39.346).add(11.135)).mul(28001.8384);
        const bRand2 = randB12.sub(floor(randB12));

        // Punto de anclaje del bloque sobre la esfera (dirección unitaria,
        // repartida de forma uniforme sobre toda la superficie).
        const zAnchor = bRand2.mul(2.0).sub(1.0);
        const ringRadiusAnchor = sqrt(max(float(1.0).sub(zAnchor.mul(zAnchor)), 0.0));
        const thetaAnchor = bRand1.mul(Math.PI * 2.0);
        const dirAnchor = vec3(ringRadiusAnchor.mul(cos(thetaAnchor)), ringRadiusAnchor.mul(sin(thetaAnchor)), zAnchor);

        const coreRadius12 = 2.8;
        const orbitRadius12 = 5.2;

        // Ciclo de ensamblaje del bloque, desfasado con bRand1 para que no
        // todos se muevan a la vez.
        const cycleRaw12 = params.elapsedTime.div(6.0).add(bRand1.mul(3.0));
        const blockT12 = cycleRaw12.sub(floor(cycleRaw12));
        const dockAmount12 = pow(max(sin(blockT12.mul(Math.PI)), 0.0), 0.4);

        // Mientras espera su turno, el bloque orbita girando lentamente
        // alrededor del eje de su propio punto de anclaje.
        const extraSpin12 = params.elapsedTime.mul(0.5).add(bRand1.mul(10.0));
        const cosE12 = cos(extraSpin12);
        const sinE12 = sin(extraSpin12);
        const orbitDir12 = vec3(
          dirAnchor.x.mul(cosE12).sub(dirAnchor.y.mul(sinE12)),
          dirAnchor.x.mul(sinE12).add(dirAnchor.y.mul(cosE12)),
          dirAnchor.z
        );

        const orbitPos12 = orbitDir12.mul(orbitRadius12);
        const dockedPos12 = dirAnchor.mul(coreRadius12);
        const blockCenter12 = mix(orbitPos12, dockedPos12, dockAmount12);

        // Desparramo interno del bloque: suelto mientras orbita, se
        // compacta como una pieza sólida justo al encajar.
        const spread12 = mix(0.9, 0.22, dockAmount12);
        const clusterOffset12 = seed.sub(0.5).mul(spread12);

        const blockTarget12 = params.formationOffset.add(blockCenter12).add(clusterOffset12);
        force.addAssign(blockTarget12.sub(p).mul(3.0));
      }).Else(() => {
        force.addAssign(target.sub(p).mul(stiffness));
      });
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
    let scale = params.particleSize.mul(mix(0.6, 1.8, sizeSeed));

    // Diapositiva 8 (escena 3): grosor irregular a lo largo de cada línea,
    // con "bultos" fijos en el espacio (no en el tiempo) para que parezca
    // una vena en vez de un tubo perfectamente uniforme.
    const isScene3Scale = step(2.5, params.sceneId).mul(step(params.sceneId, 3.5));
    const sScale = params.slideId;
    const isSlide8Scale = isScene3Scale.mul(step(7.5, sScale)).mul(step(sScale, 8.5));
    const seedXVein = hash(instanceIndex.add(uint(53))); // igual que shapeSeedBuffer.x
    const bulge = pow(abs(sin(seedXVein.mul(9.0))), 3.0);
    const veinThickness = mix(0.75, 1.9, bulge);
    scale = mix(scale, scale.mul(veinThickness), isSlide8Scale);

    return scale;
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

    // --- Colores para la Diapositiva 5 (Ondas concéntricas lentas) ---
    const isSlide5Color = isScene2.mul(step(4.5, s)).mul(step(s, 5.5));
    
    const waveMixVal = hash(instanceIndex.add(uint(921)));
    const isWhiteCore = step(waveMixVal, 0.3);
    const isYellowCore = step(0.3, waveMixVal).sub(step(0.7, waveMixVal));
    const isOrangeOuter = step(0.7, waveMixVal);

    const colWhite = color('#ffffff');
    const colYellow = color('#ffe600');
    const colOrange = color('#ff5500');

    const waveColorMix = colWhite.mul(isWhiteCore)
      .add(colYellow.mul(isYellowCore))
      .add(colOrange.mul(isOrangeOuter));

    // Destello de pulso más lento y armónico acorde a la velocidad del movimiento
    const waveFlash = abs(sin(params.elapsedTime.mul(1.0))).mul(0.3).add(0.85);
    baseColor = mix(baseColor, waveColorMix.mul(waveFlash), isSlide5Color);

    const brightnessSeed = hash(instanceIndex.add(uint(311)));
    baseColor = baseColor.mul(mix(0.8, 1.4, brightnessSeed));

    // --- Colores para la Diapositiva 6 (Lluvia de personas) ---
    // Alterna verde y azul turquesa por columna (misma columna que computeRainDrop: 6 columnas).
    const isSlide6Color = isScene2.mul(step(5.5, s));
    const seedXRain = hash(instanceIndex.add(uint(53))); // igual que shapeSeedBuffer.x
    const rainColumnId = floor(seedXRain.mul(6.0));
    const isRainColumnOdd = mod(rainColumnId, 2.0);
    const colRainGreen = color('#3ddc5a');
    const colRainTurquoise = color('#22d3c0');
    const rainColorMix = mix(colRainGreen, colRainTurquoise, isRainColumnOdd);
    baseColor = mix(baseColor, rainColorMix, isSlide6Color);

    // --- Colores para la Diapositiva 7 (Acoplamiento generacional, escena 3) ---
    // Distingue las dos ondas entrelazadas (las dos generaciones): una azul, otra amarilla.
    const isScene3 = step(2.5, params.sceneId).mul(step(params.sceneId, 3.5));
    const isSlide7Color = isScene3.mul(step(6.5, s)).mul(step(s, 7.5));

    const seedZ = hash(instanceIndex.add(uint(89))); // igual que shapeSeedBuffer.z
    const isYouthColor = step(0.5, seedZ);

    const generationColorMix = mix(col1, col4, isYouthColor);

    baseColor = mix(baseColor, generationColorMix, isSlide7Color);

    // --- Diapositiva 8 (escena 3): las 2 líneas funcionan como "venas" ---
    // Una línea (camino) en oro, la otra (experiencia) en naranja terracota, con
    // un pulso de brillo que viaja a lo largo de cada línea como flujo sanguíneo.
    const isSlide8Color = isScene3.mul(step(7.5, s)).mul(step(s, 8.5));
    const colTerracotta = color('#d1652e');
    const veinColorMix = mix(colGold, colTerracotta, isYouthColor);
    const veinFlow = pow(abs(sin(seedXRain.mul(26.0).sub(params.elapsedTime.mul(3.0)))), 6.0);
    const veinColor = veinColorMix.mul(mix(0.7, 1.6, veinFlow));
    baseColor = mix(baseColor, veinColor, isSlide8Color);

    // --- Diapositiva 9 (escena 3): 2 hélices de ADN, una por lado ---
    // Izquierda (generación "old"): ADN blanco. Derecha (generación "youth"):
    // ADN mitad azul eléctrico, mitad fucsia, repartido en un degradado suave
    // a lo largo de toda la hélice (de arriba a abajo) en vez de un corte duro.
    const isSlide9Color = isScene3.mul(step(8.5, s)).mul(step(s, 9.5));
    const colElectricBlue = color('#0080ff');
    const colFuchsia = color('#ff2ec4');
    const t9Color = pow(seedXRain, 1.6); // igual a seed.x (t9) pero con sesgo hacia el azul
    const rightSideColor = mix(colElectricBlue, colFuchsia, t9Color);
    const line9ColorMix = mix(colWhite, rightSideColor, isYouthColor);
    baseColor = mix(baseColor, line9ColorMix, isSlide9Color);

    // --- Diapositiva 10 (escena 3): espiral central con los 3 colores ---
    // Blanco, azul eléctrico y fucsia repartidos en partes iguales entre los
    // 3 brazos entrelazados (mismo reparto que usa la posición, arriba).
    const isSlide10Color = isScene3.mul(step(9.5, s)).mul(step(s, 10.5));
    const armId10Color = floor(hash(instanceIndex.add(uint(571))).mul(3.0));
    const isArm0 = step(armId10Color, 0.5);
    const isArm1 = step(0.5, armId10Color).mul(step(armId10Color, 1.5));
    const isArm2 = step(1.5, armId10Color);
    const spiralColorMix = colWhite.mul(isArm0).add(colElectricBlue.mul(isArm1)).add(colFuchsia.mul(isArm2));
    baseColor = mix(baseColor, spiralColorMix, isSlide10Color);

    // --- Diapositiva 11 (escena 4): pulso de vida más fuerte ---
    // Usa la misma fase que ya respira el radio del núcleo (basePulse en el
    // compute shader), pero con una curva más marcada: un "latido" que
    // ilumina con fuerza justo cuando el núcleo está más expandido, y baja
    // a un brillo tenue en el valle, para que se sienta vivo y presente.
    const isScene4 = step(3.5, params.sceneId);
    const isSlide11Color = isScene4.mul(step(10.5, s)).mul(step(s, 11.5));
    const heartbeatRaw = sin(params.elapsedTime.mul(2.0)); // misma fase que basePulse
    const heartbeatPulse = pow(max(heartbeatRaw, 0.0), 2.0);
    const pulseBrightness = mix(0.55, 2.2, heartbeatPulse);
    baseColor = mix(baseColor, baseColor.mul(pulseBrightness), isSlide11Color);

    // --- Diapositiva 12 (escena 4): bloques que se ensamblan ---
    // Brillo más cálido/intenso justo cuando cada bloque encaja en su
    // sitio, y algo más apagado mientras todavía está orbitando (mismo
    // cálculo de bloque/ciclo que usa la posición, arriba).
    const isSlide12Color = isScene4.mul(step(11.5, s)).mul(step(s, 12.5));
    const blockSeed12Color = hash(instanceIndex.add(uint(383)));
    const blockId12Color = floor(blockSeed12Color.mul(28.0));
    const randA12c = sin(blockId12Color.mul(12.9898).add(78.233)).mul(43758.5453);
    const bRand1c = randA12c.sub(floor(randA12c));
    const cycleRaw12c = params.elapsedTime.div(6.0).add(bRand1c.mul(3.0));
    const blockT12c = cycleRaw12c.sub(floor(cycleRaw12c));
    const dockAmount12c = pow(max(sin(blockT12c.mul(Math.PI)), 0.0), 0.4);
    const blockBrightness12 = mix(0.6, 1.55, dockAmount12c);
    baseColor = mix(baseColor, baseColor.mul(blockBrightness12), isSlide12Color);

    return vec4(baseColor, 0.95);
  })();

  material.opacityNode = Fn(() => {
    const falloff = max(uv().xy.sub(0.5).length().mul(-2.0).add(1.0), 0.0);
    let alpha = pow(falloff, 0.55);

    // Diapositiva 6: desvanece cada "gota" justo antes de llegar abajo y
    // justo después de reaparecer arriba, para que el bucle no se note.
    const isScene2 = step(1.5, params.sceneId).mul(step(params.sceneId, 2.5));
    const isSlide6Now = isScene2.mul(step(5.5, params.slideId));

    const seedX = hash(instanceIndex.add(uint(53))); // igual que shapeSeedBuffer.x
    const rain = computeRainDrop(seedX, instanceIndex, params);
    const fadeIn = clamp(rain.rawT.mul(8.0), 0.0, 1.0);
    const fadeOut = clamp(float(1.0).sub(rain.rawT).mul(8.0), 0.0, 1.0);
    const rainAlpha = fadeIn.mul(fadeOut);

    alpha = mix(alpha, alpha.mul(rainAlpha), isSlide6Now);

    return alpha;
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