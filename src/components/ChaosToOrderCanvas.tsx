import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ChaosToOrderCanvasProps {
  isOrdered: boolean;
  onToggleState?: () => void;
}

interface StrokeData {
  // Chaos endpoints
  chaosStart: THREE.Vector3;
  chaosEnd: THREE.Vector3;
  // Order endpoints
  orderStart: THREE.Vector3;
  orderEnd: THREE.Vector3;
  // Current positions
  currentStart: THREE.Vector3;
  currentEnd: THREE.Vector3;
}

export const ChaosToOrderCanvas: React.FC<ChaosToOrderCanvasProps> = ({
  isOrdered,
  onToggleState,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch (e) {
      console.warn('WebGL initialization failed, falling back to SVG', e);
      setWebGlSupported(false);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 14;

    const strokeCount = 48;
    const strokes: StrokeData[] = [];

    // Precalculate endpoints for Chaos and Order
    // Order forms a clean vertical timeline with horizontal schedule rows
    const cols = 4;
    const rows = 12;

    for (let i = 0; i < strokeCount; i++) {
      // Chaos: scattered lines
      const cx = (Math.random() - 0.5) * 12;
      const cy = (Math.random() - 0.5) * 8;
      const angle = Math.random() * Math.PI * 2;
      const len = 0.8 + Math.random() * 1.6;
      const cs = new THREE.Vector3(cx - (Math.cos(angle) * len) / 2, cy - (Math.sin(angle) * len) / 2, (Math.random() - 0.5) * 2);
      const ce = new THREE.Vector3(cx + (Math.cos(angle) * len) / 2, cy + (Math.sin(angle) * len) / 2, (Math.random() - 0.5) * 2);

      // Order: organized timeline / schedule grid
      let os: THREE.Vector3;
      let oe: THREE.Vector3;

      if (i < rows) {
        // Horizontal hour marker lines
        const y = 3.6 - (i / (rows - 1)) * 7.2;
        os = new THREE.Vector3(-4.5, y, 0);
        oe = new THREE.Vector3(4.5, y, 0);
      } else if (i < rows + cols) {
        // Vertical column dividers
        const colIdx = i - rows;
        const x = -4.5 + (colIdx / (cols - 1)) * 9;
        os = new THREE.Vector3(x, 3.8, 0);
        oe = new THREE.Vector3(x, -3.8, 0);
      } else {
        // Scheduled task blocks inside the matrix
        const blockIdx = i - (rows + cols);
        const r = blockIdx % (rows - 1);
        const c = Math.floor(blockIdx / (rows - 1)) % (cols - 1);
        const x1 = -4.5 + (c / (cols - 1)) * 9 + 0.3;
        const x2 = -4.5 + ((c + 1) / (cols - 1)) * 9 - 0.3;
        const y = 3.6 - ((r + 0.5) / (rows - 1)) * 7.2;
        os = new THREE.Vector3(x1, y, 0);
        oe = new THREE.Vector3(x2, y, 0);
      }

      strokes.push({
        chaosStart: cs,
        chaosEnd: ce,
        orderStart: os,
        orderEnd: oe,
        currentStart: cs.clone(),
        currentEnd: ce.clone(),
      });
    }

    // Geometry buffer for all lines
    const positions = new Float32Array(strokeCount * 2 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Dark ink material with soft hairline transparency
    const material = new THREE.LineBasicMaterial({
      color: 0x16150f,
      transparent: true,
      opacity: 0.35,
      linewidth: 1,
    });

    const lines = new THREE.LineSegments(geometry, material);
    scene.add(lines);

    // Resize handler
    const updateSize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    updateSize();

    let animationFrameId: number;
    let currentT = isOrdered ? 1 : 0;
    let targetT = isOrdered ? 1 : 0;
    let isVisible = true;

    // Mouse parallax
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.4;
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.4;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Visibility observer to pause rendering when out of viewport
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      targetT = isOrdered ? 1 : 0;
      // Smooth interpolation
      const speed = reducedMotion ? 1 : 0.05;
      currentT += (targetT - currentT) * speed;

      const posAttr = geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      // Parallax rotation
      lines.rotation.y += (mouseX - lines.rotation.y) * 0.05;
      lines.rotation.x += (-mouseY - lines.rotation.x) * 0.05;

      for (let i = 0; i < strokeCount; i++) {
        const s = strokes[i];
        s.currentStart.lerpVectors(s.chaosStart, s.orderStart, currentT);
        s.currentEnd.lerpVectors(s.chaosEnd, s.orderEnd, currentT);

        const baseIdx = i * 6;
        arr[baseIdx] = s.currentStart.x;
        arr[baseIdx + 1] = s.currentStart.y;
        arr[baseIdx + 2] = s.currentStart.z;

        arr[baseIdx + 3] = s.currentEnd.x;
        arr[baseIdx + 4] = s.currentEnd.y;
        arr[baseIdx + 5] = s.currentEnd.z;
      }

      posAttr.needsUpdate = true;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    window.addEventListener('resize', updateSize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('mousemove', handleMouseMove);
      observer.disconnect();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [isOrdered, reducedMotion]);

  if (!webGlSupported) {
    // Clean static SVG fallback
    return (
      <div
        ref={containerRef}
        className="w-full h-full min-h-[220px] flex items-center justify-center relative overflow-hidden"
        aria-label="Visualization of chaos transitioning to structured timeline"
      >
        <svg viewBox="0 0 400 240" className="w-full h-full max-w-md stroke-[#16150F]/40" fill="none">
          {isOrdered ? (
            // Structured grid
            <g strokeWidth="1">
              <line x1="40" y1="40" x2="360" y2="40" />
              <line x1="40" y1="80" x2="360" y2="80" />
              <line x1="40" y1="120" x2="360" y2="120" />
              <line x1="40" y1="160" x2="360" y2="160" />
              <line x1="40" y1="200" x2="360" y2="200" />
              <line x1="40" y1="40" x2="40" y2="200" />
              <line x1="120" y1="40" x2="120" y2="200" />
              <line x1="200" y1="40" x2="200" y2="200" />
              <line x1="360" y1="40" x2="360" y2="200" />
              <rect x="130" y="50" width="60" height="20" fill="#16150F" opacity="0.1" />
              <rect x="210" y="90" width="140" height="20" fill="#16150F" opacity="0.1" />
            </g>
          ) : (
            // Scattered lines
            <g strokeWidth="1">
              <line x1="50" y1="60" x2="110" y2="80" />
              <line x1="140" y1="40" x2="190" y2="90" />
              <line x1="230" y1="70" x2="320" y2="50" />
              <line x1="60" y1="140" x2="120" y2="120" />
              <line x1="170" y1="150" x2="220" y2="130" />
              <line x1="280" y1="170" x2="340" y2="130" />
            </g>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[220px] relative select-none flex items-center justify-center"
      aria-label="Interactive visual representation of chaos organizing into an actionable plan"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute bottom-2 right-3 flex items-center gap-2 text-[11px] text-[#5E5A50] tracking-wide">
        <button
          type="button"
          onClick={onToggleState}
          className="hover:text-[#16150F] transition-colors cursor-pointer py-1 px-1.5 focus:outline-none focus:ring-1 focus:ring-[#16150F]"
        >
          {isOrdered ? 'State: Structured plan' : 'State: Raw thoughts'}
        </button>
      </div>
    </div>
  );
};
