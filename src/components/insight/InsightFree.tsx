import { useMemo } from 'react';
import { Badge, Paragraph, Spacing, TextField } from '@toss/tds-mobile';
import { Card } from '@/components/Card';
import { SummaryHero } from '@/components/SummaryHero';
import { PRICE_MAX, PRICE_MIN, RIDE_MAX, RIDE_MIN, parseIn, useInsightInputs, type InsightInputs } from '@/hooks/useInsightInputs';
import { useSettings } from '@/hooks/kpass';
import { calcKpassNetCost, calcRefund } from '@/lib/calc/refund';
import { comparePass } from '@/lib/calc/risk';
import { formatWon, verdictCopy } from '@/lib/kpassCopy';

export function InsightFree({ inputs }: { inputs?: InsightInputs } = {}) {
  const { settings } = useSettings();
  const own = useInsightInputs();
  const inp = inputs ?? own;

  const fare = settings?.avgFare ?? 0;
  const userType = settings?.userType ?? 'general';
  const rides = parseIn(inp.rideCount, RIDE_MIN, RIDE_MAX);
  const price = parseIn(inp.passPrice, PRICE_MIN, PRICE_MAX);

  const rideError = inp.rideCount !== '' && rides === null ? '0회에서 120회 사이로 입력해주세요' : null;
  const priceError = inp.passPrice !== '' && price === null ? '1,000원에서 500,000원 사이로 입력해주세요' : null;

  const refund = rides === null ? null : calcRefund(rides, fare, userType);

  const verdict = useMemo(() => {
    if (rides === null || price === null) return null;
    const c = comparePass(calcKpassNetCost(rides, fare, userType), price, rides);
    return verdictCopy(c.winner, c.diff);
  }, [rides, price, fare, userType]);

  return (
    <div data-testid="free-tier">
      {refund !== null ? (
        <SummaryHero
          testId="insight-refund"
          label="이번 달 예상 환급액"
          value={<Paragraph.Text typography="t1">{formatWon(refund)}</Paragraph.Text>}
        />
      ) : null}
      <Spacing size={16} />
      <TextField
        variant="box"
        label="이번 달 탑승 횟수"
        placeholder="예: 32"
        suffix="회"
        inputMode="numeric"
        enterKeyHint="next"
        value={inp.rideCount}
        hasError={rideError !== null}
        help={rideError ?? undefined}
        onChange={(e) => inp.setRideCount(e.target.value)}
      />
      <Spacing size={12} />
      <TextField
        variant="box"
        label="월 정기권 가격"
        placeholder="월 정기권 가격 (예: 62,000)"
        suffix="원"
        inputMode="numeric"
        enterKeyHint="done"
        value={inp.passPrice}
        hasError={priceError !== null}
        help={priceError ?? undefined}
        onChange={(e) => inp.setPassPrice(e.target.value)}
      />
      <Spacing size={16} />
      {verdict ? (
        <Card testId="verdict-card">
          <Badge size="small" variant="fill" color="blue">{verdict.badge}</Badge>
          <Spacing size={8} />
          <Paragraph.Text typography="t5">{verdict.text}</Paragraph.Text>
        </Card>
      ) : price === null && priceError === null && rides !== null ? (
        <Card testId="insight-verdict-prompt">
          <Paragraph.Text typography="t6">정기권 가격을 넣으면 어느 쪽이 이득인지 알려드려요</Paragraph.Text>
        </Card>
      ) : null}
    </div>
  );
}
