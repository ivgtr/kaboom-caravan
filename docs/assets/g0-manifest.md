# G0 Asset manifest

G0で生成・採用・却下した素材の来歴を記録する。生成開始前は記入例だけを保持し、実ファイルは[G0開始前チェックポイント](../playtest/g0-readiness.md)の承認後に追加する。

## 記録項目

| 項目                    | 内容                                                   |
| ----------------------- | ------------------------------------------------------ |
| Asset ID                | DefinitionまたはG0用の一意なID                         |
| Class                   | `CONCEPT` / `MODEL_REF` / `MODEL` / `ICON` / `VFX_REF` |
| Status                  | `candidate` / `accepted` / `rejected` / `superseded`   |
| File                    | リポジトリ内の相対パス                                 |
| Service / Model         | 使用した生成サービスとモデル                           |
| Generated at            | ISO 8601形式の生成日時                                 |
| Prompt source           | 指示書の版と個別Promptの保存先                         |
| Input references        | 使用した参照画像のAsset ID                             |
| License / Terms checked | 確認した利用条件と確認日                               |
| Decision                | 採用・修正・却下理由                                   |
| Operator                | 生成・判断を行った担当                                 |

## Assets

G0生成承認後、1候補につき1行を追加する。

| Asset ID        | Class | Status | File | Service / Model | Generated at | Prompt source | Input references | License / Terms checked | Decision   | Operator |
| --------------- | ----- | ------ | ---- | --------------- | ------------ | ------------- | ---------------- | ----------------------- | ---------- | -------- |
| _not generated_ | —     | —      | —    | —               | —            | —             | —                | —                       | G0承認待ち | —        |
