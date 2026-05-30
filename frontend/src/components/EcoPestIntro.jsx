import { useEffect, useState } from "react";

export default function EcoPestIntro() {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2200); // start fade out

    const hideTimer = setTimeout(() => {
      setShow(false);
    }, 2600); // fully remove from DOM

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-hidden bg-black flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#163f34_0%,#081310_70%)]"></div>

      {/* Grid Overlay */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      ></div>

      {/* Floating Particles */}
      <div className="particles"></div>

      {/* Main Content */}
      <div className="relative flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-[380px] h-[380px] border border-emerald-400/20 rounded-full animate-ringRotate"></div>
          <div className="absolute w-[300px] h-[300px] border border-white/10 rounded-full animate-ringRotateReverse"></div>

          <div className="absolute w-60 h-60 bg-emerald-400/20 blur-3xl rounded-full animate-glowPulse"></div>

          <img
            src="/Eco_logo.png"
            alt="Eco Pest"
            className="relative w-56 h-56 object-contain animate-logoReveal"
          />

          <div className="absolute w-72 h-72 overflow-hidden rounded-full">
            <div className="shine"></div>
          </div>
        </div>

        <div className="mt-14 text-center">
          <h1 className="text-white text-6xl md:text-7xl font-black uppercase tracking-[14px] animate-titleReveal">
            Eco Pest
          </h1>

          <div className="flex items-center justify-center gap-4 mt-6 animate-subReveal">
            <div className="w-16 h-[1px] bg-emerald-300/40"></div>
            <p className="text-emerald-100/70 uppercase tracking-[8px] text-sm">
              Sustainable Solutions
            </p>
            <div className="w-16 h-[1px] bg-emerald-300/40"></div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes logoReveal {
          0% {
            opacity: 0;
            transform: scale(0.5) rotate(-20deg);
            filter: blur(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
            filter: blur(0);
          }
        }

        @keyframes titleReveal {
          0% {
            opacity: 0;
            transform: translateY(40px);
            letter-spacing: 30px;
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            letter-spacing: 14px;
          }
        }

        @keyframes subReveal {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes glowPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }

        @keyframes ringRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes ringRotateReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        .animate-logoReveal {
          animation: logoReveal 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .animate-titleReveal {
          animation: titleReveal 0.9s ease forwards;
          animation-delay: 0.45s;
          opacity: 0;
        }

        .animate-subReveal {
          animation: subReveal 0.9s ease forwards;
          animation-delay: 0.8s;
          opacity: 0;
        }

        .animate-glowPulse {
          animation: glowPulse 2.5s ease-in-out infinite;
        }

        .animate-ringRotate {
          animation: ringRotate 8s linear infinite;
        }

        .animate-ringRotateReverse {
          animation: ringRotateReverse 6s linear infinite;
        }

        .particles::before,
        .particles::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px);
          background-size: 120px 120px;
          animation: particlesMove 15s linear infinite;
          opacity: 0.2;
        }

        .particles::after {
          background-size: 180px 180px;
          animation-duration: 22s;
        }

        @keyframes particlesMove {
          from { transform: translateY(0); }
          to { transform: translateY(-200px); }
        }

        .shine {
          position: absolute;
          top: -100%;
          left: -100%;
          width: 50%;
          height: 300%;
          background: linear-gradient(
            120deg,
            transparent,
            rgba(255,255,255,0.35),
            transparent
          );
          transform: rotate(25deg);
          animation: shineSweep 2s ease-in-out infinite;
        }

        @keyframes shineSweep {
          0% { left: -120%; }
          100% { left: 180%; }
        }
      `}</style>
    </div>
  );
}