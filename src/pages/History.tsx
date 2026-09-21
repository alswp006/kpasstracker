import { Asset, Button, ListRow, Top } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { AdSlot } from '@/components/AdSlot';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { EmptyState } from '@/components/StateView';
import { useMonthMeta, useRides, useSettings } from '@/hooks/kpass';
import { calcRefund } from '@/lib/kpassCalc';
import { formatWon, typeRateLabel } from '@/lib/kpassCopy';
import { toDateKey } from '@/lib/dateKeys';
import { RETENTION_MONTHS } from '@/lib/kpassPolicy';

/** "2026-08" → "2026년 8월" */
function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${y}년 ${Number(m)}월`;
}

export default function History() {
  const navigate = useNavigate();
  const { monthIndex } = useRides();
  const { monthMeta } = useMonthMeta();
  const { settings } = useSettings();
  const adGroupId = import.meta.env.VITE_TOSS_AD_GROUP_ID as string | undefined;

  const thisMonth = toDateKey(new Date()).slice(0, 7);
  const rows = (monthIndex.monthsDesc ?? [])
    .filter((m) => m !== thisMonth && (monthIndex.byMonth[m] ?? 0) > 0)
    .slice(0, RETENTION_MONTHS)
    .map((m) => {
      const count = monthIndex.byMonth[m] ?? 0;
      const snap = monthMeta?.months?.[m];
      const userType = snap?.userType ?? settings?.userType ?? 'general';
      const fare = snap?.avgFare ?? settings?.avgFare ?? 0;
      return { month: m, count, userType, refund: calcRefund(count, fare, userType) };
    });

  return (
    <ScreenScaffold top={<Top title={<Top.TitleParagraph>지난 기록</Top.TitleParagraph>} />}>
      {rows.length === 0 ? (
        <EmptyState
          testId="history-empty"
          icon={<Asset.ContentIcon name="icon-calendar-mono" alt="" style={{ width: 32, height: 32 }} />}
          title="아직 지난달 기록이 없어요"
          description="이번 달이 끝나면 여기에 쌓여요"
          action={
            <Button variant="weak" size="medium" onClick={() => navigate('/')}>
              홈으로 가기
            </Button>
          }
        />
      ) : (
        rows.map((r) => (
          <ListRow
            key={r.month}
            data-testid="month-row"
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={formatMonthLabel(r.month)}
                bottom={`${r.count}회 · ${typeRateLabel(r.userType)}`}
              />
            }
            right={<span style={{ whiteSpace: 'nowrap' }}>{formatWon(r.refund)}</span>}
          />
        ))
      )}

      {adGroupId ? <AdSlot adGroupId={adGroupId} /> : null}
    </ScreenScaffold>
  );
}
