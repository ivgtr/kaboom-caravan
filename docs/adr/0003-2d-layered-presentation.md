# ADR 0003: 2Dレイヤー素材によるPresentation

- Status: Accepted
- Date: 2026-08-10

## 決定

MVPのPresentationに3Dモデルを使用しない。背景、地面、植生、車体、武器、Module装飾、敵、Projectile、VFXを独立した2D Raster素材として制作し、Canvas 2Dで重ねて描画する。

見た目はセル調の立体感を維持してよいが、実行時にThree.js、GLB、3D Animation、Lighting、3D Cameraを必要としない構成にする。

## レイヤー順

奥から手前へ、次の順で描画する。

1. 遠景Background
2. 中景Ruins / Hills
3. Road / Ground
4. Risk ZoneとFrontline表示
5. Player / Enemy Vehicle Base
6. WeaponとModule Attachment
7. Projectile / Muzzle Flash / Hit / Explosion / Smoke
8. 前景Grass / Flowers / Dust
9. React HUD

Simulationは描画方式を知らず、Presentation SnapshotとCombat Eventだけを渡す。UIとゲームルールの境界は従来どおり維持する。

## 素材方針

- ConceptとStyle Referenceは不透明な16:9画像でよい
- Vehicle、Weapon、Enemy、VFXは個別の透明PNGまたはWebPにする
- 透明素材は生成時に単色Chroma Key背景を使い、ローカル処理でAlphaへ変換する
- Runtime素材は表示解像度へ縮小・圧縮し、生成Masterとは分離する
- 車体、武器、ModuleはAttachment Point相当の2D Anchor座標で合成する
- 通常Animationは位置、回転、Scale、反動、点滅、Sprite Sheetで表現する
- 複雑なBone Animationと3D物理はMVP対象外とする

## 理由

横方向の固定カメラでは2D素材でも距離、敵種、弾、前線を十分に表現できる。素材の組み合わせで武装過剰な車体を作る目的にも、車体と武器を別Spriteにする方式が適している。

3D Asset Pipelineを外すことで、モデル生成後のTopology修正、UV、Rig、GLB最適化、Lighting差の調整を避け、G0で決めたStyleを画面へ直接反映しやすくする。

## 影響

- Three.js依存を削除し、Canvas 2D Rendererへ移行する
- グラフィック指示書の3D生成・GLB項目はMVPへ適用しない
- `assetId`は2D Sprite / Sprite Sheetの参照IDとして継続使用する
- 実アセット導入時にSprite Loader、Anchor定義、描画順、Object Pool相当の再利用を追加する
