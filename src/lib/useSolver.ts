import { useEffect, useRef, useState, useCallback } from "react";
import type { SimParams } from "@/components/ControlPanel";
import { CONTAINER_MATERIALS, LIQUID_MATERIALS, AIR_CONDITIONS, HEAT_SOURCE_SIZES } from "./materials";

export interface ContainerProfile {
  front: Float32Array<ArrayBuffer>;
  back: Float32Array<ArrayBuffer>;
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
  floor: Float32Array<ArrayBuffer>;
}

function emptyWalls(temp: number): ContainerProfile {
  const make = () => new Float32Array(1024).fill(temp) as Float32Array<ArrayBuffer>;
  return { front: make(), back: make(), left: make(), right: make(), floor: make() };
}

function paramsToPayload(params: SimParams) {
  return {
    initialTemp: params.initialTemp,
    sourceTemp: params.sourceTemp,
    ambientTemp: params.ambientTemp,
    heatSourceScale: HEAT_SOURCE_SIZES[params.heatSourceSize].scale,
    container: CONTAINER_MATERIALS[params.containerMaterial],
    liquid: LIQUID_MATERIALS[params.liquid],
    air: AIR_CONDITIONS[params.airCondition],
    speed: params.speed,
    running: params.running,
  };
}

export function useSolver(params: SimParams, resetKey: number) {
  const workerRef = useRef<Worker | null>(null);
  const rafRef = useRef<number>(0);
  const tickInFlightRef = useRef(false);

  const profileRef = useRef<Float32Array<ArrayBuffer>>(new Float32Array(32768).fill(params.initialTemp) as Float32Array<ArrayBuffer>);
  const containerProfileRef = useRef<ContainerProfile>(emptyWalls(params.initialTemp));

  const [isBoiling, setIsBoiling] = useState(false);
  const [meanTemp, setMeanTemp] = useState(params.initialTemp);
  const lastBoiling = useRef(false);
  const lastMean = useRef(params.initialTemp);

  const simTimeRef = useRef(0);
  const lastTickTimestampRef = useRef<number | null>(null);
  const lastSimTimeState = useRef(-1);
  const [simTime, setSimTime] = useState(0);

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const resetEpochRef = useRef(0);

  const spawnWorker = useCallback((initialParams: SimParams) => {
    if (workerRef.current) {
      workerRef.current.onmessage = null;
      workerRef.current.terminate();
    }
    tickInFlightRef.current = false;

    const worker = new Worker(
      new URL("./solver.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      tickInFlightRef.current = false;

      const { type, payload } = e.data;
      if (type !== "STATE") return;
      if (payload.epoch !== resetEpochRef.current) return;

      profileRef.current = payload.profile;
      containerProfileRef.current = {
        front: payload.wallFront, back: payload.wallBack,
        left: payload.wallLeft, right: payload.wallRight,
        floor: payload.wallFloor,
      };

      const next = (payload.profile as Float32Array)
        .reduce((a: number, b: number) => a + b, 0) / payload.profile.length;

      if (Math.abs(next - lastMean.current) > 0.05) {
        lastMean.current = next;
        setMeanTemp(next);
      }

      const bp = LIQUID_MATERIALS[paramsRef.current.liquid]?.boilingPoint ?? Infinity;
      const nowBoiling = next >= bp;
      if (nowBoiling !== lastBoiling.current) {
        lastBoiling.current = nowBoiling;
        setIsBoiling(nowBoiling);
      }
    };

    worker.postMessage({ type: "RESET", payload: paramsToPayload(initialParams) });
  }, []);

  useEffect(() => {
    spawnWorker(params);
    return () => {
      workerRef.current?.terminate();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) { isMountedRef.current = true; return; }

    resetEpochRef.current += 1;
    spawnWorker(params);

    profileRef.current.fill(params.initialTemp);
    containerProfileRef.current = emptyWalls(params.initialTemp);
    setIsBoiling(false);
    setMeanTemp(params.initialTemp);
    lastBoiling.current = false;
    lastMean.current = params.initialTemp;
    simTimeRef.current = 0;
    lastTickTimestampRef.current = null;
    lastSimTimeState.current = 0;
    setSimTime(0);
  }, [resetKey]);

  // ── RAF loop ─────────────────────────────────────────────────
  useEffect(() => {
    const tick = (timestamp: number) => {
      const running = paramsRef.current.running;

      if (running) {
        if (lastTickTimestampRef.current !== null) {
          simTimeRef.current += (timestamp - lastTickTimestampRef.current) / 1000 * paramsRef.current.speed;
        }
        lastTickTimestampRef.current = timestamp;

        const rounded = Math.floor(simTimeRef.current);
        if (rounded !== lastSimTimeState.current) {
          lastSimTimeState.current = rounded;
          setSimTime(rounded);
        }
      } else {
        lastTickTimestampRef.current = null;
      }

      if (!tickInFlightRef.current) {
        if (running) tickInFlightRef.current = true;

        workerRef.current?.postMessage({
          type: "TICK",
          epoch: resetEpochRef.current,
          cfg: paramsToPayload(paramsRef.current),
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (!params.running) {
      setMeanTemp(params.initialTemp);
      lastMean.current = params.initialTemp;
    }
  }, [params.initialTemp]);

  return { profileRef, containerProfileRef, isBoiling, meanTemp, simTime };
}