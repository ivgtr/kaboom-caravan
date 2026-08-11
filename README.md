# Kaboom Caravan

![武装したキャラバンとモンスター軍団の戦い](docs/assets/key-visual.png)

> その火力で、前線を押し返せ。

かわいい装甲車へ過剰な火力を積み、敵との距離と前線を管理して戦うブラウザ向けローグライクです。戦闘後に装備を選び、同じ武器を重ねて強化しながら最終ボスを目指します。

[ブラウザで遊ぶ](https://ivgtr.github.io/kaboom-caravan/)

## 操作

`A` / `←` で後退、`D` / `→` で前進、`Space` で主武器、`E` / `Shift` で副武器、`Q` で迎撃パリィ。パリィは短い受付時間に敵の接触攻撃・弾を防ぎ、反撃・排熱・即時Cooldown回復を行います。

報酬画面は`A` / `D`または`←` / `→`でカード移動、`Space`で決定、`1`〜`3`で直接選択できます。

## Post-MVP Alpha

- 3種類の初期Loadoutと、ラン実績によるExplosive Loadout解禁
- 同一Weaponの再取得によるLv.1〜3強化と固有挙動の変化
- Monsterから落ち、Caravanへ吸着するTreasureとReward Rarity／Reroll
- Battle 4・7・10前のHighway／Elite／Repair／Salvageルート選択
- Best Time、直近Run、累計Treasureを保存する軽量Meta Progression
- 射撃・命中・Parry・Treasure・決着のAudioとMute切替

## 開発

```bash
npm install
npm run dev
```
