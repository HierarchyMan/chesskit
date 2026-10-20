import { ShapeTemplate } from "@/lib/scan/classify";
import { loadShapeTemplates } from "@/lib/scan/templates";
import { useEffect, useState } from "react";

export const useShapeTemplates = () => {
  const [templates, setTemplates] = useState<ShapeTemplate[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    loadShapeTemplates((done, total) => {
      if (!cancelled) setProgress(done / total);
    })
      .then((loaded) => {
        if (!cancelled) setTemplates(loaded);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not prepare piece recognition."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { templates, progress, error };
};
