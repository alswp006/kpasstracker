import { useState } from 'react';
import { Top, Spacing, ListRow, Button, Toast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Card } from '@/components/Card';
import { BannerArea } from '@/components/BannerArea';
import { HomeCards } from '@/components/home/HomeCards';
import { Paragraph } from '@toss/tds-mobile';
import { useRides, useSettings } from '@/hooks/kpass';
import { calcInsightInitialRides } from '@/lib/calc/risk';
import { logClick } from '@/lib/analytics';
import { DAILY_MAX } from '@/lib/kpassPolicy';
import type { StoreResult } from '@/lib/types';

type FailReason = Extract<StoreResult, { ok: false }>['reason'];

const FAIL_MESSAGE: Record<FailReason, string> = {
  NO_SETTINGS: '먼저 K-패스 유형을 설정해 주세요',
  INVALID_DATE: '오늘 날짜를 확인하지 못했어요',
  DAILY_MAX: `하루 최대 ${DAILY_MAX}회까지 기록할 수 있어요`,
  BELOW_ZERO: '오늘 기록이 0회라 되돌릴 게 없어요',
  QUOTA: '저장 공간이 부족해 기록하지 못했어요',
};

function haptic(type: 'success' | 'tickWeak' | 'tickStrong') {
  try {
    Promise.resolve(generateHapticFeedback({ type } as Parameters<typeof generateHapticFeedback>[0])).catch(() => {});
  } catch {
    /* WebView 밖 — 무시 */
  }
}

export default function Home() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { todayCount, monthIndex, increment, decrement } = useRides();
  const [toastText, setToastText] = useState<string | null>(null);

  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const count = monthIndex.byMonth[monthKey] ?? 0;

  const handle = (res: StoreResult, okHaptic: 'success' | 'tickWeak') => {
    if (res.ok) {
      haptic(okHaptic);
      return;
    }
    haptic('tickStrong');
    if (res.reason === 'NO_SETTINGS') {
      navigate('/onboarding', { replace: true });
      return;
    }
    setToastText(FAIL_MESSAGE[res.reason]);
  };

  return (
    <ScreenScaffold
      top={
        <Top
          title={<Top.TitleParagraph>이번 달 K-패스</Top.TitleParagraph>}
          right={
            <div style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center' }}>
              <Button
                variant="weak"
                size="small"
                aria-label="설정"
                onClick={() => navigate('/settings')}
              >
                설정
              </Button>
            </div>
          }
        />
      }
    >
      <HomeCards
        count={count}
        settings={settings ?? { userType: 'general', avgFare: 0 }}
        today={today}
      />

      <BannerArea />

      <Spacing size={16} />

      <Card testId="record-card">
        <Paragraph.Text typography="t5">
          <span data-testid="today-count">{`오늘 ${todayCount}회`}</span>
        </Paragraph.Text>
        <Spacing size={12} />
        <Button
          variant="fill"
          size="xlarge"
          display="block"
          data-testid="record-button"
          onClick={() => {
            logClick('ride_increment');
            handle(increment(), 'success');
          }}
        >
          +1 탔어요
        </Button>
        <Spacing size={8} />
        <Button
          variant="weak"
          display="block"
          data-testid="undo-button"
          aria-label="−1 되돌리기"
          onClick={() => handle(decrement(), 'tickWeak')}
        >
          −1
        </Button>
      </Card>

      <Spacing size={8} />

      <ListRow
        contents={<ListRow.Texts type="1RowTypeA" top="이번 달 기록" />}
        withArrow
        onClick={() => navigate('/records')}
      />

      <Spacing size={8} />

      <Button
        variant="weak"
        display="block"
        onClick={() => {
          logClick('insight_compare');
          navigate('/insight', { state: { rideCount: calcInsightInitialRides(count, today) } });
        }}
      >
        정기권과 비교하기
      </Button>

      <Spacing size={24} />

      <Toast
        position="bottom"
        open={toastText !== null}
        text={toastText ?? ''}
        onClose={() => setToastText(null)}
      />
    </ScreenScaffold>
  );
}
