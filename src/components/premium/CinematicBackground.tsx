import AmbientParticles from '../3d/AmbientParticles';

interface CinematicBackgroundProps {
  showParticles?: boolean;
}

export default function CinematicBackground({ showParticles = true }: CinematicBackgroundProps) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(0,224,255,0.14),transparent_38%),radial-gradient(circle_at_76%_14%,rgba(125,217,255,0.09),transparent_34%),radial-gradient(circle_at_52%_78%,rgba(0,153,204,0.08),transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,#02131F_0%,#032B3A_46%,#041A22_100%)] opacity-60" />
      <div className="absolute -top-44 left-1/3 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute bottom-[-7rem] right-[-5rem] h-[22rem] w-[22rem] rounded-full bg-blue-400/10 blur-3xl" />
      <div className="absolute inset-0 cyber-grid-overlay opacity-35" />
      {showParticles && <AmbientParticles count={120} />}
    </div>
  );
}
