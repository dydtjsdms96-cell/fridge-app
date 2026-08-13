# Bixby Capsule Intent Spec — 프레시포켓

> **구현 위치:** [`bixby/freshpocket.add/`](../bixby/freshpocket.add/)  
> Capsule ID: `freshpocket.freshpocket` (= namespace `freshpocket` + capsule `freshpocket`)  
> Private Submission ID 맞추기: [`bixby/freshpocket.add/SUBMISSION.md`](../bixby/freshpocket.add/SUBMISSION.md)

앱이 이미 이해하는 진입점:

```text
freshpocket://add?text=<URL-encoded utterance>
```

Capsule의 역할은 **발화 →** `text` **슬롯 조립 → 위 딥링크 실행**까지입니다.  
재료 파싱·확인 UI·저장은 앱(`parseVoiceUtterance` + 음성 등록 시트)이 담당합니다.

---

## 1. Capsule 메타


| 항목                      | 값                                              |
| ----------------------- | ---------------------------------------------- |
| Capsule ID (권장)         | `freshpocket.freshpocket`                      |
| Display name            | 프레시포켓                                          |
| Locale                  | `ko-KR`                                        |
| Android package         | `com.dydtjsdms96.fridgeapp`                    |
| Primary deep link       | `freshpocket://add?text=`                      |
| HTTPS fallback          | `https://fridge-app-aolm.vercel.app/add?text=` |
| Package scheme fallback | `com.dydtjsdms96.fridgeapp://add?text=`        |


Bixby Developer Studio에서 Android 앱 연동 시 package + custom scheme(`freshpocket`)을 등록합니다.

---



## 2. Intent: `AddFridgeItems`

냉장고에 재료를 추가하는 단일 인텐트입니다. v1은 **자유 문장 슬롯 하나**만 씁니다.

### 2.1 Goal

사용자가 말한 재료 문장을 그대로 앱에 넘겨, 확인 시트에서 수량/구역을 검토·등록하게 합니다.

### 2.2 Slots


| Slot        | Type                                      | Required | Description                                                          |
| ----------- | ----------------------------------------- | -------- | -------------------------------------------------------------------- |
| `utterance` | `viv.core.Text` (또는 Capsule local `Text`) | **Yes**  | “우유 1.8L 계란 10개”처럼 재료·수량·단위가 포함된 문장. 앱 명령어 잔여(“추가해줘” 등)가 섞여도 앱이 제거함. |


v1에서 구조화 슬롯(`itemName`, `quantity`, `unit`)은 **쓰지 않습니다**.  
앱 파서가 이미 한국어 문장을 처리하므로 Capsule은 문장 전달에 집중합니다.

### 2.3 Training utterances (예시)

```text
프레시포켓에 (utterance) 추가해줘
프레시포켓에 (utterance) 넣어줘
프레시포켓에 (utterance) 등록해줘
냉장고에 (utterance) 추가해줘
(utterance) 프레시포켓에 추가
(utterance) 추가해줘
```

`utterance` 예시 값:


| 발화 전체                      | `utterance` 슬롯   |
| -------------------------- | ---------------- |
| 프레시포켓에 우유 1.8L 계란 10개 추가해줘 | `우유 1.8L 계란 10개` |
| 프레시포켓에 두부랑 대파 넣어줘          | `두부랑 대파`         |
| 아이스크림 2개 추가해줘              | `아이스크림 2개`       |
| 1.8리터 우유 등록해줘              | `1.8리터 우유`       |




### 2.4 Action → Deep link

**입력:** `utterance: Text`  
**출력/실행:** Android deep link open

```text
freshpocket://add?text={urlEncode(utterance)}
```

의사코드:

```javascript
function urlEncode(s) {
  return encodeURIComponent(String(s).trim());
}

function buildAddLink(utterance) {
  return "freshpocket://add?text=" + urlEncode(utterance);
}

// Bixby action result: open app via deep link
// result = buildAddLink($utterance)
```

예:


| utterance        | Deep link                                                                             |
| ---------------- | ------------------------------------------------------------------------------------- |
| `우유 1.8L 계란 10개` | `freshpocket://add?text=%EC%9A%B0%EC%9C%A0%201.8L%20%EA%B3%84%EB%9E%80%2010%EA%B0%9C` |


앱 쪽 처리 순서:

1. `App.getLaunchUrl` / `appUrlOpen` → `parseFreshPocketDeepLink`
2. `/?voiceAdd=...` 또는 홈 음성 시트 오픈
3. `parseVoiceUtterance(text)` → 확인 UI → `saveFridgeItems`



### 2.5 Dialog (권장)


