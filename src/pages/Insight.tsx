import { Spacing, Top } from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { TossRewardAd } from '@/components/TossRewardAd';
import { useInsightInputs } from '@/hooks/useInsightInputs';
import { InsightFree } from '@/components/insight/InsightFree';
import { InsightLocked } from '@/components/insight/InsightLocked';

/**
 * S4 분석 (/insight) — 핵심 결과 화면.
 * 무료 층(입력·환급액·판정)은 게이트 바깥, 잠금 층(시나리오·손익분기·추이)만 리워드 광고 안에 둔다.
 * 화면 전체를 게이트로 감싸지 않는다 — 광고가 없어도 핵심 답은 항상 보여야 한다.
 * 슬롯 ID가 없거나 광고 로드가 실패하면 TossRewardAd가 스스로 열린다(fail-open).
 */
export default function Insight() {
  const inputs = useInsightInputs();
  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>K-패스 vs 정기권</Top.TitleParagraph>} />}>
      <InsightFree inputs={inputs} />
      <Spacing size={24} />
      <TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID ?? ''}>
        <InsightLocked inputs={inputs} />
      </TossRewardAd>
      <Spacing size={24} />
    </ScreenScaffold>
  );
}
