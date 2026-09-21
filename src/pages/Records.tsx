import { useState } from 'react';
import { Asset, Button, ListRow, Paragraph, Spacing, Toast, Top } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SummaryHero } from '@/components/SummaryHero';
import { EmptyState } from '@/components/StateView';
import { useRides } from '@/hooks/kpass';
import { formatDayLabel, toDateKey } from '@/lib/dateKeys';
import { DAILY_MAX } from '@/lib/kpassPolicy';
import type { StoreResult } from '@/lib/types';

type FailReason = Extract<StoreResult, { ok: false }>['reason'];

const FAIL_MESSAGE: Record<FailReason, string> = {
  NO_SETTINGS: '먼저 K-패스 유형을 설정해 주세요',
  INVALID_DATE: '이 날짜는 수정할 수 없어요',
  DAILY_MAX: `하루 최대 ${DAILY_MAX}회까지 기록할 수 있어요`,
  BELOW_ZERO: '0회보다 줄일 수 없어요',
  QUOTA: '저장 공간이 부족해 기록하지 못했어요',
};

function haptic(type: 'tickWeak' | 'tickStrong') {
  try {
    Promise.resolve(generateHapticFeedback({ type } as Parameters<typeof generateHapticFeedback>[0])).catch(() => {});
  } catch {
    /* WebView 밖 — 무시 */
  }
}

/** 이번 달 1일 ~ 오늘, 최신순 날짜 키 */
function monthDateKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let d = now.getDate(); d >= 1; d--) {
    keys.push(toDateKey(new Date(now.getFullYear(), now.getMonth(), d)));
  }
  return keys;
}

export default function Records() {
  const navigate = useNavigate();
  const { days, monthIndex, setDay } = useRides();
  const [toastText, setToastText] = useState<string | null>(null);

  const now = new Date();
  const monthKey = toDateKey(now).slice(0, 7);
  const total = monthIndex.byMonth[monthKey] ?? 0;
  const keys = monthDateKeys(now);

  const change = (key: string, next: number) => {
    const res = setDay(key, next);
    if (res.ok) {
      haptic(res.count >= DAILY_MAX ? 'tickStrong' : 'tickWeak');
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
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>이번 달 기록</Top.TitleParagraph>} />}>
      <SummaryHero
        testId="records-total-card"
        label="이번 달 누적"
        value={
          <Paragraph.Text typography="t1">
            <span data-testid="month-total">{total}</span>
            {'회'}
          </Paragraph.Text>
        }
      />

      <Spacing size={8} />

      {total === 0 ? (
        <EmptyState
          testId="records-empty"
          icon={<Asset.ContentIcon name="icon-pencil-mono" alt="" style={{ width: 32, height: 32 }} />}
          title="아직 기록이 없어요"
          description="탄 날의 + 버튼을 눌러 횟수를 채워 보세요"
        />
      ) : null}

      {keys.map((key) => {
        const count = days[key] ?? 0;
        return (
          <ListRow
            key={key}
            data-testid="day-row"
            contents={<ListRow.Texts type="1RowTypeA" top={formatDayLabel(key)} />}
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center' }}>
                  <Button
                    data-testid={`day-minus-${key}`}
                    variant="weak"
                    size="small"
                    aria-label={`${formatDayLabel(key)} 1회 줄이기`}
                    disabled={count <= 0}
                    onClick={() => change(key, count - 1)}
                  >
                    −
                  </Button>
                </div>
                <span
                  data-testid={`day-count-${key}`}
                  style={{
                    minWidth: 40,
                    textAlign: 'right',
                    color: count === 0 ? 'var(--tds-color-grey-400)' : undefined,
                  }}
                >
                  {`${count}회`}
                </span>
                <div style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center' }}>
                  <Button
                    data-testid={`day-plus-${key}`}
                    variant="weak"
                    size="small"
                    aria-label={`${formatDayLabel(key)} 1회 늘리기`}
                    onClick={() => change(key, count + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            }
          />
        );
      })}

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
