import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createLabPanel } from './ui/labPanel.js';

// Assets institucionais (mantenha-os junto dos originais em RECURSOS/)
import upbForumLogo from './RECURSOS/upb_forum_logo_white.png';
import upb90Icon from './RECURSOS/upb_90_anos_icon_white.png';
import foto1 from './RECURSOS/FOTO 1.jpg';
import foto2 from './RECURSOS/FOTO 2.jpeg';
import foto3 from './RECURSOS/FOTO 3.jpg';
import foto4 from './RECURSOS/FOTO 4.jpg';
import foto5 from './RECURSOS/FOTO 5.jpeg';
import foto6 from './RECURSOS/FOTO 6.jpg';

const PARTICLE_COUNT = 3000;

// Fotos de fundo por diapositiva, seguindo exatamente o roteiro (guion) original.
// Só as diapositivas listadas aqui mostram foto de fundo; as demais ficam só com partículas.
const slidePhotos = {
  2: foto1,
  4: foto2,
  5: foto3,
  8: foto4,
  12: foto5,
  13: foto6
};

// Cada título traz marcada com <span class="hl"> a ideia-chave dessa frase.
// "align" define de que lado o bloco de texto aparece: só as diapositivas 1 e 13 ficam
// centradas, as demais vão alternando de lado (esquerda/direita).
const slidesContent = [
  { slide: 1, scene: 1, align: 'center', kicker: "Future Leaders Forum · Fórum UPB", title: '<span class="hl">RELEVO GERACIONAL:</span> A VANTAGEM QUE NINGUÉM ESTÁ APROVEITANDO', footer: "@centrodeeventosupb" },
  { slide: 2, scene: 1, align: 'left', kicker: "Espaço", title: 'Um grande auditório apenas para formaturas?', footer: "" },
  { slide: 3, scene: 1, align: 'right', kicker: "Encontro", title: 'Os eventos não chegaram à Universidade. <span class="hl">A Universidade decidiu se encontrar com o mundo.</span>', footer: "" },
  { slide: 4, scene: 2, align: 'left', kicker: "Três forças", title: 'Academia + Indústria + Cidade', footer: "" },
  { slide: 5, scene: 2, align: 'right', kicker: "Impacto", title: 'Os eventos nunca foram o objetivo. <span class="hl">O impacto, sim.</span>', footer: "" },
  { slide: 6, scene: 2, align: 'center', kicker: "Comunidade", title: 'Um evento traz pessoas. Uma <span class="hl">comunidade</span> traz <span class="hl">transformação.</span>', footer: "" },
  { slide: 7, scene: 3, align: 'right', kicker: "Confiança", title: 'O talento cresce na velocidade da <span class="hl">confiança.</span>', footer: "" },
  { slide: 8, scene: 3, align: 'left', kicker: "Rotas", title: 'A <span class="hl">experiência</span> constrói o <span class="hl">caminho.</span> As novas gerações descobrem <span class="hl">novas rotas.</span>', footer: "" },
  { slide: 9, scene: 3, align: 'center', kicker: "Revezamento", title: 'Uma visão. <span class="hl">Duas gerações.</span>', footer: "" },
  { slide: 10, scene: 3, align: 'left', kicker: "Composição", title: 'O <span class="hl">crescimento</span> não acontece quando uma geração substitui a outra. Acontece quando <span class="hl">trabalham juntas.</span>', footer: "" },
  { slide: 11, scene: 4, align: 'right', kicker: "Presente", title: 'Os jovens não são o futuro. São o <span class="hl">presente</span> que muitas organizações ainda não veem.', footer: "" },
  { slide: 12, scene: 4, align: 'left', kicker: "Futuro construído", title: 'O <span class="hl">futuro</span> não se herda. Ele se <span class="hl">constrói.</span>', footer: "" },
  { slide: 13, scene: 4, align: 'center', kicker: "Continuidade", title: '', footer: "@centrodeeventosupb" }
];

