from pathlib import Path
import hashlib
import json

patches = json.loads(r'''
{
  "README.md": {
    "before": "51b8042c180108a012467cd4a8d0059dbd2dea38cf1d82f43e6c029010edab8f",
    "after": "6d3ac82a61718130d52d4084ed3d554371a480c8d1179bfaa26939a3d96bbc5b",
    "ops": [
      [18, 18, "## 前線突破：攻めて、好機を選ぶ\n\n25mより前で敵に命中させると突破ゲージが増加します。25〜44mでは+6、45〜64mでは+9、65m以降では+12（命中による加算は0.75秒に1回まで）。パリィ成功はどの位置でも+25。空撃ち・待機では増えず、散弾や範囲攻撃の同時命中でも加算は1回です。\n\n100%になったら `E` または「前線突破」ボタンを**1回押して**発動。敵弾を一掃し、敵を押し返して攻撃予備動作を中断、前線を8回復します。両武器の熱・Cooldownも解消し、4秒間は連射速度が1.75倍、排熱速度が2.5倍になります。**弾薬・エネルギーは通常どおり消費し、無敵にもなりません。** ボスへの押し戻しは小さくなります。\n\n押し込むために使うか、過熱や敵弾への切り返しに残すかを選んでください。未使用ゲージは次戦へ持ち越せますが、発動中は再チャージできず、強化時間は次戦へ持ち越しません。敵も敵弾もない間は発動しません。キーを押したまま満タンになっても自動発動せず、改めて押す必要があります。一時停止・武器箱選択中は強化時間も停止します。\n\n"],
      [26, 26, "- 前線での命中・パリィから獲得し、任意発動する前線突破\n"]
    ]
  },
  "src/app/GameApp.tsx": {
    "before": "f14eaa2b1592e6ebd86843d5dc689f28e08ad79ec29d6a498c1bd0280c7e1512",
    "after": "a02f5e4b1c4a05b2224a5d65bcb8d702aa888f8b4f18d15122b95de3dd617bea",
    "ops": [
      [12, 12, "import { BreakthroughControl } from './BreakthroughControl';\nimport { hasBreakthroughThreat } from '../game/simulation/breakthrough';\nimport { createEnemy } from '../game/combat/createEnemy';\nimport type { BreakthroughState } from '../game/simulation/types';\n"],
      [80, 80, "  breakthrough: BreakthroughState;\n  breakthroughThreat: boolean;\n"],
      [131, 131, "    breakthrough: state.breakthrough,\n    breakthroughThreat: hasBreakthroughThreat(state),\n"],
      [184, 184, "  if (parameters.has('debug') && parameters.has('breakthroughPreview')) {\n    const charge =\n      parameters.get('breakthroughPreview') === 'charging' ? 94 : 100;\n    session.combat.breakthrough.charge = charge;\n    session.run.breakthroughCharge = charge;\n    session.combat.player.position = 40;\n    session.combat.player.previousPosition = 40;\n    if (charge === 100) {\n      session.combat.player.weaponHeat.primary = { heat: 90, overheated: true };\n    }\n    session.combat.enemies = [createEnemy('heavy', 'preview-heavy', 62)];\n    return session;\n  }\n"],
      [338, 338, "            session.combat.events.find(\n              ({ type }) =>\n                type === 'breakthrough-activated' ||\n                type === 'breakthrough-ready',\n            ) ??\n"],
      [545, 545, "            <BreakthroughControl\n              state={hud.breakthrough}\n              position={hud.position}\n              hasThreat={hud.breakthroughThreat}\n              onActivate={() => input.requestBreakthrough()}\n            />\n"],
      [1345, 1345, "    case 'breakthrough-ready':\n      return '突破準備完了！ Eで発動';\n    case 'breakthrough-activated':\n      return '前線突破！ 4秒間の反撃チャンス';\n"]
    ]
  },
  "src/app/PauseMenu.tsx": {
    "before": "d4b708af0af57227478be78dc46de471680ca9ba0134e89e70d586bcfbc1bcee",
    "after": "e56f4a5697f7b0d96d38c40d7d28ee5de6c033d775b2445ba4b647770944ed90",
    "ops": [
      [73, 73, "            <dt>前線突破</dt>\n            <dd>\n              <kbd>E</kbd> / ボタンをタップ\n            </dd>\n          </div>\n          <div>\n"],
      [80, 81, "          25mより前での命中やパリィで突破ゲージを蓄積。満タンでEを押すと敵弾一掃・排熱と4秒の連射強化。弾薬は消費し、無敵にはなりません。\n          未使用ゲージは次の戦闘へ持ち越せます。\n          移動・射撃のタッチ操作は画面左右のボタンを長押し。\n"]
    ]
  },
  "src/audio/AudioDirector.ts": {
    "before": "d980604d471ac69b66117ff16b4c16980a7deb1e3375586f091753449c0e395a",
    "after": "979177bfc08116fed942efa687d0d5251e98c1e97cac74d09468a771b00c69ad",
    "ops": [[72, 72, "        case 'breakthrough-ready':\n          this.playUiConfirm();\n          break;\n        case 'breakthrough-activated':\n          this.voice(100, 0.35, {\n            type: 'triangle',\n            endFrequency: 420,\n            volume: 0.06,\n          });\n          this.voice(440, 0.28, {\n            type: 'sine',\n            endFrequency: 660,\n            delay: 0.1,\n            volume: 0.035,\n          });\n          break;\n"]]
  },
  "src/game/session/GameSession.ts": {
    "before": "8aca490b65e7d06a5a1ba6e657bca454cde874ad8988ed53d2ea9fddc72a7531",
    "after": "98f84d42eed1abf6a15ba3d336e2f3b1da445ea7744adac930d60723f0606a8c",
    "ops": [
      [61, 61, "  breakthroughCharge: number;\n"],
      [94, 94, "  combat.breakthrough.charge = run.breakthroughCharge;\n"],
      [125, 125, "    breakthroughCharge: 0,\n"],
      [169, 169, "    breakthroughCharge: combat.breakthrough.charge,\n"]
    ]
  },
  "src/game/session/mvpRun.test.ts": {
    "before": "33ebe585549ea5227387839185237fe8770d3d9713cfb538657272a05ee80787",
    "after": "86b794fe3d6202031be7d47189eae2d02dfaec7c4052083a194828cdc5d7fcd7",
    "ops": [
      [256, 256, "    activateBreakthrough: false,\n"],
      [317, 318, "function simulateMvpRun(\n  seed: number,\n  useBreakthrough = false,\n): {\n"],
      [320, 320, "  breakthroughs: number;\n"],
      [326, 326, "  let breakthroughs = 0;\n"],
      [332, 333, "        {\n          ...combatCommand(session),\n          activateBreakthrough:\n            useBreakthrough &&\n            session.combat.breakthrough.charge === 100 &&\n            session.combat.enemies.length > 0,\n        },\n"],
      [350, 350, "        if (event.type === 'breakthrough-activated') breakthroughs += 1;\n"],
      [448, 449, "  return { session, metrics, breakthroughs };\n"],
      [504, 504, "\ndescribe('fixed-seed runs with frontline breakthrough', () => {\n  it.each([1, 42, 2026])(\n    'completes and replays all ten encounters with earned activations for seed %s',\n    (seed) => {\n      const run = simulateMvpRun(seed, true);\n      expect(run.session.phase).toBe('victory');\n      expect(run.metrics.encountersCompleted).toBe(10);\n      expect(run.breakthroughs).toBeGreaterThan(0);\n      expect(run.session.combat.breakthrough.charge).toBeGreaterThanOrEqual(0);\n      expect(run.session.combat.breakthrough.charge).toBeLessThanOrEqual(100);\n      expect(simulateMvpRun(seed, true)).toEqual(run);\n    },\n  );\n});\n"]
    ]
  },
  "src/game/simulation/createSimulation.ts": {
    "before": "bfa6ef9bc634e51f84397ba55112f930c0cb8421a46258f0f650e93e550dbf44",
    "after": "96a8d05fd2bd823e9fb43bd21e4325d3ce4b9b0bc78b0c76b2a7f7f30c13d8f2",
    "ops": [[44, 44, "    breakthrough: { charge: 0, remainingSeconds: 0, hitChargeCooldown: 0 },\n"]]
  },
  "src/game/simulation/stepSimulation.ts": {
    "before": "a5ea87f196c6b007f18415cca6398a554a22e5edb9a45af65122cb770da03e85",
    "after": "0f94730a5c39efb52454905ad024ca3f66873d315a75be77334ea226a379b0f0",
    "ops": [
      [34, 34, "import {\n  BREAKTHROUGH,\n  prepareBreakthrough,\n  earnBreakthroughCharge,\n} from './breakthrough';\n"],
      [466, 467, "  const prepared = prepareBreakthrough(\n    state,\n    command.activateBreakthrough,\n    deltaSeconds,\n  );\n  state = prepared.state;\n  const events: CombatEvent[] = [...prepared.events];\n  const breakingThrough = state.breakthrough.remainingSeconds > 0;\n  const weaponDelta =\n    deltaSeconds * (breakingThrough ? BREAKTHROUGH.fireRateMultiplier : 1);\n"],
      [527, 531, "  let primaryCooldown = Math.max(0, state.player.primaryCooldown - weaponDelta);\n"],
      [533, 534, "    state.player.secondaryCooldown - weaponDelta,\n"],
      [546, 547, "    playerStats.coolingPerSecond *\n      (breakingThrough ? BREAKTHROUGH.coolingMultiplier : 1),\n"],
      [988, 988, "  const earned = earnBreakthroughCharge(\n    state.breakthrough,\n    events,\n    playerPosition,\n  );\n  events.push(...earned.events);\n\n"],
      [993, 993, "    breakthrough: earned.breakthrough,\n"]
    ]
  },
  "src/game/simulation/types.ts": {
    "before": "5b6cb9c9387f88c2599557233ccbba8d83a54ac8eeda2d348dffa43fc016221a",
    "after": "068017e6ef33bf05a7265a6a487e52a84160c34c45cbf2ba830f98b30a71626b",
    "ops": [
      [35, 35, "  activateBreakthrough: boolean;\n"],
      [115, 115, "export interface BreakthroughState {\n  charge: number;\n  remainingSeconds: number;\n  hitChargeCooldown: number;\n}\n\n"],
      [149, 149, "  | { type: 'breakthrough-ready' }\n  | { type: 'breakthrough-activated' }\n"],
      [224, 224, "  breakthrough: BreakthroughState;\n"],
      [240, 240, "  activateBreakthrough: false,\n"]
    ]
  },
  "src/input/CombatPauseController.test.ts": {
    "before": "6c88471fb3bfa9426ee2d58e9546abde266f99aaa89862e4264318f0e69682c1",
    "after": "87d1710aad712ec6cea9082033d82fdd8db053c55d9a23ac521e3432a1867429",
    "ops": [[165, 165, "        activateBreakthrough: false,\n"]]
  },
  "src/input/InputManager.test.ts": {
    "before": "aa114ec6e86b025f9ec9c25c802532111ca3157c9c2b19f88e5474c25c856ee6",
    "after": "b579aed39f78041dd818bad45e4d3702401fdcc10ae70120c1c51d4a9a1607e0",
    "ops": [[120, 120, "  it('buffers E for one fixed step and never repeats a held activation', () => {\n    const press = (repeat = false) =>\n      window.dispatchEvent(\n        new KeyboardEvent('keydown', { code: 'KeyE', repeat }),\n      );\n    press();\n    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));\n    expect(input.readCommand().activateBreakthrough).toBe(true);\n    expect(input.readCommand().activateBreakthrough).toBe(false);\n    press();\n    expect(input.readCommand().activateBreakthrough).toBe(true);\n    press(true);\n    press();\n    expect(input.readCommand().activateBreakthrough).toBe(false);\n  });\n\n  it('buffers button taps but discards them on pause, blur and menu transitions', () => {\n    input.requestBreakthrough();\n    expect(input.readCommand().activateBreakthrough).toBe(true);\n    input.requestBreakthrough();\n    window.dispatchEvent(new Event('blur'));\n    expect(input.readCommand().activateBreakthrough).toBe(false);\n    input.requestBreakthrough();\n    input.setContext('menu');\n    input.requestBreakthrough();\n    input.setContext('combat');\n    expect(input.readCommand().activateBreakthrough).toBe(false);\n  });\n\n  it('does not steal E from shortcuts, text fields or IME composition', () => {\n    for (const options of [\n      { altKey: true },\n      { ctrlKey: true },\n      { metaKey: true },\n      { isComposing: true },\n    ]) {\n      window.dispatchEvent(\n        new KeyboardEvent('keydown', { code: 'KeyE', ...options }),\n      );\n      expect(input.readCommand().activateBreakthrough).toBe(false);\n    }\n    const field = document.createElement('input');\n    document.body.append(field);\n    field.dispatchEvent(\n      new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }),\n    );\n    expect(input.readCommand().activateBreakthrough).toBe(false);\n    field.remove();\n  });\n\n"]]
  },
  "src/input/InputManager.ts": {
    "before": "5e8f3ccd2be3033a79954d3084a9dfbc91a695f84edadbac00025db6f058dd1e",
    "after": "de3f4dfbf6108f11de3d909609196f9f5569ac3b20f4848c12edf10ac3b41303",
    "ops": [
      [36, 36, "  private breakthroughPending = false;\n"],
      [70, 70, "    this.breakthroughPending = false;\n"],
      [78, 78, "  }\n\n  requestBreakthrough(): void {\n    if (this.context === 'combat') this.breakthroughPending = true;\n"],
      [108, 108, "      activateBreakthrough: this.breakthroughPending,\n"],
      [109, 109, "    this.breakthroughPending = false;\n"],
      [116, 116, "    }\n    if (event.code === 'KeyE') {\n      if (\n        event.altKey ||\n        event.ctrlKey ||\n        event.metaKey ||\n        event.isComposing ||\n        isTextEntry(event)\n      )\n        return;\n      event.preventDefault();\n      if (!event.repeat && !this.pressed.has(event.code))\n        this.requestBreakthrough();\n"],
      [160, 160, "  activateBreakthrough: false,\n"]
    ]
  },
  "src/render/GameRenderer.ts": {
    "before": "c99affd75830a08bfffcd1b19ec126314d2dc3a91b53d75edabda7b6364941c0",
    "after": "f71c9e713e4b5d468e5cb1cdcab8884fbaef319dc8a09bfd4b427bb0a975bdcd",
    "ops": [
      [0, 0, "import { drawBreakthroughField } from './breakthroughField';\n"],
      [266, 266, "    drawBreakthroughField(\n      this.context,\n      state,\n      (position) => this.worldToScreen(position),\n      this.groundY,\n      this.reducedMotion,\n    );\n"]
    ]
  }
}
''')
for name, patch in patches.items():
    path = Path(name)
    text = path.read_text()
    assert hashlib.sha256(text.encode()).hexdigest() == patch['before'], name
    lines = text.splitlines(keepends=True)
    for start, end, replacement in reversed(patch['ops']):
        lines[start:end] = [replacement]
    text = ''.join(lines)
    assert hashlib.sha256(text.encode()).hexdigest() == patch['after'], name
    path.write_text(text)
