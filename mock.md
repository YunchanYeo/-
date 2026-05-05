# Mock 데이터 운영 가이드

이 문서는 프로젝트에서 mock 데이터를 어떻게 다뤄야 하는지 정리한 문서입니다.

## 1. 왜 Mock이 필요한가?

백엔드가 아직 준비되지 않았거나, 특정 화면을 빠르게 개발할 때 mock 데이터가 유용합니다.

- 장점
  - 화면 개발 속도 향상
  - API 장애와 무관하게 UI 작업 가능
  - 테스트 데이터 재현 쉬움

## 2. 기본 원칙

### 2.1 페이지는 model을 직접 호출하지 않기

- 금지: `pages/**`에서 `model/**` 직접 import
- 권장: `services/**`를 통해서만 데이터 접근

즉, 데이터 접근 순서는 아래처럼 통일합니다.

```text
Page -> Service -> (Mock 또는 Real API)
```

### 2.2 `useMock`로 분기하기

- 설정 파일: `frontend/config/index.js`
- `useMock: true`이면 mock 반환
- `useMock: false`이면 실제 API 호출

## 3. 서비스 함수 작성 규칙

서비스 함수는 반드시 Promise를 반환하고, 화면에서 바로 쓰기 좋은 형태로 변환해서 반환합니다.

예시 패턴:

```js
export function fetchSomething(params) {
  if (config.useMock) return mockFetchSomething(params);
  return requestJson('/api/xxx', { method: 'GET' }).then(adaptRealData);
}
```

핵심:

- mock/real 모두 같은 반환 구조를 유지
- UI는 데이터 출처를 몰라도 동작해야 함

## 4. 데이터 관계 설계 팁

### 4.1 ID 규칙 기반 연결(권장)

가능하면 단순한 ID 규칙으로 관계를 유지하세요.

- 예: 상품 ID와 쿠폰 ID를 같은 규칙으로 연결
- 장점: 데이터 생성/유지보수가 단순함

### 4.2 별도 관계 테이블

ID 규칙만으로 관계가 어렵다면 관계 mock을 별도로 둡니다.

- A 목록
- B 목록
- A->B 매핑
- B->A 매핑

## 5. 실데이터 전환 시 체크리스트

1) `useMock`를 `false`로 변경  
2) 서비스 함수에서 실제 API 경로 연결  
3) real 응답을 mock 구조로 변환(adapt)  
4) 화면 코드 수정 없이 정상 동작 확인  

## 6. 권장 개발 순서

1. UI 컴포넌트 완성(mock 기반)  
2. 서비스 레이어 분리  
3. 백엔드 API 연결  
4. adapt 함수로 응답 스키마 통일  
5. `useMock` 전환 테스트  

