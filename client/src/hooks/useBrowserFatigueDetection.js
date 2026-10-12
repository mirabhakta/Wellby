import { useEffect, useState } from "react";
import {
  createFatigueStatus,
  getFatigueDisabledStatus,
  getFatigueUnsupportedStatus
} from "../lib/fatigue.js";

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function distance(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
}

function getEyeAspectRatio(keypoints, indices) {
  const [p1, p2, p3, p4, p5, p6] = indices.map((index) => keypoints[index]);
  const horizontal = distance(p1, p4);
  if (!horizontal) {
    return 0;
  }
  return (distance(p2, p6) + distance(p3, p5)) / (2 * horizontal);
}

function toConfidence(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

export function useBrowserFatigueDetection(enabled) {
  const [status, setStatus] = useState(() => getFatigueDisabledStatus());

  useEffect(() => {
    let isActive = true;
    let frameId = null;
    let stream = null;
    let detector = null;
    let video = null;
    let lowEyeFrameCount = 0;
    let lastUpdate = 0;

    if (!enabled) {
      setStatus(getFatigueDisabledStatus());
      return undefined;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus(getFatigueUnsupportedStatus());
      return undefined;
    }

    const cleanup = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      detector?.dispose?.();
    };

    const detect = async () => {
      try {
        const faces = await detector.estimateFaces(video, { flipHorizontal: true });
        const now = performance.now();

        if (!isActive || now - lastUpdate < 400) {
          frameId = requestAnimationFrame(detect);
          return;
        }
        lastUpdate = now;

        if (!faces.length) {
          lowEyeFrameCount = 0;
          setStatus(
            createFatigueStatus({
              connected: true,
              status: "no-face",
              warning: "Camera is on, but no face is visible.",
              confidence: 0
            })
          );
          frameId = requestAnimationFrame(detect);
          return;
        }

        const keypoints = faces[0].keypoints ?? [];
        const leftEar = getEyeAspectRatio(keypoints, LEFT_EYE);
        const rightEar = getEyeAspectRatio(keypoints, RIGHT_EYE);
        const averageEar = (leftEar + rightEar) / 2;

        if (averageEar < 0.22) {
          lowEyeFrameCount += 1;
        } else {
          lowEyeFrameCount = Math.max(0, lowEyeFrameCount - 1);
        }

        const eyeClosureConfidence = toConfidence((0.24 - averageEar) / 0.08);
        const sustainedConfidence = toConfidence(lowEyeFrameCount / 12);
        const confidence = toConfidence(Math.max(eyeClosureConfidence, sustainedConfidence));
        const fatigueDetected = lowEyeFrameCount >= 6 || confidence >= 0.75;

        setStatus(
          createFatigueStatus({
            connected: true,
            fatigueDetected,
            confidence,
            status: fatigueDetected ? "fatigue-detected" : "monitoring",
            warning: fatigueDetected ? "Signs of eye fatigue detected. Consider a short break." : undefined
          })
        );
      } catch {
        setStatus(
          createFatigueStatus({
            status: "processing-error",
            warning: "Fatigue detection paused because frame analysis failed."
          })
        );
      }

      if (isActive) {
        frameId = requestAnimationFrame(detect);
      }
    };

    const start = async () => {
      setStatus(createFatigueStatus({ status: "starting", warning: "Starting local fatigue detection..." }));

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });

        const tf = await import("@tensorflow/tfjs-core");
        await import("@tensorflow/tfjs-backend-cpu");
        await import("@tensorflow/tfjs-backend-webgl");
        await import("@tensorflow/tfjs-converter");
        const faceLandmarksDetection = await import("@tensorflow-models/face-landmarks-detection");

        try {
          await tf.setBackend("webgl");
        } catch {
          await tf.setBackend("cpu");
        }
        await tf.ready();

        detector = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: "tfjs",
            refineLandmarks: true,
            maxFaces: 1
          }
        );

        video = document.createElement("video");
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();

        setStatus(createFatigueStatus({ connected: true, status: "monitoring", confidence: 0 }));
        frameId = requestAnimationFrame(detect);
      } catch (error) {
        if (error?.name === "NotAllowedError") {
          setStatus(
            createFatigueStatus({
              status: "permission-denied",
              warning: "Camera permission denied. Enable camera access to use fatigue detection."
            })
          );
          return;
        }
        if (error?.name === "NotFoundError") {
          setStatus(
            createFatigueStatus({
              status: "camera-missing",
              warning: "No camera was found on this device."
            })
          );
          return;
        }
        setStatus(
          createFatigueStatus({
            status: "model-error",
            warning: "Could not start local fatigue detection on this browser."
          })
        );
      }
    };

    start();

    return () => {
      isActive = false;
      cleanup();
      setStatus(getFatigueDisabledStatus());
    };
  }, [enabled]);

  return status;
}
