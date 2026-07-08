from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "posters"
OUT.mkdir(parents=True, exist_ok=True)

SCREENSHOT = Path(r"C:\Users\tuanh\Downloads\z7974599972302_d1eb514af54ab2db39173e5c2295bb70.jpg")
MASCOT_SRC = Path(r"C:\Users\tuanh\Downloads\698978944_122134205955071837_557855614849580861_n.jpg")
POSTER_OUT = OUT / "poster-trang-phuc-moi.png"


def font(size, bold=False, italic=False):
    candidates = []
    if bold:
        candidates += [
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\calibrib.ttf",
        ]
    elif italic:
        candidates += [
            r"C:\Windows\Fonts\segoesc.ttf",
            r"C:\Windows\Fonts\ariali.ttf",
        ]
    else:
        candidates += [
            r"C:\Windows\Fonts\arial.ttf",
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\calibri.ttf",
        ]
    for item in candidates:
        if Path(item).exists():
            return ImageFont.truetype(item, size)
    return ImageFont.load_default()


def rounded_rect_mask(size, radius):
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def paste_rounded(base, img, xy, radius):
    mask = rounded_rect_mask(img.size, radius)
    base.paste(img, xy, mask)


def cover(img, size):
    w, h = img.size
    tw, th = size
    scale = max(tw / w, th / h)
    resized = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    left = (resized.width - tw) // 2
    top = (resized.height - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def contain(img, size, bg=(255, 255, 255, 0)):
    w, h = img.size
    tw, th = size
    scale = min(tw / w, th / h)
    resized = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", size, bg)
    canvas.paste(resized, ((tw - resized.width) // 2, (th - resized.height) // 2))
    return canvas


def shadow(size, radius, blur=24, opacity=70):
    layer = Image.new("RGBA", (size[0] + blur * 4, size[1] + blur * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((blur * 2, blur * 2, blur * 2 + size[0], blur * 2 + size[1]), radius, fill=(95, 0, 12, opacity))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def draw_center(draw, xy, text, fnt, fill, stroke=0, stroke_fill=None):
    x, y = xy
    box = draw.textbbox((0, 0), text, font=fnt, stroke_width=stroke)
    draw.text((x - (box[2] - box[0]) / 2, y), text, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)


def draw_wave(draw, y0, amp, color, width=2, phase=0):
    points = []
    for x in range(-40, 1120, 8):
        y = y0 + math.sin((x + phase) / 78) * amp
        points.append((x, y))
    draw.line(points, fill=color, width=width)


W, H = 1080, 1536
img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
draw = ImageDraw.Draw(img)

# Soft branded background.
for r, a in [(380, 24), (540, 18), (720, 12)]:
    draw.ellipse((-220, H - r + 120, -220 + r, H + 120), fill=(232, 7, 28, a))
    draw.ellipse((W - r + 160, 580, W + 160, 580 + r), fill=(232, 7, 28, a))
draw.rectangle((0, 1322, W, H), fill=(218, 0, 24, 255))
draw.arc((-100, 1180, 1180, 1738), 190, 350, fill=(255, 255, 255, 255), width=24)

for i in range(9):
    draw_wave(draw, 520 + i * 14, 34, (150, 22, 44, 30), width=2, phase=i * 20)
for i in range(6):
    draw_wave(draw, 1015 + i * 15, 28, (150, 22, 44, 28), width=2, phase=140 + i * 18)

# Simple dotted ornaments.
for ox, oy in [(56, 128), (914, 1260), (58, 1334)]:
    for row in range(6):
        for col in range(6):
            draw.ellipse((ox + col * 14, oy + row * 14, ox + col * 14 + 4, oy + row * 14 + 4), fill=(220, 0, 24, 95))

# Logo lockup recreated as text for crisp output.
draw_center(draw, (W // 2, 48), "mindX", font(58, bold=True), (30, 30, 34), stroke=0)
draw.text((W // 2 + 69, 50), "X", font=font(59, bold=True), fill=(214, 0, 25))
draw_center(draw, (W // 2, 112), "Technology School", font(24), (36, 36, 40))

pill = (338, 178, 742, 232)
draw.rounded_rectangle(pill, radius=27, fill=(229, 0, 27))
draw_center(draw, (W // 2, 190), "TPS TRAINING & LAUNCHING", font(28, bold=True), (255, 255, 255))

title = "TRANG PHỤC MỚI"
draw_center(draw, (W // 2, 254), title, font(67, bold=True), (255, 255, 255), stroke=8, stroke_fill=(161, 0, 22))
draw_center(draw, (W // 2, 254), title, font(67, bold=True), (224, 0, 26), stroke=2, stroke_fill=(255, 255, 255))
draw_center(draw, (W // 2, 347), "Giao diện đổi trang phục Dodoo trên Teaching Portal System", font(29), (30, 30, 34))

# Phone mockup.
phone_xy = (132, 440)
phone_size = (816, 916)
img.alpha_composite(shadow(phone_size, 80, blur=22, opacity=110), (phone_xy[0] - 44, phone_xy[1] - 32))
draw.rounded_rectangle((*phone_xy, phone_xy[0] + phone_size[0], phone_xy[1] + phone_size[1]), radius=88, fill=(12, 12, 14))
draw.rounded_rectangle((phone_xy[0] + 17, phone_xy[1] + 17, phone_xy[0] + phone_size[0] - 17, phone_xy[1] + phone_size[1] - 17), radius=72, fill=(255, 255, 255))
screen = (phone_xy[0] + 38, phone_xy[1] + 44, phone_xy[0] + phone_size[0] - 38, phone_xy[1] + phone_size[1] - 38)
draw.rounded_rectangle(screen, radius=50, fill=(255, 255, 255))

sx, sy, sr, sb = screen
draw.text((sx + 28, sy + 40), "Teaching Portal System", font=font(24), fill=(24, 24, 28))
draw.rounded_rectangle((sx + 312, sy + 30, sx + 472, sy + 78), radius=24, fill=(34, 34, 36))
draw.ellipse((sx + 428, sy + 40, sx + 458, sy + 70), fill=(52, 52, 54))
draw.text((sr - 190, sy + 41), "▮▮▮", font=font(21, bold=True), fill=(22, 22, 24))
draw.arc((sr - 128, sy + 42, sr - 88, sy + 70), 210, 330, fill=(22, 22, 24), width=3)
draw.rounded_rectangle((sr - 74, sy + 42, sr - 22, sy + 67), radius=5, outline=(22, 22, 24), width=2, fill=(35, 199, 78))
draw.rectangle((sr - 20, sy + 49, sr - 14, sy + 60), fill=(22, 22, 24))

draw_center(draw, (W // 2, sy + 118), "MẶC GÌ HÔM NAY?", font(35, bold=True), (18, 18, 22))
draw.rounded_rectangle((sx + 170, sy + 170, sr - 170, sy + 216), radius=23, fill=(253, 234, 237), outline=(244, 184, 192), width=2)
draw_center(draw, (W // 2, sy + 180), "Trang phục Dodoo", font(22, bold=True), (178, 0, 26))

screenshot = Image.open(SCREENSHOT).convert("RGBA")
screen_card = cover(screenshot, (656, 515))
card_xy = (sx + 42, sy + 240)
img.alpha_composite(shadow((656, 515), 34, blur=15, opacity=50), (card_xy[0] - 30, card_xy[1] - 26))
paste_rounded(img, screen_card, card_xy, 34)
draw.rounded_rectangle((*card_xy, card_xy[0] + 656, card_xy[1] + 515), radius=34, outline=(228, 0, 26), width=3)

draw.rounded_rectangle((sx + 92, sb - 116, sx + 380, sb - 54), radius=31, fill=(252, 238, 240), outline=(242, 188, 195), width=2)
draw.text((sx + 128, sb - 99), "Đang chọn:", font=font(22), fill=(56, 56, 62))
draw.text((sx + 252, sb - 99), "Mặc định", font=font(22, bold=True), fill=(190, 0, 28))
draw.rounded_rectangle((sr - 344, sb - 116, sr - 90, sb - 54), radius=31, fill=(232, 0, 29))
draw.text((sr - 298, sb - 99), "Lưu trang phục", font=font(22, bold=True), fill=(255, 255, 255))

# Mascot from the reference poster, softly masked to blend into the new design.
mascot_img = Image.open(MASCOT_SRC).convert("RGBA")
crop = mascot_img.crop((54, 750, 492, 1286))
crop = contain(crop, (330, 405))
mask = Image.new("L", crop.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, crop.width, crop.height), radius=42, fill=255)
crop.putalpha(Image.composite(crop.getchannel("A"), mask, mask))
img.alpha_composite(shadow((300, 350), 44, blur=18, opacity=70), (36, 846))
img.alpha_composite(crop, (26, 805))

# Right-side callouts in the TPS poster language.
callouts = [
    ("Trang phục mới", "Chọn nhanh giao diện Dodoo theo chủ đề"),
    ("Cá nhân hóa", "Xem trước outfit ngay trên màn hình"),
    ("Sẵn sàng lưu", "Một chạm để lưu trang phục yêu thích"),
]
for i, (head, sub) in enumerate(callouts):
    y = 837 + i * 136
    img.alpha_composite(shadow((448, 94), 24, blur=10, opacity=42), (596, y - 12))
    draw.rounded_rectangle((552, y, 1010, y + 96), radius=24, fill=(255, 255, 255), outline=(248, 214, 218), width=2)
    draw.ellipse((578, y + 16, 642, y + 80), fill=(225, 0, 28))
    icon = ["★", "✓", "▣"][i]
    draw_center(draw, (610, y + 27), icon, font(31, bold=True), (255, 255, 255))
    draw.text((666, y + 18), head, font=font(26, bold=True), fill=(196, 0, 28))
    draw.text((666, y + 52), sub, font=font(20), fill=(32, 32, 36))

# Bottom CTA panel.
draw.rounded_rectangle((206, 1334, 874, 1441), radius=28, fill=(255, 255, 255), outline=(250, 218, 222), width=2)
draw.ellipse((242, 1358, 312, 1428), fill=(252, 232, 235), outline=(238, 175, 184), width=3)
draw.polygon([(266, 1410), (300, 1393), (266, 1376)], fill=(225, 0, 28))
draw.text((348, 1360), "TPS có thêm giao diện trang phục mới", font=font(26, bold=True), fill=(207, 0, 28))
draw.text((348, 1397), "cho trải nghiệm học tập vui hơn, nhanh hơn và cá tính hơn!", font=font(23), fill=(26, 26, 30))
draw_center(draw, (W // 2, 1464), "New outfit, new energy!", font(41, italic=True), (255, 255, 255))

img = img.convert("RGB")
img.save(POSTER_OUT, quality=96)
print(POSTER_OUT)

