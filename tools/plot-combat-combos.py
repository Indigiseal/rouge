from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path('docs/balance/2026-10-28'); rows=json.loads((root/'controlled-damage.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False})
fig,ax=plt.subplots(figsize=(12,7.6),dpi=180);fig.patch.set_facecolor('#faf8f2');ax.set_facecolor('#faf8f2')
y=list(range(len(rows))); primary=[r['primary'] for r in rows];secondary=[r['total']-r['primary'] for r in rows]
ax.barh(y,primary,color='#355e70',label='Selected target')
ax.barh(y,secondary,left=primary,color='#db9860',label='Other enemies, including hidden fire targets')
for i,r in enumerate(rows):ax.text(r['total']+1,i,f"{r['total']:.0f} total · {r['hits']} target" + ('s' if r['hits'] != 1 else ''),va='center',fontsize=10)
ax.set_yticks(y,[r['label'] for r in rows]);ax.invert_yaxis();ax.set(xlabel='Immediate HP removed by one weapon action',xlim=(0,145));ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True)
ax.legend(loc='upper right',frameon=False,fontsize=9)
fig.text(.045,.95,'Why the printed weapon damage misses most of a strong build',fontsize=18,weight='bold',color='#243c35')
fig.text(.045,.90,'All weapons start at 8 damage. Secondary sword / axe hits can trigger gems again.',fontsize=12,color='#5b6059')
fig.text(.045,.045,'Controlled test: 3×3 dense board, two enemies hidden, plus one distant enemy; HP high enough to avoid overkill.\nFirst seven cases: floor 1, no amulets or Forge. Last two: floor 31, 3 gems and listed amulets; lightning adds Conductive.\nNo random crit/evade procs. This demonstrates build potential on this layout, not an average run or an upper bound.',fontsize=9,color='#63675d',linespacing=1.6)
fig.subplots_adjust(left=.29,right=.97,top=.84,bottom=.19)
fig.savefig(root/'player-combo-damage.png',facecolor=fig.get_facecolor());fig.savefig(root/'player-combo-damage.svg',facecolor=fig.get_facecolor())
