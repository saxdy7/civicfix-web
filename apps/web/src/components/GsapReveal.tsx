"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger);

interface GsapRevealProps {
  children: ReactNode;
  /** Stagger child elements matching this selector instead of the wrapper itself. */
  stagger?: string;
  delay?: number;
  className?: string;
}

export function GsapReveal({ children, stagger, delay = 0, className }: GsapRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion: leave everything in its natural, visible state.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = stagger
      ? Array.from(node.querySelectorAll<HTMLElement>(stagger))
      : [node];

    if (targets.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 26, filter: "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.85,
          delay,
          ease: "power3.out",
          stagger: stagger ? 0.09 : 0,
          scrollTrigger: {
            trigger: node,
            start: "top 85%",
            once: true,
          },
        },
      );
    }, node);

    return () => ctx.revert();
  }, [stagger, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
