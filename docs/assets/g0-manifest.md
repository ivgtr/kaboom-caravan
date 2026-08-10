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

1候補につき1行を追加する。

| Asset ID                       | Class     | Status       | File                                                            | Service / Model                               | Generated at              | Prompt source                                               | Input references | License / Terms checked                                                                                                                                                | Decision                                                       | Operator                    |
| ------------------------------ | --------- | ------------ | --------------------------------------------------------------- | --------------------------------------------- | ------------------------- | ----------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------- |
| `REF_STYLE_001_CANDIDATE_V001` | `CONCEPT` | `superseded` | `artifacts/g0/style-reference/ref_style_001_candidate_v001.png` | OpenAI built-in `image_gen`（model ID非公開） | 2026-08-10T21:41:05+09:00 | `artifacts/g0/style-reference/ref_style_001_prompt.md`      | 初稿を編集       | 2026-08-10に[公式Image Generationドキュメント](https://developers.openai.com/api/docs/guides/image-generation)を確認。Output利用はユーザーへ適用される契約・法令に従う | 敵車両方針をMonsterへ変更したためV2で置換                      | Codex                       |
| `REF_STYLE_001_CANDIDATE_V002` | `CONCEPT` | `candidate`  | `artifacts/g0/style-reference/ref_style_001_candidate_v002.png` | OpenAI built-in `image_gen`（model ID非公開） | 2026-08-10T21:52:19+09:00 | `artifacts/g0/style-reference/ref_style_001_prompt_v002.md` | V1をStyle参照    | 2026-08-10に[公式Image Generationドキュメント](https://developers.openai.com/api/docs/guides/image-generation)を確認。Output利用はユーザーへ適用される契約・法令に従う | Modular Caravan、Monster、VFX、Stage、HUDを反映。Style承認待ち | Codex / User review pending |
