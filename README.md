# temple-support
お寺の名簿と会計管理（戸主・故人・年回忌・法要・会計分離）を想定した、Googleスプレッドシート連携型の設計＋プロトタイプです。

## 1. 要件整理

### 名簿管理
- 現在の戸主名で檀家名簿を管理。
- 戸主に故人を紐付ける。
- 故人には以下を登録：
  - 院号・法名
  - 俗名（お名前）
  - 没年齢
  - 死亡年月日

### 法要・案内管理
- 死亡年月日を起点に年回忌予定日を算出。
- 法要案内対象（近日期間）を抽出しやすくする。
- 法要実施記録（実施日、種別、対象故人）を保存。

### 会計管理
- 入出金を必ず「寺院（宗教法人）」と「個人」で分離。
- 収入：
  - お布施（葬儀・法要）
  - その他収入（寺院計上 / 個人計上）
- 支出：
  - 寺院経費
  - 個人支出

### 記録先
- 入出力はWebアプリ画面から。
- 永続記録は Google スプレッドシート。

## 2. 推奨アーキテクチャ

- フロントエンド：`index.html` + `script.js` + `style.css`
- 連携API：Google Apps Script Web App
- データストア：Google スプレッドシート（複数シート）

```
[ブラウザフォーム]
    ↓ JSON POST
[Apps Script Web App]
    ↓ 振り分け
[Google Spreadsheet: households/deceased/services/income/expenses/...]
```

## 3. スプレッドシート設計（最小）

### `households`（戸主マスタ）
| column | 説明 |
|---|---|
| household_id | 戸主ID（主キー） |
| householder_name | 戸主名 |
| householder_kana | ふりがな |
| phone | 連絡先 |
| address | 住所 |
| created_at | 作成日時 |
| updated_at | 更新日時 |

### `deceased`（故人マスタ）
| column | 説明 |
|---|---|
| deceased_id | 故人ID（主キー） |
| household_id | 戸主ID（外部キー） |
| secular_name | 俗名 |
| dharma_name | 院号・法名 |
| age_at_death | 没年齢 |
| death_date | 死亡年月日 |
| funeral_service_held | 葬儀法要の有無 |
| funeral_offering_amount | 葬儀時お布施 |
| created_at | 作成日時 |

### `memorial_services`（法要実績）
| column | 説明 |
|---|---|
| service_id | 法要ID（主キー） |
| deceased_id | 対象故人ID |
| service_type | 一周忌等 |
| service_date | 実施日 |
| offering_amount | お布施金額 |
| account_type | temple / personal |
| created_at | 作成日時 |

### `income`（収入台帳）
| column | 説明 |
|---|---|
| income_id | 収入ID |
| income_date | 入金日 |
| source_type | offering / other |
| related_service_id | 関連法要ID（任意） |
| amount | 金額 |
| account_type | temple / personal |
| memo | 摘要 |
| created_at | 作成日時 |

### `expenses`（支出台帳）
| column | 説明 |
|---|---|
| expense_id | 支出ID |
| expense_date | 支出日 |
| category | 費目 |
| amount | 金額 |
| account_type | temple / personal |
| memo | 摘要 |
| created_at | 作成日時 |

### `memorial_schedule`（年回忌予定）
| column | 説明 |
|---|---|
| deceased_id | 故人ID |
| memorial_type | 一周忌等 |
| target_date | 対象日 |
| notice_status | 未案内/案内済 |
| notice_date | 案内日 |

## 4. 年回忌算出ルール（例）

死亡年月日を基準に、以下を計算。
- 一周忌：+1年
- 三回忌：+2年
- 七回忌：+6年
- 十三回忌：+12年
- 十七回忌：+16年
- 二十三回忌：+22年
- 二十七回忌：+26年
- 三十三回忌：+32年

※ 実務上の運用に合わせて拡張可能。

## 5. Apps Script 連携API設計

フロントから次のイベントを送信。
- `UPSERT_HOUSEHOLD`
- `REGISTER_DECEASED`
- `REGISTER_MEMORIAL_SERVICE`
- `REGISTER_EXPENSE`

### 受信JSON（例）
```json
{
  "eventType": "REGISTER_MEMORIAL_SERVICE",
  "submittedAt": "2026-04-25T10:00:00.000Z",
  "data": {
    "serviceId": "SV-0001",
    "deceasedId": "DC-0001",
    "serviceType": "一周忌",
    "serviceDate": "2026-04-25",
    "offeringAmount": "30000",
    "accountType": "temple"
  }
}
```

### Apps Script 雛形
```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  switch (payload.eventType) {
    case 'UPSERT_HOUSEHOLD':
      appendHousehold(ss, payload);
      break;
    case 'REGISTER_DECEASED':
      appendDeceased(ss, payload);
      break;
    case 'REGISTER_MEMORIAL_SERVICE':
      appendServiceAndIncome(ss, payload);
      break;
    case 'REGISTER_EXPENSE':
      appendExpense(ss, payload);
      break;
    default:
      return ContentService.createTextOutput(JSON.stringify({ ok: false, message: 'unknown eventType' }))
        .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 6. 実装済みプロトタイプUI

`index.html` に次の入力フォームを実装。
1. 戸主登録
2. 故人登録（葬儀時情報含む）
3. 法要実施・お布施登録
4. 支出登録（寺院/個人分離）
5. Apps Script Web App URL設定

`script.js` はフォーム送信時にJSONを生成して、設定済みWeb App URLへPOSTします。

## 7. 次の拡張候補

- 検索・一覧画面（戸主別/故人別）
- 年回忌案内対象の自動抽出（30/60/90日前）
- CSV/PDF案内状出力
- 会計レポート（月次・年度、寺院/個人別）
- 権限管理（住職/寺務/閲覧のみ）
- 監査ログ（誰がいつ何を編集したか）
