"use client";

import React, { useState, useEffect } from "react";
import EdenVideoModal from "./EdenVideoModal";

export default function EdenWelcomeSplash() {
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    // Check localStorage
    const hasSeenSplash = localStorage.getItem("eden_video_bienvenida_v1");
    if (!hasSeenSplash) {
      setShow(true);
      localStorage.setItem("eden_video_bienvenida_v1", "true");
    }
  }, []);

  // Pasamos redirectToHomeOnClose={true} para mantener el comportamiento original
  // de redirigir a "/" si la pantalla de bienvenida se cierra estando en otra ruta
  return (
    <EdenVideoModal 
      isOpen={show} 
      onClose={() => setShow(false)} 
      redirectToHomeOnClose={true} 
    />
  );
}
