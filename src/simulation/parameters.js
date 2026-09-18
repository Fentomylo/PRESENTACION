import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.35),
    maxSpeed: uniform(9.0),
    boundsSize: uniform(15.0),
    particleSize: uniform(0.07),

    windEnabled: uniform(0.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    radialEnabled: uniform(0.0),
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    radialStrength: uniform(2.2),
    softening: uniform(0.35),

    vortexEnabled: uniform(0.0),
    vortexStrength: uniform(1.4),

    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.2),

    // Uniformes para la narrativa interactiva por diapositivas
    sceneId: uniform(1.0),
    slideId: uniform(1.0), // 1..13, define el micro-estado dentro de cada escena
    transitionProgress: uniform(0.0),
    elapsedTime: uniform(0.0),
    interactionActive: uniform(0.0),

    // Desplaza el conjunto entero de partículas hacia el lado libre de texto
    // (no deforma su forma, solo la traslada). Se actualiza en JS según el
    // "align" de la diapositiva actual.
    formationOffset: uniform(new THREE.Vector3(0.0, 0.0, 0.0))
  };
}