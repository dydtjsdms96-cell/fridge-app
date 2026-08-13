# Private Submission — Capsule ID 맞추기

## 에러

```text
Capsule Does Not Exist
You are not authorized to create submissions for this capsule.
The specified capsule does not exist.
```

이건 컴파일 문제가 아니라 **Studio의 `capsule.bxb` id ≠ Developer Center에 등록된 Capsule ID** (또는 미등록)일 때 납니다.

## Console 구조 (공식)

| 개념 | 의미 | 예시 |
|------|------|------|
| **Team Name** | 사람이 읽는 팀 표시 이름 | `freshpocket` 또는 `FreshPocket` |
| **Namespace** | 영구 식별자 (소문자/숫자/`_`). **ID의 앞부분** | `freshpocket` |
| **Capsule name** | Register Capsule 때 넣는 **점(.) 뒤** 이름 | `freshpocket` |
| **Capsule ID** | `namespace` + `.` + `capsuleName` | **`freshpocket.freshpocket`** |

레포 `capsule.bxb`는 지금 이렇게 맞춰 두었습니다:

```bxb
id (freshpocket.freshpocket)
```

## Console에서 확인할 것 (필수)

### 1) Namespace가 정말 `freshpocket`인지

1. [Bixby Developer Center](https://bixbydevelopers.com/) 로그인  
   (Studio와 **같은** Samsung 계정)
2. **Teams & Capsules** → 해당 팀
3. **Team Info / Manage Team**에서 **Namespace** 값 확인  
   - Team Name만 `freshpocket`이고 Namespace가 다르면, ID 앞부분은 **Namespace**를 써야 합니다.

### 2) Capsule이 “등록”돼 있는지

팀만 만들고 캡슐을 안 올린 경우가 많습니다.

1. 팀 페이지에서 **Register Capsule**
2. 입력란에는 **점 뒤 이름만** 넣습니다 → `freshpocket`  
   (여기다 `freshpocket.freshpocket` 전체를 넣으면 ID가 꼬일 수 있음)
3. 생성된 캡슐을 클릭
4. 페이지 **맨 위**에 표시된 **Capsule ID**를 복사

예: `freshpocket.freshpocket`

### 3) `capsule.bxb`에 그 ID를 그대로 넣기

```bxb
id (freshpocket.freshpocket)
```

Console 상단 ID가 다르면 **Console에 나온 문자열을 우선**하세요.  
예: Namespace가 `freshpocket`이고 캡슐 이름을 `add`로 등록했다면 → `freshpocket.add`

### 4) Studio 쪽

1. `capsule.bxb` 저장
2. Capsule **Reload / 다시 열기**
3. 시뮬/Submission 패널에 보이는 Capsule ID가 Console과 동일한지 확인
4. **Private Submission** 재시도

## 권한

- 제출 계정이 해당 캡슐 **Collaborator / Admin** 이어야 합니다.
- 다른 Samsung 계정으로 Studio에 로그인한 경우에도 같은 에러가 납니다.

## 빠른 체크리스트

- [ ] Team Info의 **Namespace** = `freshpocket` (또는 실제 값 기록)
- [ ] **Register Capsule**으로 캡슐 생성됨 (팀만 있는 상태 아님)
- [ ] 캡슐 상세 상단 **Capsule ID** 복사
- [ ] `capsule.bxb`의 `id (...)` 가 그 값과 **완전 일치** (공백/대소문자)
- [ ] Studio 재로드 후 Private Submission

## Console 상단 ID가 `freshpocket.freshpocket`이 아닐 때

그 전체 ID를 채팅으로 보내 주세요. `capsule.bxb`를 그 값으로 바로 맞추면 됩니다.
