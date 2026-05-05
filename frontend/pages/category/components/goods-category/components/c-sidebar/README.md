# c-sidebar 컴포넌트 가이드

카테고리 페이지에서 사용하는 좌측 사이드바 컴포넌트 사용법입니다.

## 1. 컴포넌트 목적

- 여러 카테고리 중 하나를 선택할 수 있는 세로 메뉴
- 선택 변경 시 오른쪽 목록/콘텐츠를 갱신하는 용도

## 2. 등록 방법

`app.json` 또는 사용 페이지의 `index.json`에 등록합니다.

```json
"usingComponents": {
  "wr-sidebar": "path/to/components/goods-category/wr-sidebar/index",
  "wr-sidebar-item": "path/to/components/goods-category/wr-sidebar/wr-sidebar-item/index"
}
```

## 3. 기본 사용 예시

```html
<wr-sidebar active-key="{{activeKey}}" bind:change="onChange">
  <wr-sidebar-item title="전체" />
  <wr-sidebar-item title="채소" />
  <wr-sidebar-item title="과일" />
</wr-sidebar>
```

```js
Page({
  data: { activeKey: 0 },
  onChange(e) {
    this.setData({ activeKey: e.detail });
  },
});
```

## 4. 주요 Props

### `wr-sidebar`

- `activeKey` (`string | number`)
  - 현재 선택된 인덱스

### `wr-sidebar-item`

- `title` (`string`)
  - 메뉴 텍스트
- `disabled` (`boolean`)
  - 비활성화 여부
- `dot` (`boolean`)
  - 우측 상단 점 표시
- `info` (`string | number`)
  - 배지 텍스트

## 5. 이벤트

- `wr-sidebar`의 `change`
  - 사용자가 메뉴를 바꿀 때 발생
  - `event.detail`에 선택 인덱스 전달

## 6. 스타일 커스터마이징

- `custom-class` 외부 클래스 지원
- 페이지별로 `active` 색상과 여백을 재정의해 디자인 통일 가능

## 7. 초보자 체크포인트

- `activeKey`를 `setData`로 갱신하지 않으면 선택 UI가 바뀌지 않습니다.
- 우측 콘텐츠 리스트와 `activeKey`가 같은 인덱스 규칙을 갖도록 맞춰야 합니다.

