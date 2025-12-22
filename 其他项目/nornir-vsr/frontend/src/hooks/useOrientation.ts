import { useEffect, useState } from "react";

type Orientation = "portrait" | "landscape";

/**
 * Detects screen orientation so components can tweak layout without media queries.
 */
export const useOrientation = (): Orientation => {
  const getOrientation = () => {
    if (typeof window === "undefined") {
      return "portrait" as Orientation;
    }
    if (window.screen && typeof window.screen.orientation?.type === "string") {
      return window.screen.orientation.type.startsWith("landscape") ? "landscape" : "portrait";
    }
    return window.innerWidth >= window.innerHeight ? "landscape" : "portrait";
  };

  const [orientation, setOrientation] = useState<Orientation>(getOrientation);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(orientation: landscape)");
    const handleChange = () => setOrientation(mediaQuery.matches ? "landscape" : "portrait");
    handleChange();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);
    }
    window.addEventListener("resize", handleChange);
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleChange);
      }
      window.removeEventListener("resize", handleChange);
    };
  }, []);

  return orientation;
};

export default useOrientation;
