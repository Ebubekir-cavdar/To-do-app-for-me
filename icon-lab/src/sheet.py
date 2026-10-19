# Quick contact sheet for iteration: composite fg over bg, circle/squircle masks, small sizes on light/dark.
import sys
from PIL import Image, ImageDraw
import numpy as np
lab = 'C:/Users/PC/desktop/TO_DO_APP/icon-lab/'
concepts = sys.argv[1:] or ['a', 'b', 'c']
def squircle(size, n=4.0):
    y, x = np.mgrid[0:size, 0:size]
    u = (x + .5) / size * 2 - 1; v = (y + .5) / size * 2 - 1
    m = (np.abs(u) ** n + np.abs(v) ** n) <= 1
    return Image.fromarray((m * 255).astype('uint8'))
def adaptive(c, size, shape):
    bg = Image.open(lab + f'{c}-background.png').convert('RGBA'); fg = Image.open(lab + f'{c}-foreground.png').convert('RGBA')
    comp = Image.alpha_composite(bg, fg)
    k = 1024 * 18 / 108  # crop to visible 72dp
    comp = comp.crop((round(k), round(k), round(1024 - k), round(1024 - k))).resize((size * 4, size * 4), Image.LANCZOS)
    if shape == 'circle':
        m = Image.new('L', (size * 4, size * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    elif shape == 'squircle': m = squircle(size * 4)
    else: m = Image.new('L', (size * 4, size * 4), 255)
    comp.putalpha(Image.fromarray(np.minimum(np.array(comp.split()[3]), np.array(m))))
    return comp.resize((size, size), Image.LANCZOS)
W = 900; rows = []
sheet = Image.new('RGBA', (W, 330 * len(concepts)), (40, 40, 40, 255))
for i, c in enumerate(concepts):
    y0 = i * 330
    sheet.paste(Image.open(lab + f'{c}-icon-1024.png').convert('RGBA').resize((300, 300), Image.LANCZOS), (10, y0 + 10))
    sheet.alpha_composite(adaptive(c, 150, 'circle'), (320, y0 + 10))
    sheet.alpha_composite(adaptive(c, 150, 'squircle'), (480, y0 + 10))
    mono = Image.open(lab + f'{c}-monochrome.png').convert('RGBA').resize((150, 150), Image.LANCZOS)
    tile = Image.new('RGBA', (150, 150), (30, 50, 80, 255)); tile.alpha_composite(mono); sheet.paste(tile, (640, y0 + 10))
    for j, (col, sz) in enumerate([((235, 228, 215, 255), 48), ((20, 24, 30, 255), 48), ((235, 228, 215, 255), 72), ((20, 24, 30, 255), 72)]):
        x = 320 + j * 140
        sheet.paste(Image.new('RGBA', (130, 130), col), (x, y0 + 180))
        sheet.alpha_composite(adaptive(c, sz, 'squircle'), (x + (130 - sz) // 2, y0 + 180 + (130 - sz) // 2))
sheet.save(lab + 'src/tmp/sheet.png')
print('ok')
