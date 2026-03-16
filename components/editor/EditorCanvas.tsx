'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Text as KonvaText, Rect, Transformer, Group } from 'react-konva';
import Konva from 'konva';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectText,
  selectClip,
  clearSelection,
  updateTextOverlay,
  commitTextOverlay,
  commitClipUpdate,
  setCurrentTime,
  setPlaying,
  type TextOverlay,
  type Clip,
  type Track,
  type ClipFilters,
} from '@/store/editorSlice';
import { interpolateKeyframes } from '@/lib/keyframeInterpolation';

// ── Constants ────────────────────────────────────────────────────────────────

const CANVAS_ASPECT = 16 / 9;
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

// ── Helper: manage an OffscreenVideo per unique fileUrl ──────────────────────

interface VideoHandle {
  el: HTMLVideoElement;
  imageNode: Konva.Image | null;
  animId: number | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EditorCanvas() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const {
    tracks,
    textOverlays,
    currentTime,
    isPlaying,
    duration,
    selectedTextId,
    selectedClipId,
    selectedTrackId,
  } = useAppSelector((s) => s.editor);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const imageTransformerRef = useRef<Konva.Transformer>(null);
  const videoRefs = useRef<Map<string, VideoHandle>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playbackTimerRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const currentTimeRef = useRef(currentTime);
  // During playback, the rAF tick drives currentTimeRef directly (60fps).
  // When paused, sync it from Redux (user scrubs the timeline).
  if (!isPlaying) {
    currentTimeRef.current = currentTime;
  }

  const [stageSize, setStageSize] = useState({ width: 800, height: 450 });

