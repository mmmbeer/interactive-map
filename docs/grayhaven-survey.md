# Grayhaven survey

Grayhaven uses a fantasy interpretation of the supplied street plan. The displayed
3,548 × 1,774 image is an interpolated version of the 1,774 × 887 source. Its
extra pixels do not reveal new buildings. Map coordinates remain in the original
1,774 × 887 coordinate grid.

The survey records approximate building footprints, routes, fields and a bay.
Building functions and names are fictional. Outlined buildings, trees and other
small marks can look alike at the source resolution. Some buildings may be missed
and some mapped locations may not represent buildings. The survey is not a verified
inventory of every structure.

The October 2026 geometry review traced 15 field boundaries around visible parcels
and corrected four roof markers that had been placed on tree crowns. Existing IDs
were retained. These corrections cover selected features and do not represent a
manual review of every building marker.

The optional `scripts/grayhaven/expand-survey.py` helper proposes additional
candidates from the source image. It preserves existing IDs and excludes the tree
crowns identified during review. Inspect proposed footprints and their surrounding
features before publishing; threshold-based extraction cannot distinguish every
roof from a tree or courtyard. The helper requires Python, Pillow, NumPy and SciPy.
