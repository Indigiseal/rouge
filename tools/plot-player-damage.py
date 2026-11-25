from pathlib import Path
import json,csv,math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path('docs/balance/2026-10-28')
data=[json.loads((root/f'effects-fixed-{k}.json').read_text()) for k in ['max','strong']]
enemies=json.loads((root/'enemy-health.json').read_text())['rows']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(2,2,figsize=(14,8.5),dpi=170,gridspec_kw={'height_ratios':[4,1]},sharex='col',sharey='row')
fig.patch.set_facecolor('#faf8f2')
exports=[]
for col,(d,title) in enumerate(zip(data,['Max statues · normal starting amulet','Max statues + strong starting amulets'])):
 ax=axes[0,col];counts=axes[1,col];ax.set_facecolor('#faf8f2');counts.set_facecolor('#faf8f2')
 rows=[r for r in d['playerDamageByFloor'] if r['floor']%15]
 for a in [ax,counts]:
  for lo,hi,c in [(0.5,15.5,'#e6eddf'),(15.5,30.5,'#f3e3d3'),(30.5,45.5,'#e5e6f0')]:a.axvspan(lo,hi,color=c,alpha=.45,zorder=0)
  a.grid(axis='y',alpha=.16);a.set_axisbelow(True);a.set_xlim(.5,45)
 ax.plot([r['floor'] for r in enemies],[r['mean'] for r in enemies],color='#334d47',lw=2,label='One enemy’s average starting HP')
 for key,color,label in [('plain','#648296','Ungemmed: total immediate damage'),('gemmed','#cc713b','Gemmed: total immediate damage')]:
  x=[r['floor'] for r in rows];v=[r[key]['mean'] if r[key] and r[key]['actions']>=30 else math.nan for r in rows]
  ax.plot(x,v,color=color,lw=2,marker='o',ms=2.6,label=label)
  if key=='gemmed':
   ax.fill_between(x,[r[key]['p10'] if r[key] and r[key]['actions']>=30 else math.nan for r in rows],[r[key]['p90'] if r[key] and r[key]['actions']>=30 else math.nan for r in rows],color=color,alpha=.12,label='Gemmed actions: 10th–90th percentile')
  counts.plot(x,[r[key]['actions'] if r[key] else 0 for r in rows],color=color,lw=1.4)
 for r in rows:
  for kind in ['all','plain','gemmed']:
   if r[kind]:exports.append({'setup':['max','strong'][col],'floor':r['floor'],'kind':kind,**r[kind]})
 ax.set_title(title,loc='left',fontsize=12,weight='bold',pad=14)
 ax.set_ylim(bottom=0)
 ax.legend(loc='upper left',fontsize=8,frameon=False)
 counts.set_yscale('symlog',linthresh=30);counts.set_yticks([0,30,300,3000],[0,30,300,3000]);counts.set_xlabel('Dungeon floor');counts.set_xticks([1,10,15,20,25,30,35,40,45])
axes[0,0].set_ylabel('HP / immediate HP removed per weapon action')
axes[1,0].set_ylabel('Actions\n(log scale)',fontsize=9)
fig.text(.07,.96,'What the player actually deals as the run progresses',fontsize=20,weight='bold',color='#243c35')
fig.text(.07,.915,'Measured with working fire splash, lightning chains, sword cleave and axe cross attacks · 500 runs per setup',fontsize=11,color='#5c6259')
fig.text(.07,.035,'Immediate damage includes main/off-hand hits, gems, sigils and collateral damage across enemies; overkill is capped. Poison’s later ticks are excluded.\nBoss floors omitted. Actual inventories and amulets vary; gemmed versus ungemmed are observational groups, not matched builds. Late floors show survivors only.\nLines omit groups with fewer than 30 actions. Enemy HP weights 10 locations equally; total board damage is NOT single-target damage or a direct hits-to-kill measure.',fontsize=8.8,color='#63675d',linespacing=1.55)
fig.subplots_adjust(left=.07,right=.98,top=.855,bottom=.18,wspace=.12,hspace=.1)
fig.savefig(root/'player-damage-growth.png',facecolor=fig.get_facecolor());fig.savefig(root/'player-damage-growth.svg',facecolor=fig.get_facecolor())
with (root/'player-damage-growth.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(exports[0]));w.writeheader();w.writerows(exports)
print([(d['outcome'],sum(r['all']['actions'] for r in d['playerDamageByFloor'])) for d in data])
