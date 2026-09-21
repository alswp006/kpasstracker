import { useEffect, useState, type FocusEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ListRow, Paragraph, Spacing, TextField, Top, useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SubmitFooter } from "@/components/BottomCTA";
import { useSettings } from "@/hooks/kpass";
import { logClick } from "@/lib/analytics";
import type { UserType } from "@/lib/types";

type Mode = "onboarding" | "settings";

const TYPES: { value: UserType; label: string }[] = [
  { value: "general", label: "일반" },
  { value: "youth", label: "청년" },
  { value: "lowIncome", label: "저소득" },
];

const FARE_MIN = 100;
const FARE_MAX = 10000;
const PASS_MIN = 1000;
const PASS_MAX = 500000;

function haptic(type: "tickWeak" | "error" | "success") {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

function digits(v: string): string {
  return v.replace(/\D/g, "");
}

function centerField(e: FocusEvent<HTMLElement>) {
  try {
    e.currentTarget.scrollIntoView?.({ block: "center" });
  } catch {
    /* 무시 */
  }
}

function validateFare(raw: string): string | null {
  if (raw === "") return "평균 요금을 입력해주세요";
  const n = Number(raw);
  if (n < FARE_MIN || n > FARE_MAX) return "100원에서 10,000원 사이로 입력해주세요";
  return null;
}

function validatePass(raw: string): string | null {
  if (raw === "") return null;
  const n = Number(raw);
  if (n < PASS_MIN || n > PASS_MAX) return "1,000원에서 500,000원 사이로 입력해주세요";
  return null;
}

export default function SettingsForm({ mode = "onboarding" }: { mode?: Mode }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { settings, save } = useSettings();

  // 설정 모드인데 저장된 설정이 없으면 온보딩으로 보낸다
  const effectiveMode: Mode = mode === "settings" && settings ? "settings" : "onboarding";
  const isSettings = effectiveMode === "settings";

  useEffect(() => {
    if (mode === "settings" && !settings) navigate("/onboarding", { replace: true });
  }, [mode, settings, navigate]);

  const [userType, setUserType] = useState<UserType>(settings?.userType ?? "general");
  const [fare, setFare] = useState(isSettings && settings ? String(settings.avgFare) : "");
  const [pass, setPass] = useState(
    isSettings && settings?.passPrice != null ? String(settings.passPrice) : "",
  );
  const [fareError, setFareError] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  const submit = () => {
    const fe = validateFare(fare);
    const pe = isSettings ? validatePass(pass) : null;
    setFareError(fe);
    setPassError(pe);
    if (fe || pe) {
      haptic("error");
      return;
    }
    if (!isSettings) logClick("onboarding_start");
    const res = save({
      userType,
      avgFare: Number(fare),
      passPrice: isSettings && pass !== "" ? Number(pass) : isSettings ? null : settings?.passPrice ?? null,
    });
    if (!res.ok) {
      haptic("error");
      toast.openToast("저장 공간이 부족해 저장하지 못했어요");
      return;
    }
    haptic("success");
    if (isSettings) {
      toast.openToast("설정을 저장했어요");
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <ScreenScaffold
      top={
        <Top
          title={
            <Top.TitleParagraph>
              {isSettings ? "설정" : "K-패스 유형을 알려주세요"}
            </Top.TitleParagraph>
          }
        />
      }
      bottom={
        <SubmitFooter
          label={isSettings ? "저장" : "시작하기"}
          onClick={submit}
          disabled={fare === ""}
        />
      }
    >
      <Spacing size={16} />
      {TYPES.map((t) => (
        <ListRow
          key={t.value}
          contents={<ListRow.Texts type="1RowTypeA" top={t.label} />}
          right={
            userType === t.value ? (
              <Paragraph.Text typography="t5" color="var(--adaptiveBlue500)">
                ✓
              </Paragraph.Text>
            ) : undefined
          }
          onClick={() => {
            haptic("tickWeak");
            setUserType(t.value);
          }}
          style={{ minHeight: 56 }}
        />
      ))}
      <Spacing size={24} />
      <TextField
        variant="box"
        label="1회 평균 요금"
        suffix="원"
        inputMode="numeric"
        enterKeyHint={isSettings ? "next" : "done"}
        placeholder="예: 1500"
        value={fare}
        hasError={fareError != null}
        help={fareError ?? undefined}
        onFocus={centerField}
        onChange={(e) => {
          setFare(digits(e.target.value));
          setFareError(null);
        }}
      />
      <Spacing size={8} />
      <Paragraph.Text typography="t7">교통카드 1회 결제 금액을 넣어주세요</Paragraph.Text>
      {isSettings && (
        <>
          <Spacing size={24} />
          <TextField
            variant="box"
            label="월 정기권 가격"
            suffix="원"
            inputMode="numeric"
            enterKeyHint="done"
            placeholder="예: 55000"
            value={pass}
            hasError={passError != null}
            help={passError ?? undefined}
            onFocus={centerField}
            onChange={(e) => {
              setPass(digits(e.target.value));
              setPassError(null);
            }}
          />
        </>
      )}
      <Spacing size={96} />
    </ScreenScaffold>
  );
}
