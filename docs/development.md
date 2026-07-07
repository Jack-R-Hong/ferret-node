# Development Guide

開發 `@ferret/sdk-svelte` 本身（而非使用 SDK）的工程指引。

使用者文件請看 [`getting-started.md`](./getting-started.md)、[`client.md`](./client.md)、[`components.md`](./components.md)。

---

## 1. 專案結構

```
ferret-node/
├── src/
│   ├── lib/                       ← 整個 package 的內容都在這
│   │   ├── index.ts               ← 🟥 public API barrel（最重要）
│   │   ├── client.ts              FerretClient — 所有 /api/browser/* HTTP wrapper
│   │   ├── types.ts               所有 TypeScript interface / type
│   │   ├── errors.ts              FerretError class
│   │   ├── context.ts             Svelte context 的 set/get (Symbol key)
│   │   ├── webauthn.ts            b64url ↔ bytes helpers
│   │   ├── stores/
│   │   │   ├── session.svelte.ts  SessionStore (Svelte 5 $state)
│   │   │   └── flow.svelte.ts     FlowStore (Svelte 5 $state)
│   │   ├── i18n/
│   │   │   ├── index.ts           🟧 sub-barrel：createT / registerLocale
│   │   │   ├── en.ts              英文翻譯字典
│   │   │   └── zh-TW.ts           繁中翻譯字典
│   │   └── components/
│   │       ├── FerretProvider.svelte  Context root（必裝根）
│   │       ├── FlowForm.svelte        泛用 form renderer（其他 flow 內部用）
│   │       └── *Flow.svelte / *Manager.svelte / *List.svelte ...
│   ├── routes/+page.svelte        SvelteKit dev playground（非 package 內容）
│   ├── routes/examples/           可跑的 SDK 使用範例（e2e 測試的目標頁；非 package 內容）
│   ├── app.html / app.d.ts        SvelteKit 樣板（非 package 內容）
├── e2e/                           Playwright e2e / 安全測試（mock backend，非 package 內容）
├── playwright.config.ts           Playwright 設定（webServer 跑 vite dev）
├── dist/                          ← `npm run package` 產出，會發佈
├── docs/                          使用者 / 開發者文件
├── package.json                   exports 欄位指向 dist/index.js
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

只有 `src/lib/**` 會被打包進 npm。`src/routes`、`src/app.*` 都只是本機 dev server 用。

---

## 2. 🟥 `src/lib/index.ts` —— Public API Barrel

**這個檔案就是 package 的公開 API。沒進到這裡的東西使用者拿不到。**

### 2.1 它怎麼被使用者看到

`package.json` 把 `"."` import path 映到 `dist/index.js`（`svelte-package` 從 `src/lib/index.ts` 編出來的）：

```jsonc
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "svelte": "./dist/index.js",
    "default": "./dist/index.js"
  }
}
```

使用者寫的：

```ts
import { FerretClient, LoginFlow, createT } from '@ferret/sdk-svelte';
```

就是在 import `src/lib/index.ts` 的 re-export。

> 沒有設定 sub-path exports（沒有 `"./i18n"` 之類）。**所有公開符號都必須走 root barrel**。

### 2.2 barrel 的分區（不要動順序，註解區塊在 PR review 很好用）

目前的分區（見檔頭註解條）：

```
─── Client ─────────  FerretClient
─── Errors ─────────  FerretError
─── Types ──────────  所有 type-only re-export
─── Stores ─────────  createSessionStore / createFlowStore + types
─── Context ────────  setFerretContext / getFerret* + TFunction
─── i18n ───────────  createT / registerLocale / en / zhTW + Translations
─── WebAuthn helpers  b64ToBytes / bytesToB64
─── Components ─────  default-export 重新命名後的 Svelte components
```

### 2.3 加新東西的規則（checklist）

每次在 `src/lib/` 加新檔案、新 export，**必須**同步處理 `index.ts`：

| 你新增的東西 | 在 `index.ts` 怎麼做 |
|---|---|
| 新 client 方法 | 通常 **不需要**動 index（方法已經透過 `FerretClient` class 暴露） |
| 新 type / interface | 加到 `─── Types ───` 區塊的 `export type { ... }` 群組 |
| 新 store | `export { createXxxStore } from './stores/xxx.svelte.js';` + `export type { XxxState, XxxStore }` |
| 新 context getter | 加到 `─── Context ───` 區塊 |
| 新 component | `export { default as Xxx } from './components/Xxx.svelte';` |
| 新 i18n locale | 在 `src/lib/i18n/index.ts` 註冊（見 §3），再從 root barrel 用 `export ... from './i18n/index.js'` 補上 |
| 新 helper module | 開新區塊（用 `// ─── Title ───` 線條），保持風格一致 |

**漏加 = 對外不可見**。`vite dev` 仍會 work（因為 dev playground 用相對路徑 import），但 `npm run package` 後使用者拿不到，會出現「明明寫了卻 import 不到」的詭異情況。

### 2.4 注意事項

- **import path 一律 `.js` 結尾**，即使原始檔是 `.ts`。`./client.js`、`./stores/session.svelte.js`（連 `.svelte.js` 都要保留）。原因：`svelte-package` 把 `.ts` 編成同名 `.js` 後直接放 `dist/`，import path 不會被 rewrite，所以 source 寫的就是發佈後的相對路徑；使用者端若用 strict ESM / NodeNext resolution，沒有副檔名會 resolve 失敗。
- **types vs values 分開 export**。type 用 `export type { ... }`，value 用 `export { ... }`。`.svelte-kit/tsconfig.json` 開了 `verbatimModuleSyntax: true` + `isolatedModules: true`，把 type 跟 value 混在同一個 `export { ... }` 會 build 失敗。
- **components 用 default-export 改名**：`export { default as LoginFlow } from './components/LoginFlow.svelte';`。每個 `.svelte` 檔本身只有 default export。
- 不要做 `export * from './types.js'`。types.ts 內也有非 public 的東西時就會洩漏；現行慣例是顯式列舉。
- 加 export 之後檢查順序：放到正確區塊內、跟區塊裡既有項目的順序語意相近即可。

---

## 3. 🟧 `src/lib/i18n/index.ts` —— Sub-barrel

唯一的子 barrel。它的職責：

- 維護內部的 `locales` 字典（`en` + `zh-TW`，可動態加）
- 對外提供 `createT(locale, overrides?)` 與 `registerLocale(locale, translations)`
- re-export `en` 與 `zhTW` 物件本身（讓使用者可以 merge / 部分覆寫）

它不會被使用者直接 import（沒有 sub-path export），而是被 root barrel `src/lib/index.ts` 拉一次：

```ts
// in src/lib/index.ts
export { createT, registerLocale, en, zhTW } from './i18n/index.js';
export type { Translations } from './i18n/index.js';
```

### 加新翻譯 key 的流程

1. 在 `src/lib/i18n/en.ts` 加上 key + 英文字串。
2. 在 `src/lib/i18n/zh-TW.ts` 加上同 key 的繁中字串。**兩邊 key 必須對齊**，否則語系切換會 fallback 到英文（程式不會報錯）。
3. 在 component / store 裡用 `t('your.new.key')` 或 `t('your.new.key', { foo: 'bar' })`（`{{foo}}` 插值）。
4. key 命名沿用既有規則：
   - `flow.field.<field_name>` — 欄位 label
   - `flow.status.<status_name>` — 狀態訊息
   - `flow.method.<method>` — MFA 方法
   - `action.<verb>` — 按鈕文字
   - `error.<code>` 或 `error.field.<code>` — 錯誤訊息（對應 backend 的 `i18n_key`）
   - `mfa.<area>.<thing>` — MFA UI 文字

### 加新 locale

1. 新增 `src/lib/i18n/<locale>.ts`，export `const xx: Translations = { ... }`，**對齊 `en.ts` 所有 key**。
2. 在 `src/lib/i18n/index.ts` 的 `locales` 物件加一筆：`'xx': xx`。
3. （視需求）在 root barrel 加 `export { xx } from './i18n/index.js'`，讓使用者能 merge。

---

## 4. 三層結構 + 一個 Symbol-keyed Context

```
┌─────────────────────────────────────────────────────┐
│ Component                                            │
│  ├─ getFerretClient() / getFerretSession() / getFerretT()
│  ├─ 自己起一個 createFlowStore() 管 form 生命週期
│  └─ 用 FlowForm 渲染 + onsubmit handler 呼叫 client
└──────────┬──────────────────────────────────────────┘
           │ Svelte context (Symbol keys in context.ts)
┌──────────┴──────────────────────────────────────────┐
│ FerretProvider                                       │
│  new FerretClient(config)                            │
│  createSessionStore(client)                          │
│  createT(locale, translations)                       │
│  client.onUnauthorized = () => session.setUnauthenticated()
│  setFerretContext(client, session, t)                │
└──────────┬──────────────────────────────────────────┘
           │
┌──────────┴──────────────────────────────────────────┐
│ FerretClient (headless, 也可 Svelte 外用)             │
│  request() → fetch with credentials: 'include'       │
│  401 + code matches /^(session|token)_/i → onUnauthorized
│  非 JSON / non-OK → throw new FerretError(body.error)│
└─────────────────────────────────────────────────────┘
```

關鍵約定：

- **三個 context key 全是 `Symbol`**（`context.ts` 第 5–7 行），不會被外部覆寫。
- **session 401 攔截只攔 `session_*` / `token_*`**（`client.ts:104-107`）——避免「換 email 時打錯密碼」這種 domain-specific 401 把使用者踢出去。修這段邏輯要先想清楚 backend 的 error code naming。
- **CSRF 不是全域的**。每個 flow response 都帶自己的 `csrf_token`，要回傳給對應 mutation。不要把它存到 store。

---

## 5. Flow State Machine（每個 Flow component 都長一樣）

```
idle → loading → ready → submitting → success
                  ↑          │
                  └─ error ──┘
```

`FlowStore` (`stores/flow.svelte.ts`) 封裝這個 FSM。Flow component 的範本：

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createFlowStore } from '../stores/flow.svelte.js';
  import { getFerretClient, getFerretSession, getFerretT } from '../context.js';
  import FlowForm from './FlowForm.svelte';

  const client = getFerretClient();
  const session = getFerretSession();
  const t = getFerretT();
  const flow = createFlowStore();

  onMount(() => initFlow());

  async function initFlow() {
    flow.setLoading();
    try {
      const res = await client.createXxxFlow();
      flow.setReady(res);
    } catch (err) {
      flow.setError(err);
    }
  }

  async function handleSubmit(data: Record<string, string>) {
    const currentFlow = flow.flow;
    if (!currentFlow) return;
    flow.setSubmitting(currentFlow);
    try {
      const res = await client.submitXxx(currentFlow.id, {
        ...data,
        csrf_token: currentFlow.csrf_token ?? ''
      });
      flow.setSuccess(res);
      // 若這個 flow 會登入：session.setAuthenticated(...)
    } catch (err) {
      flow.setError(err, currentFlow);  // ← 第二參數保留 flow，讓 form 可以再 submit
    }
  }
</script>
```

多步驟 flow（如 `RecoveryFlow`、`LoginFlow` MFA 分支）：用 local `$state` 變數記 step，根據 backend 回傳的 `status` 切換 UI；不要再起第二個 FlowStore。

非 flow component（`PasskeyManager`、`SessionList` 之類的管理型 component）**不用** `FlowStore`，直接用幾個 `$state` 變數即可——它們不是 single-submit 表單。

---

## 6. 加一個新功能要動的檔案（cheat sheet）

### 6.1 新增一個 client 方法

backend 出了個新 endpoint `POST /api/browser/self-service/foo`：

1. `src/lib/types.ts` — 加 `FooRequest` / `FooResponse` interface（如果有需要）。
2. `src/lib/client.ts` — 在合適的 `─── Section ───` 註解區塊裡加方法。維持單行 JSDoc + 一行實作的簡潔風格。
3. `src/lib/index.ts` — **如果新增了 type**，到 `─── Types ───` 區塊補上。client 方法本身不用動 index。
4. 視需要更新 `docs/client.md`、`README.md` 的 API Coverage 表。

### 6.2 新增一個 component

例：要做一個 `FooManager.svelte`。

1. `src/lib/components/FooManager.svelte` — 跟 `PasskeyManager.svelte` 結構抄。
2. 翻譯 key 加到 `i18n/en.ts` 和 `i18n/zh-TW.ts`。
3. **`src/lib/index.ts`**：
   ```ts
   export { default as FooManager } from './components/FooManager.svelte';
   ```
4. 視需要更新 `docs/components.md`。
5. 在 `src/routes/+page.svelte` 加個 demo 區塊驗證 `npm run dev`。目前 playground 只 demo `LoginFlow` / `RegistrationFlow` / `RecoveryFlow`，要驗其他 component（多半需要登入狀態）就自己加分支或先登入再切。

### 6.3 新增一個 store

罕見。但若有：

1. `src/lib/stores/foo.svelte.ts` — 用 `$state` rune；export factory `createFooStore()` 和 `type FooStore = ReturnType<typeof createFooStore>`。
2. **`src/lib/index.ts`** 的 `─── Stores ───` 區塊：
   ```ts
   export { createFooStore } from './stores/foo.svelte.js';
   export type { FooState, FooStore } from './stores/foo.svelte.js';
   ```
3. 如需透過 context 取用 → `context.ts` 加一個 Symbol key + getter/setter，並更新 `index.ts` 的 `─── Context ───` 區塊。

---

## 7. Svelte 5 Runes 慣例

整個專案只用 Svelte 5 runes（**沒有** `writable`、`$:`、`createEventDispatcher`）：

- `$state(...)` — 一切 reactive state
- `$props()` + `interface Props {}` — 元件 props（解構 + 預設值同行寫）
- `$effect(...)` — 副作用；如果在 effect 內要讀某 state 但不想 track，用 `untrack(() => ...)`（見 `FlowForm.svelte:23`）
- `Snippet` (`import type { Snippet } from 'svelte'`) — children
- 事件 callback 用 prop callback 而非 dispatch：`onsuccess?: (identity: Identity) => void`，呼叫端 `<LoginFlow onsuccess={...} />`

store 的形狀都是：

```ts
function createXxxStore() {
  let state = $state<XxxState>({ ... });
  // mutator functions
  return {
    get state() { return state; },
    get someDerived() { return ...; },
    setSomething,
    reset
  };
}
export type XxxStore = ReturnType<typeof createXxxStore>;
```

用 getter 暴露 reactive view（這樣呼叫端讀 `store.state` 是 reactive 的），不要直接 spread。

---

## 8. 錯誤處理慣例

- HTTP 層：`FerretClient.request()` 把所有 non-2xx 包成 `FerretError`（`errors.ts`）。
- 非 JSON 回應另外處理（包成 `code: 'invalid_response'`），不要讓 `res.json()` 噴 `SyntaxError`。
- UI 層判別三種狀況：
  ```ts
  if (err instanceof FerretError && err.isValidation) {
    // field-level errors，在 FlowForm 內 per-field 顯示
  } else if (err instanceof FerretError) {
    // 用 t(err.i18nKey) 顯示翻譯訊息
  } else {
    // 不應該發生，顯示 String(err)
  }
  ```
- backend `i18n_key` 必須在前端 `i18n/*.ts` 有對應 key，否則 `t()` 會直接回傳 key 字串（不是 error，是 fallback）。

---

## 9. 開發 / 建置流程

| 指令 | 用途 |
|---|---|
| `npm run dev` | Vite dev server，跑 `src/routes/+page.svelte` 當 playground |
| `npm run check` | `svelte-kit sync` + `svelte-check`（型別檢查） |
| `npm run package` | 跑 `svelte-package` + `publint`，產出 `dist/`。**發佈用的指令** |
| `npm run build` | `vite build`（build SvelteKit playground app）+ `npm run package`。**playground 那段對發佈沒幫助**，發 npm 只需要 `package` |
| `npm run prepublishOnly` | `npm publish` 前自動跑 `package` |
| `npm run test` / `test:run` | Vitest 單元測試（watch / 一次性） |
| `npm run test:coverage` | Vitest + v8 coverage |
| `npm run test:e2e` | Playwright e2e / 安全測試（headless Chromium） |

注意：

- **`dist/` 不要手 commit 也不要手改**（已在 `.gitignore`）。每次 `npm run package` 會整個重寫。
- `svelte-package` 處理方式：
  - `.ts` → 編成同名 `.js` + 產 `.d.ts`
  - `.svelte` → **原檔複製** + 產 `.svelte.d.ts`（不會編成 `.js`；Svelte component 由消費端的 svelte compiler 處理）
  - 檔案結構保留 `src/lib/` 的形狀。所以 `src/lib/index.ts` → `dist/index.js` + `dist/index.d.ts`、`src/lib/components/LoginFlow.svelte` → `dist/components/LoginFlow.svelte` + `dist/components/LoginFlow.svelte.d.ts`。
- 如果 `dist/index.d.ts` 沒有你期待的 export，多半是你忘了在 `src/lib/index.ts` 加 export。`publint` 主要檢查 `package.json` `exports` 設定本身的正確性（path 是否存在等），**不會**抓「你忘了在 barrel 加 re-export」。
- **Dev 時看到的 SDK 是 source，不是 dist**：`src/routes/+page.svelte` 透過 SvelteKit 的 `$lib` alias 直接 import `$lib/index.js`（→ `src/lib/index.ts`）。改 `index.ts` 馬上反映，不需要先 `npm run package`。但 **發佈前** 還是要跑 `npm run package` 確認 `dist/` 真的有你期望的 export。

---

## 10. 測試（Vitest + Playwright）

兩層測試，跑法與職責不同：

**單元 / 契約測試 — Vitest（jsdom）**

- 檔案與被測程式**同目錄**（`src/lib/**/*.test.ts`），例如 `client.test.ts`、`svg.test.ts`、`stores/qr-login.test.ts`。
- `client.contract.test.ts` 用 `msw` 對 wire shape 做契約測試。
- 涵蓋 client（含 CSRF header 邏輯）、stores、i18n、errors、webauthn、`svgToDataUri` 等純邏輯。
- 跑：`npm run test:run`。

**端對端 / 安全測試 — Playwright（真實 Chromium）**

- 在 `e2e/`，驅動 `src/routes/examples/` 下的範例頁；每個測試用 `page.route(...)` mock 掉 `/api/browser/*`，**不需要真的 Ferret backend**（見 `e2e/mock.ts`）。
- 重點在**只有真瀏覽器測得出來**的行為：伺服器 SVG 的 DOM-XSS（`{@html}` vs `<img>` data-URI，jsdom 不會觸發 `<img onerror>`）、CSRF header 實際上鏈的情形。
- 有安全問題時的作法：mock 一個帶惡意 payload 的後端回應（如被污染的 `qr_svg`），在真瀏覽器觀察會不會執行 → 現有測試把它們當**回歸防線**（poisoned payload 必須 inert）。
- 跑：`npm run test:e2e`（會自動起 `vite dev`）。細節見 [`security.md`](./security.md)。

**CI（Dagger）**

GitHub Actions 只做一件事：`dagger call ci --source=.`。同一條 pipeline 可以在本機原樣重現（需要 Docker + `dagger` CLI）。`ci` 由四個 gate 並行組成，任一失敗即整體失敗：

| Gate | 內容 | 容器 |
|---|---|---|
| `check` | `svelte-check` 型別檢查 | Node 22 |
| `test` | Vitest 單元 + msw 契約測試 | Node 22 |
| `pack` | `svelte-package` + `publint` | Node 22 |
| `e2e` | Playwright 安全回歸 + 流程測試 | 官方 Playwright image |

- 單獨跑某個 gate：`dagger call e2e --source=.`（或 `check` / `test` / `pack`）。
- e2e gate 用官方 image（瀏覽器已內建），並設 `CI=1` 讓 `playwright.config.ts` 採 CI 行為（不 reuse dev server、禁止 `.only`）。backend 全程 mock，CI 裡不需要 Ferret server。
- 🟥 **升級 `@playwright/test` 時，必須同步更新 `.dagger/src/index.ts` 頂部的 `PLAYWRIGHT_IMAGE` tag**。image 內建的瀏覽器版本必須和 npm 套件完全一致，不一致時 Playwright 會以「找不到對應瀏覽器」直接拒跑。
- e2e 進了 CI 之後，`{@html}` sink 或 CSRF header 邏輯若被改壞，PR 會直接被擋下——不再依賴本機手動跑。

---

## 11. 文件之間的關係

| 檔案 | 對象 | 內容 |
|---|---|---|
| `README.md` | 使用者 | quick start + API coverage 速查表 |
| `docs/getting-started.md` | 使用者 | 第一次接觸 |
| `docs/architecture.md` | 使用者 / 想了解設計者 | layered design / context / FSM |
| `docs/client.md` | 使用者 | `FerretClient` 每個方法的詳細 reference |
| `docs/components.md` | 使用者 | 每個 component 的 props / 行為 |
| `docs/stores.md` | 使用者 | `SessionStore` / `FlowStore` / `QrLoginStore` |
| `docs/security.md` | 使用者 | 伺服器 SVG 安全渲染 / CSRF / SSR / 帳號列舉防護 |
| `docs/types.md` | 使用者 | type 對照 |
| `docs/errors.md` | 使用者 | `FerretError` 用法 |
| `docs/i18n.md` | 使用者 | 翻譯擴充 |
| `docs/styling.md` | 使用者 | CSS variables |
| `docs/development.md` ← **本檔** | 開發 SDK 本身者 | 結構 / barrel / 加 feature 流程 |

加新 feature 時：使用者面向的文件（依需要更新 `client.md`、`components.md`、`README.md` API 表），開發者面向的就是這份。
