import { ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import { Card } from '@/components/Card';
import { Sparkline } from '@/components/Sparkline';
import { PRICE_MAX, PRICE_MIN, RIDE_MAX, RIDE_MIN, parseIn, useInsightInputs, type InsightInputs } from '@/hooks/useInsightInputs';
import { useRides, useSettings } from '@/hooks/kpass';
import { calcBreakEven, calcKpassNetCost, calcRefund } from '@/lib/calc/refund';
import { recentMonthKeys } from '@/lib/dateKeys';
import { formatWon, typeRateLabel } from '@/lib/kpassCopy';
import type { UserType } from '@/lib/types';

const TYPES: { type: UserType; name: string }[] = [
  { type: 'general', name: '일반' },
  { type: 'youth', name: '청년' },
  { type: 'lowIncome', name: '저소득' },
];

export function InsightLocked({ inputs }: { inputs?: InsightInputs } = {}) {
  const { settings } = useSettings();
  const { monthIndex } = useRides();
  const own = useInsightInputs();
  const inp = inputs ?? own;

  const fare = settings?.avgFare ?? 0;
  const userType = settings?.userType ?? 'general';
  const rides = parseIn(inp.rideCount, RIDE_MIN, RIDE_MAX) ?? 0;
  const price = parseIn(inp.passPrice, PRICE_MIN, PRICE_MAX);
  const breakEven = calcBreakEven(fare, userType, price ?? settings?.passPrice ?? null);
  const trend = recentMonthKeys(new Date(), 6).map((k) => monthIndex.byMonth[k] ?? 0);

  return (
    <div data-testid="locked-tier">
      <Paragraph.Text typography="t5">유형별 시나리오</Paragraph.Text>
      <Spacing size={8} />
      {TYPES.map(({ type, name }) => (
        <div key={type}>
          <Card testId="scenario-card">
            <ListRow
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={`${name} · ${typeRateLabel(type)}`}
                  topProps={{ color: 'var(--adaptiveGrey700)' }}
                  bottom={`환급 ${formatWon(calcRefund(rides, fare, type))}`}
                  bottomProps={{ color: 'var(--adaptiveGrey600)' }}
                />
              }
              right={<Paragraph.Text typography="t6">{`실부담 ${formatWon(calcKpassNetCost(rides, fare, type))}`}</Paragraph.Text>}
            />
          </Card>
          <Spacing size={8} />
        </div>
      ))}
      <Spacing size={16} />
      <Card testId="break-even">
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="정기권 손익분기"
              topProps={{ color: 'var(--adaptiveGrey700)' }}
              bottom={breakEven === null ? '이 가격에서는 K-패스가 항상 유리해요' : `월 ${breakEven}회 이상 타면 정기권이 이득이에요`}
              bottomProps={{ color: 'var(--adaptiveGrey600)' }}
            />
          }
          right={breakEven === null ? undefined : <Paragraph.Text typography="t6">{`${breakEven}회`}</Paragraph.Text>}
        />
      </Card>
      <Spacing size={16} />
      <Card testId="trend-card">
        <Paragraph.Text typography="t6">최근 6개월 탑승 횟수</Paragraph.Text>
        <Spacing size={8} />
        <Sparkline data={trend} testId="trend-sparkline" />
      </Card>
    </div>
  );
}
