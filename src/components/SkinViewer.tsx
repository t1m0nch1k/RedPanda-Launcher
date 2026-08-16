import React, { useEffect, useRef } from 'react';
import { SkinViewer as SkinViewer3D, IdleAnimation } from 'skinview3d';

interface SkinViewerProps {
    skinUrl?: string | null;
    capeUrl?: string | null;
    width?: number;
    height?: number;
}

const SkinViewer: React.FC<SkinViewerProps> = ({ skinUrl, capeUrl, width = 300, height = 400 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewerRef = useRef<SkinViewer3D | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        viewerRef.current = new SkinViewer3D({
            canvas: canvasRef.current,
            width,
            height,
            skin: skinUrl || undefined,
            cape: capeUrl || undefined
        });

        // Add idle animation
        viewerRef.current.animation = new IdleAnimation();
        
        return () => {
            if (viewerRef.current) {
                viewerRef.current.dispose();
                viewerRef.current = null;
            }
        };
    }, []);

    const FALLBACK_SKIN = "https://minotar.net/skin/MHF_Steve";

    useEffect(() => {
        if (!viewerRef.current) return;
        
        const url = skinUrl || FALLBACK_SKIN;
        viewerRef.current.loadSkin(url).catch(() => {
            // If skin URL fails (e.g. 404 from ely.by with no custom skin), fallback to Steve
            viewerRef.current?.loadSkin(FALLBACK_SKIN).catch(console.error);
        });
    }, [skinUrl]);

    useEffect(() => {
        if (!viewerRef.current) return;
        
        if (capeUrl) {
            viewerRef.current.loadCape(capeUrl);
        } else {
            viewerRef.current.resetCape();
        }
    }, [capeUrl]);

    return (
        <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px`, display: 'block', margin: '0 auto' }} />
    );
};

export default SkinViewer;
