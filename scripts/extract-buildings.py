"""Optional authoring helper. Usage: python scripts/extract-buildings.py map.png bounds.json"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

if len(sys.argv) != 3:
    raise SystemExit(__doc__)
image = Image.open(sys.argv[1]).convert('RGB')
labels, _ = ndimage.label(np.max(np.asarray(image), axis=2) < 95)
areas = np.bincount(labels.ravel())
locations = []
for label, slices in enumerate(ndimage.find_objects(labels), 1):
    if slices is None:
        continue
    y, x = slices
    width, height = x.stop - x.start, y.stop - y.start
    if not (9 <= areas[label] <= 1000 and min(width, height) >= 2
            and max(width, height) <= 60
            and areas[label] / (width * height) >= .5
            and max(width, height) / min(width, height) <= 7):
        continue
    locations.append({
        'x': round(x.start + width / 2, 1),
        'y': round(y.start + height / 2, 1),
        'bounds': [x.start, y.start, width, height]
    })
Path(sys.argv[2]).write_text(json.dumps({
    'width': image.width, 'height': image.height, 'candidates': locations
}, indent=2) + '\n')
print(f'Wrote {len(locations)} candidates. Inspect and remove false positives before use.')
