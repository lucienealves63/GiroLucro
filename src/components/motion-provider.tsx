"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Respeita `prefers-reduced-motion` em todas as animações do framer-motion
 * (as transições por CSS já são neutralizadas em globals.css).
 * Quem configurou "reduzir movimento" no sistema recebe o app estático.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
