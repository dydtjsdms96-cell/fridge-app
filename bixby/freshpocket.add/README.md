# 프레시포켓 Bixby Capsule (`freshpocket.freshpocket`)

## Capsule ID

```bxb
id (freshpocket.freshpocket)
```

| Console | 값 |
|---------|-----|
| Namespace | `freshpocket` |
| Capsule name | `freshpocket` |
| Full Capsule ID | `freshpocket.freshpocket` |

Private Submission / Unauthorized 오류는 **ID 불일치 또는 Console 미등록**이 원인입니다.  
→ 자세한 절차: [`SUBMISSION.md`](./SUBMISSION.md)

## 딥링크 계약

```text
AddFridgeItems(utterance)
  → freshpocket://add?text={encodeURIComponent(utterance)}
  → 앱 파싱 → 확인 시트 → 등록
```

## Studio

1. Open Capsule → `bixby/freshpocket.add`
2. Console에 `freshpocket.freshpocket` 등록 확인 ([SUBMISSION.md](./SUBMISSION.md))
3. Compile NL Model
4. 테스트 발화: `프레시포켓에서 우유 1.8L 계란 10개 추가해줘`
5. Private Submission

스펙: [`docs/bixby-capsule-intent-spec.md`](../../docs/bixby-capsule-intent-spec.md)
