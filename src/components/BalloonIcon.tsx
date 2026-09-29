import React from 'react';

export default function BalloonIcon({ size = 100, className = '' }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      className={className}
    >
      <style>
        {`
          .balloon-anim {
            animation: balloon-float 4s ease-in-out infinite;
          }
          .flame-anim-1 {
            animation: flame-flicker 0.12s ease-in-out infinite alternate;
            transform-origin: 50px 80px;
          }
          .flame-anim-2 {
            animation: flame-flicker 0.08s ease-in-out infinite alternate-reverse;
            transform-origin: 50px 80px;
          }
          .cloud-1 {
            animation: cloud-drift 15s linear infinite;
          }
          .cloud-2 {
            animation: cloud-drift 22s linear infinite reverse;
          }
          .cloud-3 {
            animation: cloud-drift 28s linear infinite;
          }
          
          @keyframes balloon-float {
            0%, 100% { transform: translateY(1.5px); }
            50% { transform: translateY(-3.5px); }
          }
          @keyframes flame-flicker {
            0% { transform: scale(0.85) rotate(-3deg); opacity: 0.8; }
            100% { transform: scale(1.15) rotate(3deg); opacity: 1; }
          }
          @keyframes cloud-drift {
            0% { transform: translateX(-15px); opacity: 0; }
            20% { opacity: 0.4; }
            80% { opacity: 0.4; }
            100% { transform: translateX(15px); opacity: 0; }
          }
        `}
      </style>

      {/* Background Clouds for elevation effect */}
      <g fill="var(--color-ochre)" opacity="0.3">
        <path className="cloud-1" d="M 25 35 a 4 4 0 0 1 8 0 a 6 6 0 0 1 12 0 a 4 4 0 0 1 0 8 l -20 0 a 4 4 0 0 1 0 -8 z" />
        <path className="cloud-2" d="M 70 20 a 3 3 0 0 1 6 0 a 5 5 0 0 1 10 0 a 3 3 0 0 1 0 6 l -16 0 a 3 3 0 0 1 0 -6 z" />
        <path className="cloud-3" d="M 15 70 a 3 3 0 0 1 6 0 a 5 5 0 0 1 10 0 a 3 3 0 0 1 0 6 l -16 0 a 3 3 0 0 1 0 -6 z" opacity="0.5"/>
      </g>

      {/* The Floating Balloon */}
      <g className="balloon-anim">
        
        {/* Envelope Clip Path for horizontal bands */}
        <clipPath id="envelope-shape">
          <path d="M 50 5 C 10 5, 10 45, 42 75 L 58 75 C 90 45, 90 5, 50 5 Z" />
        </clipPath>

        {/* Envelope Bands */}
        <g clipPath="url(#envelope-shape)">
          <rect x="0" y="0" width="100" height="26" fill="var(--color-green-dark)" />
          <rect x="0" y="26" width="100" height="14" fill="#fdfbf7" />
          <rect x="0" y="40" width="100" height="15" fill="var(--color-terracotta)" />
          <rect x="0" y="55" width="100" height="10" fill="#fdfbf7" />
          <rect x="0" y="65" width="100" height="15" fill="var(--color-ochre)" />
          
          {/* Vertical Meridians (Panel lines) */}
          <path d="M 50 5 C 18 8, 18 45, 44 75" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
          <path d="M 50 5 C 32 8, 34 45, 47 75" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
          <path d="M 50 5 L 50 75" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
          <path d="M 50 5 C 68 8, 66 45, 53 75" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
          <path d="M 50 5 C 82 8, 82 45, 56 75" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
        </g>

        {/* Envelope Outer Stroke */}
        <path d="M 50 5 C 10 5, 10 45, 42 75 L 58 75 C 90 45, 90 5, 50 5 Z" fill="none" stroke="var(--color-green-dark)" strokeWidth="2.5" strokeLinejoin="round" />
        
        {/* Burner Platform / Base Ring */}
        <path d="M 40 75 L 60 75" stroke="var(--color-green-dark)" strokeWidth="3" strokeLinecap="round" />

        {/* Ropes to Basket */}
        <path d="M 42 75 L 44 85" stroke="var(--color-green-dark)" strokeWidth="1.5" />
        <path d="M 47 75 L 47 85" stroke="var(--color-green-dark)" strokeWidth="1.5" />
        <path d="M 53 75 L 53 85" stroke="var(--color-green-dark)" strokeWidth="1.5" />
        <path d="M 58 75 L 56 85" stroke="var(--color-green-dark)" strokeWidth="1.5" />

        {/* The Burner Flame */}
        <path className="flame-anim-1" d="M 50 82 Q 47 77 50 74 Q 53 77 50 82 Z" fill="#ff6b00" />
        <path className="flame-anim-2" d="M 50 81 Q 48.5 78 50 76.5 Q 51.5 78 50 81 Z" fill="#ffb800" />

        {/* Basket */}
        <rect x="42" y="85" width="16" height="10" rx="1.5" fill="var(--color-terracotta)" stroke="var(--color-green-dark)" strokeWidth="2" />
        
        {/* Basket Wicker Detail */}
        <line x1="42" y1="88" x2="58" y2="88" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        <line x1="42" y1="92" x2="58" y2="92" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        <line x1="46" y1="85" x2="46" y2="95" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        <line x1="50" y1="85" x2="50" y2="95" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        <line x1="54" y1="85" x2="54" y2="95" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        
        {/* Sandbags */}
        <circle cx="41.5" cy="89.5" r="1.5" fill="#fdfbf7" stroke="var(--color-green-dark)" strokeWidth="1" />
        <circle cx="58.5" cy="89.5" r="1.5" fill="#fdfbf7" stroke="var(--color-green-dark)" strokeWidth="1" />
      </g>
    </svg>
  );
}
