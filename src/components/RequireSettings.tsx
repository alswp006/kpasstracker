import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSettings } from "@/hooks/kpass";

const ONBOARDING_PATH = "/onboarding";

/** 저장소에서 읽은 값이 실제 설정 객체인지 확인한다 (null·깨진 값은 미설정 취급). */
function hasSettings(settings: unknown): boolean {
  return typeof settings === "object" && settings !== null;
}

/**
 * 설정 가드 — 설정이 없으면 온보딩으로 보낸다.
 * 최초 진입 리다이렉트이므로 replace (뒤로가기로 빈 화면에 돌아오지 않게).
 */
export function RequireSettings({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  if (!hasSettings(settings)) return <Navigate to={ONBOARDING_PATH} replace />;
  return <>{children}</>;
}
