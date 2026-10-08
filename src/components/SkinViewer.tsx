import React, { useEffect, useRef } from 'react';
import { SkinViewer as SkinViewer3D, IdleAnimation } from 'skinview3d';

interface SkinViewerProps {
    skinUrl?: string | null;
    model?: "classic" | "slim";
    capeUrl?: string | null;
    width?: number;
    height?: number;
    responsive?: boolean;
}

const SkinViewer: React.FC<SkinViewerProps> = ({ skinUrl, capeUrl, model, width = 300, height = 400, responsive = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewerRef = useRef<SkinViewer3D | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        viewerRef.current = new SkinViewer3D({
            canvas: canvasRef.current,
            width,
            height
        });

        // Add idle animation
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            viewerRef.current.animation = new IdleAnimation();
        }
        const viewer = viewerRef.current;
        const parent = canvasRef.current.parentElement;
        const observer = responsive && parent ? new ResizeObserver(entries => {
            const { width: w, height: h } = entries[0].contentRect;
            if (w > 0 && h > 0) viewer.setSize(w, h);
        }) : null;
        if (observer && parent) {
            observer.observe(parent);
            viewer.controls.enableZoom = false;
            viewer.playerObject.rotation.y = 0.25;
        }
        
        return () => {
            observer?.disconnect();
            if (viewerRef.current) {
                viewerRef.current.dispose();
                viewerRef.current = null;
            }
        };
    }, [width, height, responsive]);

    const FALLBACK_SKIN = "https://minotar.net/skin/MHF_Steve";

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        let disposed = false;
        // Load the texture before handing it to the viewer, so an earlier
        // network response cannot replace a more recently selected PNG.
        const load = (url: string, fallback: boolean) => {
            const texture = new Image();
            texture.crossOrigin = "anonymous";
            texture.onload = () => {
                if (disposed) return;
                try { viewer.loadSkin(texture, { model: model === "classic" ? "default" : model || "auto-detect" }); }
                catch { if (!fallback) load(FALLBACK_SKIN, true); }
            };
            texture.onerror = () => { if (!disposed && !fallback) load(FALLBACK_SKIN, true); };
            texture.src = url;
        };
        load(skinUrl || FALLBACK_SKIN, false);
        return () => { disposed = true; };
    }, [skinUrl, model, width, height]);

    useEffect(() => {
        if (!viewerRef.current) return;
        
        if (capeUrl) {
            viewerRef.current.loadCape(capeUrl);
        } else {
            viewerRef.current.resetCape();
        }
    }, [capeUrl, width, height]);

    return (
        <canvas ref={canvasRef} aria-label="3D skin" style={{ width: responsive ? '100%' : `${width}px`, height: responsive ? '100%' : `${height}px`, display: 'block', margin: '0 auto' }} />
    );
};

export default SkinViewer;