async function main() {
  const mount = document.querySelector('#app');

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este projeto requer WebGPU.');
  }

  const scene = new THREE.Scene();
  scene.background = null; // transparente: el fondo lo maneja el CSS (color solido o foto según la diapositiva)

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 12);

  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();

  const params = createParameters();
  const simulation = createSimulation({ renderer, scene, params, count: PARTICLE_COUNT });

  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  addEventListener('pointermove', (event) => {
    pointerNdc.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(interactionPlane, hit)) {
      params.attractor.value.copy(hit);
      params.interactionActive.value = 1.0;
    }
  });

  addEventListener('pointerleave', () => {
    params.interactionActive.value = 0.0;
  });

  let paused = false;
  let mode = 'PERFORMANCE';
  let panel;
  let currentSlideIndex = 0;

  // --- FOTO DE FUNDO (dinâmica: cada diapositiva usa a foto do roteiro, atrás das partículas) ---
  const bgPhoto = document.createElement('div');
  bgPhoto.className = 'ref-bg-photo';
  document.body.append(bgPhoto);

  // --- CABEÇALHO INSTITUCIONAL ---
  const headerBar = document.createElement('div');
  headerBar.className = 'ref-header';
  headerBar.innerHTML = `
    <img src="${upbForumLogo}" alt="UPB Fórum · Centro de Eventos" style="height: 40px; width: auto; display: block; flex: none;" />
    <img src="${upb90Icon}" alt="90 anos UPB" style="height: 64px; width: auto; display: block; flex: none;" />
  `;
  document.body.append(headerBar);

  // --- CONTEÚDO PRINCIPAL DO TEXTO (kicker + título + rodapé, ancorado no topo) ---
  const slideContainer = document.createElement('div');
  slideContainer.className = 'ref-slide-text';
  slideContainer.innerHTML = `
    <div id="slide-kicker"></div>
    <h1 id="slide-title"></h1>
    <span id="slide-footer"></span>
  `;
  document.body.append(slideContainer);

  const kickerEl = document.getElementById('slide-kicker');
  const titleEl = document.getElementById('slide-title');
  const footerEl = document.getElementById('slide-footer');

  // --- BARRA INFERIOR DE NAVEGACIÓN ---
  const bottomNav = document.createElement('div');
  bottomNav.className = 'ref-bottom-nav';
  bottomNav.innerHTML = `
    <button id="prev-btn" style="background:none; border:1px solid rgba(255,255,255,0.2); color:white; padding:4px 10px; border-radius:4px; cursor:pointer;">&lt;</button>
    <span id="slide-counter" style="font-family: monospace; font-size: 13px; font-weight: bold; letter-spacing: 1px;">01/13</span>
    <button id="next-btn" style="background:none; border:1px solid rgba(255,255,255,0.2); color:white; padding:4px 10px; border-radius:4px; cursor:pointer;">&gt;</button>
    <button id="fullscreen-btn" style="background:none; border:1px solid rgba(255,255,255,0.2); color:white; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left: 8px;">⛶</button>
  `;
  document.body.append(bottomNav);

  document.getElementById('prev-btn').addEventListener('click', () => prevSlide());
  document.getElementById('next-btn').addEventListener('click', () => nextSlide());
  document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  });

  const setScene = (sceneNum) => {
    params.sceneId.value = sceneNum;
    params.transitionProgress.value = 0.0;
    const lerpIn = setInterval(() => {
      params.transitionProgress.value += 0.05;
      if (params.transitionProgress.value >= 1.0) {
        params.transitionProgress.value = 1.0;
        clearInterval(lerpIn);
      }
    }, 30);
  };

  // Desplaza todo el conjunto de partículas hacia el lado libre de texto,
  // según de qué lado está el bloque de texto en esta diapositiva. No cambia
  // la forma que arma cada escena, solo la mueve como un bloque.
  // El movimiento es suave: cada frame se acerca un poco más al lado objetivo
  // en vez de saltar de golpe.
  const FORMATION_OFFSET_X = 3.6;
  const FORMATION_SMOOTHING_SPEED = 1.6; // más alto = llega más rápido al lado objetivo
  const formationOffsetTarget = new THREE.Vector3();

  const updateFormationOffset = () => {
    const current = slidesContent[currentSlideIndex];
    let offsetX = 0;
    if (current.align === 'left') offsetX = FORMATION_OFFSET_X; // texto a la izquierda -> partículas a la derecha
    else if (current.align === 'right') offsetX = -FORMATION_OFFSET_X; // texto a la derecha -> partículas a la izquierda
    formationOffsetTarget.set(offsetX, 0, 0);
  };

  // Anima la entrada del texto solo durante la transición entre diapositivas;
  // al terminar la animación el texto queda completamente quieto.
  const restartTextAnimation = () => {
    for (const el of [kickerEl, titleEl, footerEl]) {
      el.classList.remove('text-animate-in');
      void el.offsetWidth; // fuerza el reflow para poder repetir la animación
      el.classList.add('text-animate-in');
    }
  };

  const updateSlideView = () => {
    const current = slidesContent[currentSlideIndex];
    params.slideId.value = current.slide;
    slideContainer.classList.remove('align-left', 'align-right', 'align-center');
    slideContainer.classList.add(`align-${current.align || 'left'}`);
    kickerEl.textContent = current.kicker || '';
    titleEl.innerHTML = current.title;
    footerEl.textContent = current.footer || '';
    restartTextAnimation();

    const paddedNum = String(currentSlideIndex + 1).padStart(2, '0');
    document.getElementById('slide-counter').textContent = `${paddedNum}/${String(slidesContent.length).padStart(2, '0')}`;

    const photoForSlide = slidePhotos[current.slide];
    if (photoForSlide) {
      bgPhoto.style.backgroundImage = `linear-gradient(180deg, rgba(5,6,7,0.1) 0%, rgba(5,6,7,0.45) 100%), url(${photoForSlide})`;
      bgPhoto.classList.add('is-visible');
    } else {
      bgPhoto.classList.remove('is-visible');
    }

    setScene(current.scene);
    updateFormationOffset();
  };

  const nextSlide = () => {
    if (currentSlideIndex < slidesContent.length - 1) {
      currentSlideIndex++;
      updateSlideView();
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      currentSlideIndex--;
      updateSlideView();
    }
  };

  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';
    panel.setVisible(lab);
  };

  panel = createLabPanel({
    params,
    onReset: () => simulation.reset(),
    onPreset: () => {},
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => paused = !paused
  });

  setMode('PERFORMANCE');
  updateSlideView();

  addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'KeyP') setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
    if (event.code === 'KeyR') simulation.reset();

    if (event.code === 'ArrowRight' || event.code === 'Space') {
      event.preventDefault();
      nextSlide();
    }
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      prevSlide();
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();
  const clock = new THREE.Clock();

  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    params.elapsedTime.value += delta;

    // Acerca suavemente el desplazamiento actual de las partículas hacia el
    // lado objetivo (evita el salto brusco al cambiar de diapositiva).
    const smoothT = 1 - Math.exp(-FORMATION_SMOOTHING_SPEED * delta);
    params.formationOffset.value.lerp(formationOffsetTarget, smoothT);

    if (!paused) simulation.stepSimulation();
    renderer.render(scene, camera);
  });
}

main().catch((error) => {
  console.error(error);
});