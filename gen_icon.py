from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new("RGB", (size, size), (0, 0, 0))
    d = ImageDraw.Draw(img)
    unit = size // 16  # 16x16 pixel-art grid

    def block(x, y, w, h, color):
        d.rectangle([x*unit, y*unit, (x+w)*unit - 1, (y+h)*unit - 1], fill=color)

    # background
    block(0, 0, 16, 16, (30, 26, 20))
    # parchment paper
    parchment = (222, 197, 148)
    parchment_dark = (198, 170, 120)
    block(1, 1, 14, 14, parchment)
    # frame - wood/leather border like a minecraft map item
    frame = (92, 61, 33)
    for i in range(1, 15):
        block(i, 1, 1, 1, frame)
        block(i, 14, 1, 1, frame)
        block(1, i, 1, 1, frame)
        block(14, i, 1, 1, frame)
    block(1, 1, 1, 1, frame); block(14, 1, 1, 1, frame)
    block(1, 14, 1, 1, frame); block(14, 14, 1, 1, frame)

    # a couple of terrain blotches (green land, blue water) for map feel
    block(3, 3, 3, 2, (94, 133, 66))
    block(9, 4, 4, 3, (94, 133, 66))
    block(3, 9, 5, 3, (94, 133, 66))
    block(9, 9, 3, 2, (70, 110, 190))
    block(10, 8, 2, 2, (70, 110, 190))

    # red position pointer (arrow) in center
    red = (196, 42, 34)
    block(7, 6, 2, 2, red)
    block(7, 8, 1, 1, red)
    block(8, 8, 1, 1, (120, 20, 16))

    img = img.resize((size, size), Image.NEAREST)
    img.save(path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
print("done")
