import json, sys
fr = json.load(open('frames.json'))
out = ['ffconcat version 1.0']
for i, f in enumerate(fr):
    dur = (fr[i+1]['t'] - f['t']) if i + 1 < len(fr) else 5.0
    out.append(f"file '{f['file']}'")
    out.append(f"duration {dur:.4f}")
out.append(f"file '{fr[-1]['file']}'")
open('frames.txt', 'w').write('\n'.join(out))
print('total', fr[-1]['t'] - fr[0]['t'])
