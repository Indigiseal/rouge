# Revised progression check

500 runs per setup, seed 777. Comparison against the original curve in max.json and strong.json.

| Setup | Original wins | Revised wins | Original mean floor | Revised mean floor |
|---|---:|---:|---:|---:|
| Max statues | 1.0% | 1.0% | 25.00 | 26.15 |
| Max statues + strong starting amulets | 4.4% | 5.6% | 29.09 | 31.22 |

Intent: ease floors 20–25, then continue health growth every two floors through Act 3. This redistributes difficulty and is not intended as a blanket win-rate increase.

Validation: 30 location/act combinations, 23 sigil combat parity cases, sim armor/mace and story/enemy coverage suites pass. The health bands remain nondecreasing, with no health step above 20% after floor 16.

[Previous versus revised enemy health](enemy-health-revised.png). Boss-specific health rules are separate.
