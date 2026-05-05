# Mock 데이터 규칙 (보조 문서)

`mock.md`의 요약판입니다.  
팀 작업 시 빠르게 참고할 핵심 규칙만 정리했습니다.

## 1. 절대 규칙

- 페이지는 `model`을 직접 사용하지 않는다.
- 반드시 `services`를 통해서만 mock/real을 전환한다.
- mock과 real의 반환 구조를 동일하게 유지한다.

## 2. 구현 템플릿

```js
export function fetchXxx(params) {
  if (config.useMock) return mockFetchXxx(params);
  return requestJson('/api/xxx', { method: 'GET' }).then(adaptXxx);
}
```

## 3. 데이터 관계

- 가능하면 ID 규칙 기반으로 단순 연결
- 복잡한 관계는 별도 매핑 데이터로 관리

## 4. 전환 체크

- `useMock` 변경
- 실제 API 연결
- adapt 함수 검증
- 화면 회귀 테스트

## 5. 목표

mock에서 real로 전환할 때, **페이지 코드 수정 없이** 서비스 레이어에서만 해결하는 구조를 유지합니다.

