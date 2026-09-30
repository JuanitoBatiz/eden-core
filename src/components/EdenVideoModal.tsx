"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Smartphone } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface EdenVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectToHomeOnClose?: boolean;
}

export default function EdenVideoModal({ isOpen, onClose, redirectToHomeOnClose = false }: EdenVideoModalProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(true);
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [showSkip, setShowSkip] = useState<boolean>(false);
  const [fadingOut, setFadingOut] = useState<boolean>(false);
  const [showRotateSignal, setShowRotateSignal] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen) {
      setIsVideoPlaying(false);
      setShowSkip(false);
      setFadingOut(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      return;
    }

    const checkOrientation = () => {
      const mobileCheck = window.innerWidth < 768;
      const portraitCheck = window.innerHeight > window.innerWidth;
      setIsMobile(mobileCheck);
      setIsPortraitMobile(mobileCheck && portraitCheck);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, [isOpen]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isVideoPlaying) {
      timeoutId = setTimeout(() => {
        setShowSkip(true);
      }, 5000);
    }
    return () => clearTimeout(timeoutId);
  }, [isVideoPlaying]);

  useEffect(() => {
    if (isOpen && window.innerWidth < 768 && window.innerHeight > window.innerWidth) {
      setShowRotateSignal(true);
      const timer = setTimeout(() => setShowRotateSignal(false), 3500);
      return () => clearTimeout(timer);
    } else {
      setShowRotateSignal(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      if (videoRef.current.readyState >= 1) {
        setIsVideoReady(true);
      }
    }
  }, [isOpen]);

  const handleLoadedData = () => {
    setIsVideoReady(true);
  };

  const handlePlay = () => {
    if (!isVideoReady) return;
    setIsVideoPlaying(true);
    
    if (videoRef.current) {
      videoRef.current.play().catch((e) => console.error("Error playing video:", e));
    }
  };

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setFadingOut(true);
    setTimeout(() => {
      onClose();
      if (redirectToHomeOnClose && pathname !== "/") {
        router.push("/");
      }
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .evm-container {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 99999;
          background-color: #000;
          transition: opacity 0.4s ease-in-out;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .evm-container.fading-out {
          opacity: 0;
          pointer-events: none;
        }
        .evm-video {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100%; height: 100%;
          object-fit: contain;
          background-color: #000;
          z-index: 10;
          transition: opacity 0.7s;
        }
        .evm-video.hidden { opacity: 0; }
        .evm-video.visible { opacity: 1; }
        
        .evm-overlay-loader {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: opacity 0.5s;
          background: linear-gradient(270deg, #1B3B2B, #2C533D, #D4A35F, #1B3B2B);
          background-size: 300% 300%;
          animation: evmGradientShift 8s ease infinite;
        }
        .evm-overlay-loader.hidden {
          opacity: 0;
          pointer-events: none;
        }
        .evm-svg-loader {
          width: 96px; height: 96px;
          margin-bottom: 24px;
          filter: drop-shadow(0 0 8px rgba(212,163,95,0.6));
          stroke-dasharray: 350;
          animation: evmDrawBreathe 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .evm-loader-text {
          color: #fff;
          font-size: 1.125rem;
          font-weight: 600;
          animation: evmFadePulse 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .evm-ui-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 30;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px;
          transition: opacity 0.5s;
          background-color: rgba(0,0,0,0.6);
        }
        .evm-ui-overlay.hidden {
          opacity: 0;
          pointer-events: none;
        }

        .evm-rotate-phone-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 50;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: rgba(0,0,0,0.85);
          text-align: center;
          transition: opacity 0.5s;
        }
        .evm-phone-icon {
          width: 64px; height: 64px;
          color: #fff;
          margin-bottom: 24px;
          animation: evmRotatePhoneAnim 2.5s ease-in-out infinite;
        }
        .evm-rotate-text {
          color: #fff;
          font-size: 1.5rem;
          font-weight: 600;
          text-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }

        .evm-play-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .evm-play-btn {
          width: 80px; height: 80px;
          background-color: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          cursor: pointer;
        }
        .evm-play-btn:hover {
          background-color: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.6);
          transform: scale(1.08);
        }
        .evm-play-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .evm-play-icon {
          width: 34px; height: 34px;
          color: #fff;
          margin-left: 4px;
          opacity: 0.95;
        }

        .evm-skip-btn {
          position: absolute;
          bottom: 24px; right: 24px;
          z-index: 40;
          padding: 8px 24px;
          background-color: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          color: #fff;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.3s;
          border: none;
          cursor: pointer;
        }
        .evm-skip-btn:hover {
          background-color: rgba(0,0,0,0.6);
        }

        @media (min-width: 768px) {
          .evm-svg-loader { width: 128px; height: 128px; }
          .evm-loader-text { font-size: 1.25rem; }
          .evm-rotate-text { font-size: 1.875rem; }
          .evm-play-btn { width: 96px; height: 96px; }
          .evm-play-icon { width: 42px; height: 42px; margin-left: 6px; }
        }

        @keyframes evmRotatePhoneAnim {
          0% { transform: rotate(0deg); }
          30% { transform: rotate(90deg); }
          70% { transform: rotate(90deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes evmGradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes evmDrawBreathe {
          0% { stroke-dashoffset: 350; opacity: 0; }
          15% { opacity: 1; }
          45% { stroke-dashoffset: 0; opacity: 1; }
          75% { stroke-dashoffset: 0; opacity: 1; }
          90% { opacity: 0; }
          100% { stroke-dashoffset: -350; opacity: 0; }
        }
        @keyframes evmFadePulse {
          0%, 100% { opacity: 0.3; }
          45%, 75% { opacity: 0.85; }
        }
        .evm-content-wrapper {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100%; height: 100%;
        }
        .evm-force-landscape {
          transform: rotate(90deg);
          transform-origin: center center;
          width: 100dvh;
          height: 100dvw;
          top: 50%;
          left: 50%;
          margin-top: -50dvw;
          margin-left: -50dvh;
        }
      `}</style>

      <div className={`evm-container ${fadingOut ? "fading-out" : ""}`}>
        <div className={`evm-content-wrapper ${isPortraitMobile ? "evm-force-landscape" : ""}`}>
          <video
            ref={videoRef}
            className={`evm-video ${isVideoPlaying ? "visible" : "hidden"}`}
            controls={false}
            playsInline
            preload="auto"
            onLoadedData={handleLoadedData}
            onEnded={handleClose}
          >
            <source src="/EdenPromo_Final.mp4" type="video/mp4" />
          </video>

        <div className={`evm-overlay-loader ${isVideoReady ? "hidden" : ""}`}>
          <svg
            viewBox="0 0 100 100"
            className="evm-svg-loader"
            fill="none"
            stroke="#D4A35F"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M50 15 L85 85 L15 85 Z" />
            <path d="M50 85 C 20 50, 35 20, 50 15 C 65 20, 80 50, 50 85 Z" />
            <path d="M50 15 L50 85" />
          </svg>
          <p className="evm-loader-text">Preparando tu experiencia...</p>
        </div>

          <div className={`evm-ui-overlay ${isVideoReady && !isVideoPlaying ? "" : "hidden"}`}>
            <div className="evm-play-container">
              <button
                onClick={handlePlay}
                disabled={!isVideoReady}
                className="evm-play-btn"
                aria-label="Reproducir video"
              >
                <Play className="evm-play-icon" fill="currentColor" />
              </button>
            </div>
          </div>

          {isVideoPlaying && showSkip && (
            <button onClick={handleClose} className="evm-skip-btn">
              Saltar
            </button>
          )}
        </div>

        {showRotateSignal && (
          <div className="evm-rotate-phone-overlay">
            <Smartphone className="evm-phone-icon" />
            <p className="evm-rotate-text">Gira tu teléfono</p>
          </div>
        )}
      </div>
    </>
  );
}
