import { Spacing } from "@toss/tds-mobile";
import { AdSlot } from "./AdSlot";

/**
 * 콘텐츠 섹션 사이에 두는 배너 영역.
 * 광고 그룹 ID(콘솔 발급값)가 없으면 아무것도 렌더하지 않는다 — 빈 영역이지 흰 화면이 아니다.
 * SDK가 WebView 밖에서 던지는 예외는 AdSlot이 삼킨다.
 */
export function BannerArea() {
  // 렌더 시점에 읽는다 — env 주입이 없는 빌드에서도 안전하게 degrade
  const adGroupId = import.meta.env.VITE_TOSS_AD_GROUP_ID;
  if (typeof adGroupId !== "string" || adGroupId.trim() === "") return null;

  return (
    <>
      <Spacing size={16} />
      <AdSlot adGroupId={adGroupId.trim()} />
    </>
  );
}

export default BannerArea;