  // ─── Resize observer ─────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const { width: cw, height: ch } = entries[0].contentRect;
      let w = cw;
      let h = cw / CANVAS_ASPECT;
      if (h > ch) {
        h = ch;
        w = ch * CANVAS_ASPECT;
      }
      setStageSize({ width: Math.floor(w), height: Math.floor(h) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = stageSize.width / BASE_WIDTH;

  // ─── Active clips at currentTime ──────────────────────────────────
  const activeVideoClip = useMemo(() => {
    for (const t of tracks) {
      if (t.type !== 'video' || !t.visible) continue;
      for (const c of t.clips) {
        if (currentTime >= c.startTime && currentTime < c.startTime + c.duration && c.fileUrl) {
          return c;
        }
      }
    }
    return null;
  }, [tracks, currentTime]);

  const activeImageClips = useMemo(() => {
    const result: { clip: Clip; trackId: string }[] = [];
    for (const t of tracks) {
      if (t.type !== 'image' || !t.visible) continue;
      for (const c of t.clips) {
        if (currentTime >= c.startTime && currentTime < c.startTime + c.duration && c.fileUrl) {
          result.push({ clip: c, trackId: t.id });
        }
      }
    }
    return result;
  }, [tracks, currentTime]);

  const activeAudioClips = useMemo(() => {
    const result: { clip: Clip; track: Track }[] = [];
    for (const t of tracks) {
      if (t.type !== 'audio' || !t.visible) continue;
      for (const c of t.clips) {
        if (currentTime >= c.startTime && currentTime < c.startTime + c.duration && c.fileUrl) {
          result.push({ clip: c, track: t });
        }
      }
    }
    return result;
  }, [tracks, currentTime]);

  const visibleTexts = useMemo(() => {
    return textOverlays.filter(
      (o) => currentTime >= o.startTime && currentTime < o.startTime + o.duration
    );
  }, [textOverlays, currentTime]);

  // ─── Selected image clip (for transformer) ─────────────────────────
  const selectedImageClip = useMemo(() => {
    if (!selectedClipId || !selectedTrackId) return null;
    const track = tracks.find(t => t.id === selectedTrackId);
    if (!track || track.type !== 'image') return null;
    return track.clips.find(c => c.id === selectedClipId) || null;
  }, [tracks, selectedClipId, selectedTrackId]);

  // ─── Video element management ─────────────────────────────────────
  const getOrCreateVideo = useCallback((url: string): VideoHandle => {
    let handle = videoRefs.current.get(url);
    if (handle) return handle;

    const el = document.createElement('video');
    el.src = url;
    el.crossOrigin = 'anonymous';
    el.playsInline = true;
    el.preload = 'auto';
    el.muted = false;
    el.style.display = 'none';
    document.body.appendChild(el);

    handle = { el, imageNode: null, animId: null };
    videoRefs.current.set(url, handle);
    return handle;
  }, []);

  // Cleanup videos on unmount
  useEffect(() => {
    return () => {
      videoRefs.current.forEach((h) => {
        h.el.pause();
        h.el.remove();
        if (h.animId) cancelAnimationFrame(h.animId);
      });
      videoRefs.current.clear();
    };
  }, []);

  // ─── Sync video element playback with timeline ─────────────────────
  useEffect(() => {
    if (!activeVideoClip?.fileUrl) {
      // Pause all videos when no active clip
      videoRefs.current.forEach((h) => h.el.pause());
      return;
    }

    const handle = getOrCreateVideo(activeVideoClip.fileUrl);

    // Pause other videos
    videoRefs.current.forEach((h, key) => {
      if (key !== activeVideoClip.fileUrl) h.el.pause();
    });

    if (isPlaying) {
      const videoTime = currentTimeRef.current - activeVideoClip.startTime + activeVideoClip.trimStart;
      if (Math.abs(handle.el.currentTime - videoTime) > 0.5) {
        handle.el.currentTime = videoTime;
      }
      // Only call play() if video is actually paused
      if (handle.el.paused) {
        handle.el.play().catch(() => {});
      }
    } else {
      handle.el.pause();
      const videoTime = currentTime - activeVideoClip.startTime + activeVideoClip.trimStart;
      handle.el.currentTime = videoTime;
    }
  }, [activeVideoClip, currentTime, isPlaying, getOrCreateVideo]);

  // ─── Audio element management ─────────────────────────────────────
  useEffect(() => {
    const activeUrls = new Set(activeAudioClips.map((a) => a.clip.fileUrl!));

    // Stop audio that is no longer active
    audioRefs.current.forEach((el, url) => {
      if (!activeUrls.has(url)) {
        el.pause();
      }
    });

    activeAudioClips.forEach(({ clip, track }) => {
      if (!clip.fileUrl) return;
      let el = audioRefs.current.get(clip.fileUrl);
      if (!el) {
        el = new Audio(clip.fileUrl);
        el.preload = 'auto';
        audioRefs.current.set(clip.fileUrl, el);
      }

      el.muted = !!track.muted;

      if (isPlaying) {
        const audioTime = currentTimeRef.current - clip.startTime + clip.trimStart;
        if (Math.abs(el.currentTime - audioTime) > 0.5) {
          el.currentTime = audioTime;
        }
        if (el.paused) {
          el.play().catch(() => {});
        }
      } else {
        el.pause();
        const audioTime = currentTime - clip.startTime + clip.trimStart;
        el.currentTime = audioTime;
      }
    });
  }, [activeAudioClips, currentTime, isPlaying]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRefs.current.forEach((el) => el.pause());
      audioRefs.current.clear();
    };
  }, []);

