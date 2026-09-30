"""Generate simple app icons for the PWA (no external assets needed).
Monokrom hitam/putih (gaya "Snail OS", disamakan dengan ringkasan_harian) --
motif "struk kertas" dengan satu aksen bulat (koin) supaya beda tipis dari
ikon ringkasan_harian tapi tetap satu keluarga desain."""
from PIL import Image, ImageDraw

OUT_DIR = "/home/claude/dompet_harian/public/icons"

BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)


def make_icon(size: int, path: str, maskable: bool = False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(size * 0.08) if maskable else 0
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=int(size * 0.22),
        fill=BLACK,
    )

    # "Struk" -- kartu putih polos di atas latar hitam.
    card_margin = size * 0.24
    card = [card_margin, card_margin * 1.05, size - card_margin * 0.72, size - card_margin * 0.62]
    draw.rounded_rectangle(card, radius=size * 0.04, fill=WHITE)

    x0 = card[0] + size * 0.06
    x1 = card[2] - size * 0.06
    y = card[1] + size * 0.09
    line_h = size * 0.045
    gap = size * 0.075

    # Dua baris teks (hitam di atas putih) lalu satu koin bulat -- simbol uang.
    for w in (1.0, 0.7):
        draw.rounded_rectangle(
            [x0, y, x0 + (x1 - x0) * w, y + line_h],
            radius=line_h / 2,
            fill=BLACK,
        )
        y += gap

    coin_r = line_h * 0.95
    coin_cy = y + coin_r
    draw.ellipse(
        [x0, coin_cy - coin_r, x0 + coin_r * 2, coin_cy + coin_r],
        outline=BLACK,
        width=max(2, int(size * 0.012)),
    )

    img.save(path)


if __name__ == "__main__":
    import os

    os.makedirs(OUT_DIR, exist_ok=True)
    make_icon(192, f"{OUT_DIR}/icon-192.png")
    make_icon(512, f"{OUT_DIR}/icon-512.png")
    make_icon(512, f"{OUT_DIR}/icon-maskable-512.png", maskable=True)
    print("Icons generated.")
