# 프론트 SDK 가이드 (초보자용)

이 문서는 “미니프로그램 프론트( `frontend/` )가 백엔드(CloudBase 클라우드 함수, `backend/` )를 호출해서 DB 데이터를 가져오는 방법”을
**당신 프로젝트 코드 기준으로** 설명합니다.

---

## 0) 한 줄 요약

페이지(`pages/**`) → 서비스(`services/**`) → `requestJson()` → 우리 백엔드 서버(`backend/`) → DB 조회 → 결과 반환

---

## 1) 용어 정리(아주 쉽게)

- **프론트(Frontend)**: 화면 코드. 사용자가 보는 페이지/버튼/리스트
- **백엔드(Backend)**: 서버 역할. DB에서 데이터를 꺼내오거나 저장하는 코드
- **CloudBase(云开发)**: 위챗이 제공하는 “클라우드 백엔드”
- **클라우드 함수(Cloud Function)**: CloudBase에서 실행되는 서버 코드(= API)
- **DB(数据库 / Database)**: 데이터를 저장하는 곳
- **컬렉션(Collection)**: DB의 “테이블” 같은 것. 예: `products`, `orders`
- **문서(Document)**: 테이블의 “행(row)” 같은 것. 예: 상품 1개 데이터
- **action**: 우리 프로젝트에서 API를 구분하는 문자열 이름  
  예: `'home.get'`, `'goods.list'`, `'order.list'`

---

## 2) 왜 프론트가 DB를 직접 못 읽어?

미니프로그램은 사용자 폰에서 실행되는 앱이에요.
사용자 폰에서 DB 접속 정보를 들고 직접 DB에 붙으면:

- 보안상 위험(누구나 DB를 해킹/조회 가능)
- 권한/검증/로그를 통제하기 어려움

그래서 **항상 “백엔드(클라우드 함수)”를 통해서만 DB를 읽고/쓴다**고 생각하면 됩니다.

---

## 3) 이 프로젝트에서 “백엔드 호출”은 어디서 하나?

공통 호출 래퍼는 여기입니다.

- `frontend/services/_utils/http.js`

여기에는 `requestJson(path, options)`가 있고, 내부에서:

- `wx.request(...)` 실행
- 서버 응답을 `{ ok: true, data }` 형태로 받으면 `data`만 반환
- `{ ok: false, message }`면 에러로 처리

---

## 4) 내가 페이지에서 뭘 호출해야 해?

원칙: **페이지가 `wx.request()`를 직접 부르지 말고, 서비스 함수(`services/**`)만 부릅니다.**

예를 들어 홈 화면은:

- 서비스: `frontend/services/home/home.js`
- 페이지: `frontend/pages/home/home.js` (페이지는 서비스만 호출)

`frontend/services/good/fetchGoodsList.js`의 실데이터 모드 예시(개념):

```js
return requestJson('/api/products')
```

---

## 5) 백엔드 URL은 어디서 정하나?

백엔드 서버 주소는 여기에서 정합니다.

- `frontend/config/index.js`의 `config.apiBaseUrl`

예:

- 로컬 개발: `http://127.0.0.1:3000`
- 배포 서버: `https://api.example.com`

---

## 6) “DB에서 상품 가져오기” 구현 흐름(예시)

### 6-1) DB는 어디에 생기나?

지금 백엔드는 **SQLite**로 시작합니다.

- DB 파일: `backend/data.sqlite`
- 테이블: `products`

처음엔 서버를 실행한 뒤, 상품을 1개 생성 API로 넣는 방식이 제일 쉽습니다.

### 6-2) 백엔드에서 products 조회하기

백엔드는 여기입니다.

- `backend/src/index.js`
- `backend/src/db.js`

`GET /api/products`가 DB의 `products` 테이블을 읽어서 `{ ok: true, data: [...] }`로 반환합니다.

### 6-3) 프론트 서비스에서 products 호출하기

`frontend/services/good/fetchGoodsList.js`의 실데이터 분기에서:

- `requestJson('/api/products')`

로 연결합니다.

### 6-4) 페이지는 서비스 결과로 화면만 갱신

페이지에서는:

- `fetchGoodsList()` 호출
- 결과를 `this.setData({ ... })`로 렌더링

만 하면 됩니다.

---

## 7) 디버깅(문제 해결) 체크리스트

서버 호출이 안 될 때는 아래를 순서대로 확인하세요.

1. 백엔드 서버가 실행 중인가? (`npm run dev` / 콘솔에 listening 로그)
2. `frontend/config/index.js`의 `apiBaseUrl`이 맞나?
3. DevTools에서 네트워크 요청이 차단되지 않나? (도메인/URL 검사 설정)
4. 서버가 `{ ok: true, data }` 형태로 응답하고 있나?

---

## 8) 앞으로 우리가 추가할 API 예시(추천)

- 상품: `GET /api/products`, `GET /api/products/:id`, `POST /api/products`
- 장바구니: `GET /api/cart`, `POST /api/cart`
- 주문: `POST /api/orders`, `GET /api/orders`, `POST /api/orders/:id/ship`