  // ─── Playback timer (requestAnimationFrame) ───────────────────────
  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) cancelAnimationFrame(playbackTimerRef.current);
      playbackTimerRef.current = null;
      return;
    }

    lastFrameTimeRef.current = performance.now();
    let lastDispatchTime = 0;

    const tick = (now: number) => {
      const dt = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      const next = currentTimeRef.current + dt;
      if (next >= duration) {
        dispatch(setPlaying(false));
        dispatch(setCurrentTime(0));
        currentTimeRef.current = 0;
        return;
      }
      currentTimeRef.current = next;

      // Throttle Redux dispatches to ~15fps for UI updates (timeline, text overlays).
      // Konva canvas redraws at 60fps independently via its own rAF loop.
      if (now - lastDispatchTime >= 66) {
        dispatch(setCurrentTime(next));
        lastDispatchTime = now;
      }

      playbackTimerRef.current = requestAnimationFrame(tick);
    };

    playbackTimerRef.current = requestAnimationFrame(tick);

    return () => {
      if (playbackTimerRef.current) cancelAnimationFrame(playbackTimerRef.current);
      // Sync final precise time to Redux when playback stops
      dispatch(setCurrentTime(currentTimeRef.current));
    };
    // Only depend on isPlaying, not currentTime – otherwise we'd keep restarting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration, dispatch]);

  // ─── Konva redraw loop for video frame updates ─────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    let id: number;
    const layer = stageRef.current?.findOne<Konva.Layer>('#video-layer');
    if (!layer) return;

    const loop = () => {
      layer.batchDraw();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [isPlaying]);

  // ─── Redraw video layer when paused (scrubbing / initial frame) ────
  useEffect(() => {
    if (isPlaying) return; // handled by rAF loop above
    const layer = stageRef.current?.findOne<Konva.Layer>('#video-layer');
    if (layer) {
      // Small delay to ensure the video element has seeked to the new frame
      const id = requestAnimationFrame(() => layer.batchDraw());
      return () => cancelAnimationFrame(id);
    }
  }, [isPlaying, currentTime, activeVideoClip]);

  // ─── Transformer effect ────────────────────────────────────────────
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    if (selectedTextId) {
      const node = stageRef.current?.findOne(`#${selectedTextId}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedTextId, visibleTexts]);

  // ─── Stage click → deselect ────────────────────────────────────────
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        dispatch(clearSelection());
      }
    },
    [dispatch]
  );

  // ─── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch(clearSelection());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  // ─── Text drag handlers ───────────────────────────────────────────
  const handleTextDragEnd = useCallback(
    (overlay: TextOverlay, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const newX = (node.x() / stageSize.width) * 100;
      const newY = (node.y() / stageSize.height) * 100;
      dispatch(commitTextOverlay({ id: overlay.id, updates: { x: newX, y: newY } }));
    },
    [dispatch, stageSize]
  );

  const handleTextTransformEnd = useCallback(
    (overlay: TextOverlay, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Text;
      const newX = (node.x() / stageSize.width) * 100;
      const newY = (node.y() / stageSize.height) * 100;
      dispatch(
        commitTextOverlay({
          id: overlay.id,
          updates: {
            x: newX,
            y: newY,
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
          },
        })
      );
    },
    [dispatch, stageSize]
  );

  // ─── Image drag / transform handlers ──────────────────────────────
  const handleImageDragEnd = useCallback(
    (clip: Clip, trackId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const newX = (node.x() / stageSize.width) * 100;
      const newY = (node.y() / stageSize.height) * 100;
      dispatch(
        commitClipUpdate({
          trackId,
          clipId: clip.id,
          updates: {
            canvasX: newX,
            canvasY: newY,
            // Persist current size too (in case it was still at default)
            canvasWidth: clip.canvasWidth ?? (node.width() / stageSize.width) * 100,
            canvasHeight: clip.canvasHeight ?? (node.height() / stageSize.height) * 100,
          },
        })
      );
    },
    [dispatch, stageSize]
  );

  const handleImageTransformEnd = useCallback(
    (clip: Clip, trackId: string, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Image;
      const newX = (node.x() / stageSize.width) * 100;
      const newY = (node.y() / stageSize.height) * 100;
      // Absorb scale into width/height so we don't double-scale next render
      const newW = ((node.width() * node.scaleX()) / stageSize.width) * 100;
      const newH = ((node.height() * node.scaleY()) / stageSize.height) * 100;
      node.scaleX(1);
      node.scaleY(1);

      dispatch(
        commitClipUpdate({
          trackId,
          clipId: clip.id,
          updates: {
            canvasX: newX,
            canvasY: newY,
            canvasWidth: newW,
            canvasHeight: newH,
            canvasRotation: node.rotation(),
          },
        })
      );
    },
    [dispatch, stageSize]
  );

  // ─── Image transformer effect ─────────────────────────────────────
  useEffect(() => {
    const tr = imageTransformerRef.current;
    if (!tr) return;

    if (selectedImageClip) {
      const node = stageRef.current?.findOne(`#${selectedImageClip.id}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedImageClip, activeImageClips]);

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(theme.palette.common.black, 0.92),
        overflow: 'hidden',
        position: 'relative',
        minHeight: 200,
      }}
    >
      {stageSize.width > 0 && (
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          onClick={handleStageClick}
          onTap={handleStageClick as any}
          style={{ background: '#000', borderRadius: 4 }}
        >
          {/* Video layer */}
          <Layer id="video-layer">
            {/* Background */}
            <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#000" />

            {/* Active video */}
            {activeVideoClip?.fileUrl && (
              <VideoNode
                url={activeVideoClip.fileUrl}
                width={stageSize.width}
                height={stageSize.height}
                getOrCreateVideo={getOrCreateVideo}
                filters={activeVideoClip.filters}
              />
            )}
          </Layer>

          {/* Image overlay layer — draggable / resizable */}
          <Layer id="image-layer">
            {activeImageClips.map(({ clip, trackId }) => (
              <ImageNode
                key={clip.id}
                clip={clip}
                canvasWidth={stageSize.width}
                canvasHeight={stageSize.height}
                onSelect={() => dispatch(selectClip({ trackId, clipId: clip.id }))}
                onDragEnd={(e) => handleImageDragEnd(clip, trackId, e)}
                onTransformEnd={(e) => handleImageTransformEnd(clip, trackId, e)}
              />
            ))}

            {/* Transformer for selected image */}
            <Transformer
              ref={imageTransformerRef}
              rotateEnabled
              keepRatio={false}
              enabledAnchors={[
                'top-left',
                'top-center',
                'top-right',
                'middle-left',
                'middle-right',
                'bottom-left',
                'bottom-center',
                'bottom-right',
              ]}
              anchorSize={8}
              anchorCornerRadius={2}
              anchorStroke="#f59e0b"
              anchorFill="#fff"
              borderStroke="#f59e0b"
              borderDash={[4, 4]}
              padding={4}
            />
          </Layer>

          {/* Text overlay layer */}
          <Layer id="text-layer">
            {visibleTexts.map((overlay) => {
              const relTime = currentTime - overlay.startTime;
              const interp = interpolateKeyframes(overlay, relTime);
              return (
              <KonvaText
                key={overlay.id}
                id={overlay.id}
                x={(interp.x / 100) * stageSize.width}
                y={(interp.y / 100) * stageSize.height}
                text={overlay.text}
                fontSize={interp.fontSize * scale}
                fontFamily={overlay.fontFamily}
                fontStyle={`${overlay.fontWeight >= 700 ? 'bold' : 'normal'} ${overlay.fontStyle}`}
                fill={overlay.color}
                opacity={interp.opacity}
                stroke={overlay.strokeWidth > 0 ? overlay.strokeColor : undefined}
                strokeWidth={overlay.strokeWidth * scale}
                shadowColor={overlay.shadowColor}
                shadowBlur={overlay.shadowBlur * scale}
                shadowOffsetX={2 * scale}
                shadowOffsetY={2 * scale}
                align={overlay.textAlign}
                width={overlay.width ? (overlay.width / 100) * stageSize.width : undefined}
                offsetX={0}
                offsetY={0}
                scaleX={interp.scaleX}
                scaleY={interp.scaleY}
                rotation={interp.rotation}
                draggable
                onClick={() => dispatch(selectText(overlay.id))}
                onTap={() => dispatch(selectText(overlay.id))}
                onDragEnd={(e) => handleTextDragEnd(overlay, e)}
                onTransformEnd={(e) => handleTextTransformEnd(overlay, e)}
              />
              );
            })}

            {/* Transformer for selected text */}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
                'middle-left',
                'middle-right',
              ]}
              anchorSize={8}
              anchorCornerRadius={2}
              anchorStroke={theme.palette.primary.main}
              anchorFill="#fff"
              borderStroke={theme.palette.primary.main}
              borderDash={[4, 4]}
              padding={4}
            />
          </Layer>
        </Stage>
      )}

      {/* Empty state */}
      {tracks.every((t) => t.clips.length === 0) && textOverlays.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <Typography variant="h6" color="text.secondary" sx={{ opacity: 0.5 }}>
            Drop media onto the timeline to begin
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ── Sub-component: render HTML video as Konva.Image ──────────────────────────

interface VideoNodeProps {
  url: string;
  width: number;
  height: number;
  getOrCreateVideo: (url: string) => VideoHandle;
  filters?: ClipFilters;
}

function VideoNode({ url, width, height, getOrCreateVideo, filters }: VideoNodeProps) {
  const imageRef = useRef<Konva.Image>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const wasCachedRef = useRef(false);

  useEffect(() => {
    const handle = getOrCreateVideo(url);
    const onLoad = () => setVideoEl(handle.el);
    if (handle.el.readyState >= 2) {
      setVideoEl(handle.el);
    } else {
      handle.el.addEventListener('loadeddata', onLoad);
    }
    return () => handle.el.removeEventListener('loadeddata', onLoad);
  }, [url, getOrCreateVideo]);

  // Trigger layer redraw when video element becomes available (initial frame)
  useEffect(() => {
    if (!videoEl) return;
    const id = requestAnimationFrame(() => {
      const layer = imageRef.current?.getLayer();
      if (layer) layer.batchDraw();
    });
    return () => cancelAnimationFrame(id);
  }, [videoEl]);

  // Apply Konva filters when filters change
  useEffect(() => {
    const node = imageRef.current;
    if (!node) return;
    // Konva's TS types for filters are inconsistent — use any cast
    const n = node as any;
    const hasActiveFilters = filters && (filters.brightness !== 0 || filters.contrast !== 0 || filters.blur > 0 ||
        filters.saturation !== 0 || filters.hueRotate !== 0 || filters.grayscale > 0 || filters.sepia > 0);
    if (hasActiveFilters) {
      const konvaFilters: any[] = [];
      if (filters.brightness !== 0) konvaFilters.push(Konva.Filters.Brighten);
      if (filters.contrast !== 0) konvaFilters.push(Konva.Filters.Contrast);
      if (filters.blur > 0) konvaFilters.push(Konva.Filters.Blur);
      if (filters.saturation !== 0 || filters.hueRotate !== 0) konvaFilters.push(Konva.Filters.HSL);
      n.filters(konvaFilters);
      n.brightness(filters.brightness / 100);
      n.contrast(filters.contrast);
      n.blurRadius(filters.blur);
      n.saturation(filters.saturation / 100);
      n.hue(filters.hueRotate);
      n.opacity(filters.opacity ?? 1);
      n.cache();
      wasCachedRef.current = true;
    } else {
      if (wasCachedRef.current) {
        n.filters([]);
        n.clearCache();
        wasCachedRef.current = false;
      }
      n.opacity(filters?.opacity ?? 1);
    }
  }, [filters]);

  if (!videoEl) return null;

  // Fit video inside canvas maintaining aspect ratio
  const vw = videoEl.videoWidth || 1920;
  const vh = videoEl.videoHeight || 1080;
  const videoAspect = vw / vh;
  const canvasAspect = width / height;
  let drawW: number, drawH: number, drawX: number, drawY: number;
  if (videoAspect > canvasAspect) {
    drawW = width;
    drawH = width / videoAspect;
    drawX = 0;
    drawY = (height - drawH) / 2;
  } else {
    drawH = height;
    drawW = height * videoAspect;
    drawX = (width - drawW) / 2;
    drawY = 0;
  }

  return (
    <KonvaImage
      ref={imageRef}
      image={videoEl}
      x={drawX}
      y={drawY}
      width={drawW}
      height={drawH}
    />
  );
}

// ── Sub-component: render a static image as Konva.Image (draggable + resizable) ─

interface ImageNodeProps {
  clip: Clip;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: () => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
}

function ImageNode({ clip, canvasWidth, canvasHeight, onSelect, onDragEnd, onTransformEnd }: ImageNodeProps) {
  const imageRef = useRef<Konva.Image>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = clip.fileUrl!;
    image.onload = () => setImg(image);
  }, [clip.fileUrl]);

  // Apply Konva filters
  const filters = clip.filters;
  const imgWasCachedRef = useRef(false);
  useEffect(() => {
    const node = imageRef.current;
    if (!node) return;
    const n = node as any;
    const hasActiveFilters = filters && (filters.brightness !== 0 || filters.contrast !== 0 || filters.blur > 0 ||
        filters.saturation !== 0 || filters.hueRotate !== 0 || filters.grayscale > 0 || filters.sepia > 0);
    if (hasActiveFilters) {
      const konvaFilters: any[] = [];
      if (filters.brightness !== 0) konvaFilters.push(Konva.Filters.Brighten);
      if (filters.contrast !== 0) konvaFilters.push(Konva.Filters.Contrast);
      if (filters.blur > 0) konvaFilters.push(Konva.Filters.Blur);
      if (filters.saturation !== 0 || filters.hueRotate !== 0) konvaFilters.push(Konva.Filters.HSL);
      n.filters(konvaFilters);
      n.brightness(filters.brightness / 100);
      n.contrast(filters.contrast);
      n.blurRadius(filters.blur);
      n.saturation(filters.saturation / 100);
      n.hue(filters.hueRotate);
      n.opacity(filters.opacity ?? 1);
      n.cache();
      imgWasCachedRef.current = true;
    } else {
      if (imgWasCachedRef.current) {
        n.filters([]);
        n.clearCache();
        imgWasCachedRef.current = false;
      }
      n.opacity(filters?.opacity ?? 1);
    }
  }, [filters, img]);

  if (!img) return null;

  // Compute default position (fit to canvas maintaining aspect ratio)
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const imgAspect = iw / ih;
  const cAspect = canvasWidth / canvasHeight;
  let defaultW: number, defaultH: number, defaultX: number, defaultY: number;
  if (imgAspect > cAspect) {
    defaultW = canvasWidth;
    defaultH = canvasWidth / imgAspect;
    defaultX = 0;
    defaultY = (canvasHeight - defaultH) / 2;
  } else {
    defaultH = canvasHeight;
    defaultW = canvasHeight * imgAspect;
    defaultX = (canvasWidth - defaultW) / 2;
    defaultY = 0;
  }

  // Use stored canvas position/size if available, otherwise default fit
  const drawX = clip.canvasX !== undefined ? (clip.canvasX / 100) * canvasWidth : defaultX;
  const drawY = clip.canvasY !== undefined ? (clip.canvasY / 100) * canvasHeight : defaultY;
  const drawW = clip.canvasWidth !== undefined ? (clip.canvasWidth / 100) * canvasWidth : defaultW;
  const drawH = clip.canvasHeight !== undefined ? (clip.canvasHeight / 100) * canvasHeight : defaultH;
  const rotation = clip.canvasRotation ?? 0;

  return (
    <KonvaImage
      ref={imageRef}
      id={clip.id}
      image={img}
      x={drawX}
      y={drawY}
      width={drawW}
      height={drawH}
      rotation={rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  );
}
