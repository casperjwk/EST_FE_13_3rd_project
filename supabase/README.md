# Supabase server area

이 디렉터리는 브라우저에서 실행되는 `src/`와 분리된 서버 영역입니다.
`generate-custom-recipe` Edge Function은 다음 작업을 담당합니다.

- 로그인 사용자 JWT 검증
- 원본 레시피와 재료/조리 단계 조회
- Alan AI `/api/v1/question` 호출
- `answer` 또는 `content` 응답 추출
- AI 응답의 JSON 파싱 및 기본 구조 검증

사용자 식단 관계 테이블과 생성 레시피 저장 테이블은 실제 DB 구조를 확인한 뒤
연결해야 합니다. 현재는 Auth user metadata에 `allergies` 배열과 `veganType`
문자열이 모두 있을 때만 생성하고, 결과를 DB에 저장하지 않고 반환합니다.

## Environment variables

`supabase/functions/.env.example`을 복사해 `.env.local`을 만듭니다. 로컬 파일과
배포 Secrets에는 다음 이름을 사용합니다.

```env
ALAN_API_BASE_URL=https://kdt-api-function.azurewebsites.net/api/v1
ALAN_CLIENT_ID=your-alan-client-id
```

Alan API 명세에는 모델 선택 파라미터가 없으므로 `AI_MODEL`은 사용하지 않습니다.
기존 `VITE_CLIENT_ID`는 당분간 호환되지만 `ALAN_CLIENT_ID`로 변경하는 것을
권장합니다.

## Local execution

Supabase CLI와 Docker가 필요합니다.

```bash
npx supabase start
npx supabase functions serve generate-custom-recipe \
  --env-file supabase/functions/.env.local
```

## Deployment

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set \
  ALAN_CLIENT_ID=YOUR_CLIENT_ID \
  ALAN_API_BASE_URL=https://kdt-api-function.azurewebsites.net/api/v1
npx supabase functions deploy generate-custom-recipe
```

프런트에서는 로그인 세션이 있는 상태로 호출합니다.

```js
const { data, error } = await supabase.functions.invoke("generate-custom-recipe", {
  body: { recipeId },
});
```
