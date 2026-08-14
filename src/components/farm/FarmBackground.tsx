import bgAsset from "@/assets/fazenda-background.png.asset.json";

/**
 * Animated rustic farm backdrop: slow ken-burns image, drifting mist layers,
 * a warm sun glow and floating pollen particles. Purely decorative.
 */
export function FarmBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 animate-farm-pan bg-cover bg-center"
        style={{ backgroundImage: `url(${bgAsset.url})` }}
      />
      {/* readability veil */}
      <div className="absolute inset-0 bg-background/72 backdrop-blur-[2px]" />
      {/* warm sun glow */}
      <div className="absolute -left-32 top-0 h-[38rem] w-[38rem] animate-farm-glow rounded-full bg-gold/25 blur-3xl" />
      {/* drifting mist */}
      <div className="absolute inset-x-0 bottom-0 h-64 animate-farm-mist bg-gradient-to-t from-background via-background/60 to-transparent" />
      {/* floating particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-gold/40 animate-farm-float"
          style={{
            left: `${p.left}%`,
            bottom: "-2rem",
            height: `${p.size}px`,
            width: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

const PARTICLES = [
  { left: 8, size: 6, delay: 0, duration: 22 },
  { left: 18, size: 4, delay: 4, duration: 28 },
  { left: 31, size: 7, delay: 9, duration: 25 },
  { left: 44, size: 3, delay: 2, duration: 30 },
  { left: 57, size: 5, delay: 12, duration: 24 },
  { left: 68, size: 4, delay: 6, duration: 27 },
  { left: 79, size: 6, delay: 15, duration: 21 },
  { left: 91, size: 3, delay: 10, duration: 29 },
];
