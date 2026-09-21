import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// 검수 반려 사유를 정적으로 막는다 — HEX 하드코딩(다크모드), 금지 UI 라이브러리,
// 외부 로그인/결제/광고/분석 SDK, 앱 설치 유도 문구, '취소' 버튼 문구.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !name.startsWith("__")) out.push(p);
  }
  return out;
}

const files = walk(join(process.cwd(), "src"));
const tsxFiles = files.filter((f) => f.endsWith(".tsx"));
const read = (f: string) => readFileSync(f, "utf8");
const offenders = (list: string[], re: RegExp) => list.filter((f) => re.test(read(f)));

describe("compliance scan", () => {
  it("covers the source tree including BannerArea", () => {
    expect(tsxFiles.length).toBeGreaterThan(10);
    expect(tsxFiles.some((f) => f.endsWith("BannerArea.tsx"))).toBe(true);
  });

  it("has no hardcoded HEX colors in .tsx", () => {
    expect(offenders(tsxFiles, /#[0-9a-fA-F]{3,6}\b/)).toEqual([]);
  });

  it("imports no banned UI libraries or payment/ad SDKs", () => {
    expect(
      offenders(files, /(?:from\s+|import\s*\(\s*|require\(\s*)['"](?:@mui|antd|stripe|@stripe|[^'"]*admob[^'"]*)/i),
    ).toEqual([]);
  });

  it("imports no external login or analytics SDKs", () => {
    expect(
      offenders(files, /from\s+['"](?:@react-oauth|firebase\/auth|kakao|react-ga|@amplitude|mixpanel)/i),
    ).toEqual([]);
  });

  it("has no install-prompt copy", () => {
    expect(offenders(tsxFiles, /앱\s*설치|설치하기|앱을?\s*설치|다운로드\s*받/)).toEqual([]);
  });

  it("has no '취소' button copy", () => {
    expect(offenders(tsxFiles, />\s*취소\s*</)).toEqual([]);
  });
});
