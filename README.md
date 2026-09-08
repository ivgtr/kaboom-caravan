# Kaboom Caravan

![武装したキャラバンとモンスター軍団の戦い](docs/assets/key-visual.png)

> その火力で、前線を押し返せ。

かわいい装甲車へ過剰な火力を積み、敵との距離と前線を管理して戦うブラウザ向けローグライクです。戦闘後に装備を選び、同じ武器を重ねて強化しながら最終ボスを目指します。

[ブラウザで遊ぶ](https://ivgtr.github.io/kaboom-caravan/)

## 操作

`A` / `←` で後退、`D` / `→` で前進、`Space` で主武器、`C` で副武器、`F` で迎撃パリィ、左`Shift`で急加速。パリィは短い受付時間に敵の接触攻撃・弾を防ぎ、反撃・排熱・即時Cooldown回復を行います。タッチ操作は画面左右のボタンを長押しします。

戦闘中は`Esc` / `P`または「一時停止」ボタンで停止し、操作ガイドを確認できます。タブやウィンドウを離れても自動で停止します。「戦闘を再開」または`Esc` / `P`で明示的に再開するまで、戦闘・タイム計測は進みません。再開時は移動・射撃などを押し直してください。音声設定は停止前の状態を維持します。一時停止はセーブではなく、再読み込みすると進行は失われます。

報酬画面は`A` / `D`または`←` / `→`でカード移動、`Space` / `Enter`で決定、`1`〜`3`で直接選択できます。武器の装着先選択では`Esc`で戻れます。

## Post-MVP Alpha

- 3種類の初期Loadoutと、ラン実績によるExplosive Loadout解禁
- 同一Weaponの再取得によるLv.1〜3強化と固有挙動の変化
- Monsterから落ち、Caravanへ吸着するTreasureとReward Rarity／Reroll
- Battle 4・7・10前のHighway／Elite／Repair／Salvageルート選択
- Best Time、直近Run、累計Treasureを保存する軽量Meta Progression
- 射撃・命中・Parry・Treasure・決着のAudioとMute切替
- 戦闘の手動／自動一時停止と、停止中に読める操作ガイド

## 開発

Node.js 24以降を使用します。

```bash
npm ci
npm run dev
```

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```