| 시점     | 예시                                     |
| ------ | -------------------------------------- |
| 실행 직전  | `프레시포켓에 넣을게요.`                         |
| 슬롯 미수집 | `어떤 재료를 넣을까요? 예를 들어 우유 1.8리터 계란 10개요.` |
| 앱 미설치  | (Bixby/OS 기본 처리) HTTPS fallback 안내 가능  |


HTTPS fallback (앱 미설치·스킴 실패 시):

```text
https://fridge-app-aolm.vercel.app/add?text={urlEncode(utterance)}
```

---



## 3. Bixby 모델 스케치

파일명은 Studio 버전에 따라 다를 수 있습니다. 개념만 고정합니다.

### 3.1 Concept

```text
// concepts/Utterance.model.bxb (개념)
text (Utterance) {
  description (재료 추가 문장)
}
```



### 3.2 Intent

```text
// intents/AddFridgeItems.intent.bxb
intent {
  match: AddFridgeItems(Utterance)
}
```



### 3.3 Action

```text
// actions/AddFridgeItems.model.bxb
action (AddFridgeItems) {
  type (Search) // 또는 Construct / 앱 연동 타입
  collect {
    input (utterance) {
      type (Utterance)
      min (Required)
    }
  }
  output (FreshPocketDeepLink) // 또는 AppLaunch / Result
}
```



### 3.4 JS endpoint (개념)

```javascript
// AddFridgeItems.js
module.exports.function = function AddFridgeItems(utterance) {
  var text = String(utterance || "").trim();
  if (!text) {
    throw fail("no-utterance");
  }
  return {
    deepLink: "freshpocket://add?text=" + encodeURIComponent(text),
    httpsLink:
      "https://fridge-app-aolm.vercel.app/add?text=" +
      encodeURIComponent(text),
  };
};
```

실제 Studio에서는 **App Launch / Deep Link result view**로 `deepLink`를 열어 주면 됩니다.

---



## 4. Invocation 예시 (사용자 관점)

```text
"빅스비야, 프레시포켓에 우유 1.8리터 계란 10개 추가해줘"
"빅스비야, 프레시포켓에 두부랑 대파 넣어줘"
"빅스비야, 아이스크림 2개 프레시포켓에 추가"
```

디스패치 목표:

```text
Capsule: freshpocket
Intent:  AddFridgeItems
Slot:    utterance = "우유 1.8리터 계란 10개"
Action:  open freshpocket://add?text=...
```

---



## 5. 빠른 명령어(Quick Command)와의 관계

Capsule 전에는 빠른 명령어로 **고정/반고정** 링크만 가능합니다.


| 방식           | 예                           |
| ------------ | --------------------------- |
| 고정           | `freshpocket://add?text=우유` |
| Capsule (권장) | 슬롯 `utterance` → 동적 `text=` |


빠른 명령어는 회귀 테스트용으로 유지하고, 자유 발화는 Capsule로 올립니다.

---



## 6. 테스트 체크리스트

- [ ] ADB:  
  `adb shell am start -a android.intent.action.VIEW -d "freshpocket://add?text=%EC%9A%B0%EC%9C%A0%201.8L"`
- [ ] 브라우저:  
  `https://fridge-app-aolm.vercel.app/?voiceAdd=우유%201.8L%20계란%2010개`
- [ ] Capsule simulator: `AddFridgeItems` + utterance 슬롯 → deep link 문자열 확인
- [ ] 실기기: 빅스비 발화 → 앱 확인 시트에 파싱 결과 표시
- [ ] 로그아웃 상태: 로그인 후에도 `voiceAdd` 유지되는지
- [ ] 이미 같은 재료 있을 때: 앱 중복 확인 플로우

---



## 7. v2 (나중에) — 구조화 슬롯 (선택)

앱 파서를 거치지 않고 Capsule이 나눠 주는 경로. **지금은 구현하지 않음.**


| Slot             | Type     | Example |
| ---------------- | -------- | ------- |
| `items`          | `Item[]` |         |
| `items.name`     | Text     | `우유`    |
| `items.quantity` | Number   | `1.8`   |
| `items.unit`     | Text     | `L`     |


딥링크 확장 예 (미구현):

```text
freshpocket://add?items=[{"name":"우유","quantity":1.8,"unit":"L"}]
```

v1은 계속 `text=` 한 칸만 사용합니다. Capsule·앱 계약을 단순하게 유지하기 위함입니다.

---



## 8. 계약 요약

```text
[Bixby]  AddFridgeItems(utterance: Text)
    │
    ▼
freshpocket://add?text={encodeURIComponent(utterance)}
    │
    ▼
[App]  parseFreshPocketDeepLink → parseVoiceUtterance → VoiceRegisterFlow → save
```

**Capsule은 문장을 모으고 딥링크만 연다. 파싱·저장은 앱.**