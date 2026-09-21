import { Badge, Paragraph, Spacing } from '@toss/tds-mobile';
import { Card } from '@/components/Card';
import { CountUp } from '@/components/CountUp';
import { MiniBar } from '@/components/MiniBar';
import { SummaryHero } from '@/components/SummaryHero';
import { MIN_RIDES } from '@/lib/kpassPolicy';
import { refundCopy, riskCopy, typeRateLabel } from '@/lib/kpassCopy';
import type { UserSettings } from '@/lib/types';

type BadgeColor = 'blue' | 'green' | 'red' | 'yellow' | 'elephant';

const BADGE_COLOR: Record<string, BadgeColor> = {
  달성: 'green',
  순항: 'blue',
  주의: 'yellow',
  위험: 'red',
};

export interface HomeCardsProps {
  count: number;
  settings: Pick<UserSettings, 'userType' | 'avgFare'>;
  today: Date;
}

export function HomeCards({ count, settings, today }: HomeCardsProps) {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const risk = riskCopy(safeCount, today);
  const refund = refundCopy(safeCount, settings.avgFare, settings.userType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SummaryHero
        testId="progress-card"
        label="이번 달 탑승"
        value={<CountUp value={safeCount} unit={`/${MIN_RIDES}회`} typography="t1" />}
        caption={<MiniBar ratio={safeCount / MIN_RIDES} testId="progress-bar" />}
      />

      <Card testId="risk-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Paragraph.Text typography="t5">{risk.line1}</Paragraph.Text>
          {risk.badge ? (
            <Badge size="small" variant="weak" color={BADGE_COLOR[risk.badge] ?? 'elephant'}>
              {risk.badge}
            </Badge>
          ) : null}
        </div>
        {risk.line2 ? (
          <>
            <Spacing size={4} />
            <Paragraph.Text typography="t7">{risk.line2}</Paragraph.Text>
          </>
        ) : null}
      </Card>

      <Card testId="refund-card">
        <Paragraph.Text typography="st11">예상 환급</Paragraph.Text>
        <Spacing size={4} />
        <Paragraph.Text typography="t3">{refund.amount}</Paragraph.Text>
        {refund.sub ? (
          <>
            <Spacing size={4} />
            <Paragraph.Text typography="t7">{refund.sub}</Paragraph.Text>
          </>
        ) : null}
        <Spacing size={8} />
        <Paragraph.Text typography="st13">{typeRateLabel(settings.userType)}</Paragraph.Text>
      </Card>
    </div>
  );
}
