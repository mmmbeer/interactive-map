#!/usr/bin/env python3
"""Encode an existing map as pixel-exact WebP without changing its coordinate grid."""
import argparse
from pathlib import Path
from PIL import Image, ImageChops, ImageOps

def prepare(source, destination, expected_size=None):
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert('RGBA' if 'A' in opened.getbands() else 'RGB')
    if expected_size and image.size != tuple(expected_size):
        raise ValueError(f'Expected {tuple(expected_size)} pixels, got {image.size}. Scale map geometry before changing dimensions.')
    destination = Path(destination)
    if destination.suffix.lower() != '.webp':
        raise ValueError('The destination must use the .webp extension.')
    if Path(source).resolve() == destination.resolve():
        raise ValueError('Keep the original source in a separate file.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, format='WEBP', lossless=True, method=6, exact=True)
    with Image.open(destination) as encoded:
        if encoded.size != image.size or any(high for low, high in ImageChops.difference(image, encoded.convert(image.mode)).getextrema()):
            raise RuntimeError('Lossless pixel verification failed.')
    print(f'{destination}: {image.width} x {image.height}, pixel-exact lossless WebP.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('destination')
    parser.add_argument('--expected-size', nargs=2, type=int, metavar=('WIDTH', 'HEIGHT'))
    args = parser.parse_args()
    prepare(args.source, args.destination, args.expected_size)
