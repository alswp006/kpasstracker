import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Paragraph } from "@toss/tds-mobile";
import { formatNumber } from "../lib/utils";

type Typography = ComponentProps<typeof Paragraph.Text>["typography"];

/**
 * 카운트업 숫자 — 값이 바뀔 때 이전 값에서 새 값까지 부드럽게 증가(첫 렌더는 최종값 그대로)(시각 임팩트). 히어로 숫자에 사용.
 *
 * Pre-built (재구현 금지): SummaryHero의 value 슬롯 등 '핵심 숫자 하나'에. Amount처럼 nowrap+
 * tabular+단위 분리(줄바꿈 방지)를 내장한다. prefers-reduced-motion이거나 비-브라우저(jsdom)면
 * 애니메이션을 생략하고 최종값을 즉시 표시(접근성 + 테스트 안정).
 */
export function CountUp({
  value,
  unit = "원",
  typography = "t1",
  durationMs = 700,
  testId,
}: {
  value: number;
  unit?: string;
  typography?: Typography;
  durationMs?: number;
  testId?: string;
}) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);
  const from = useRef(value);

  useEffect(() => {
    const canAnimate =
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function" &&
      typeof window.matchMedia === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const startValue = from.current;
    from.current = value;
    if (!canAnimate || durationMs <= 0 || startValue === value) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(startValue + (value - startValue) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs]);

  return (
    <span
      data-testid={testId}
      style={{
        display: "inline-block",
        maxWidth: "100%",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <Paragraph.Text typography={typography}>
        {formatNumber(display)}
        {unit}
      </Paragraph.Text>
    </span>
  );
}
