"""Compatibility entrypoint for the full, source-based Grayhaven rebuild.

The old additive threshold pass is retired. It could reintroduce rejected trees
and did not retrace streets or geography. See docs/grayhaven-survey.md.
"""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('rebuild.py')), run_name='__main__')
