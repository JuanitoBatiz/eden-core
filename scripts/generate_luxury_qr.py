import os
import sys
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
from PIL import Image, ImageDraw, ImageFont

def get_font(font_names, size):
    """Busca y carga la primera fuente Serif/Sans de lujo disponible en el sistema Windows."""
    for name in font_names:
        try:
            return ImageFont.truetype(name, size)
        except IOError:
            continue
    return ImageFont.load_default()

def generate_luxury_qr():
    url = "https://eden-ensaladas.com"
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "images")
    os.makedirs(output_dir, exist_ok=True)

    print(f"🌟 Generando código QR y Display de Lujo perfeccionado para: {url}")

    # 1. Configurar QR con Alta Corrección de Errores (H = 30% redundancia para permitir el emblema central)
    qr = qrcode.QRCode(
        version=5,  # Densidad limpia y elegante
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=40,  # Alta resolución
        border=3
    )
    qr.add_data(url)
    qr.make(fit=True)

    # Paleta de color Edén Luxury
    color_green_dark = (44, 62, 45)       # #2C3E2D - Verde Bosque Profundo
    color_ochre_gold = (197, 168, 128)    # #C5A880 - Acento Oro Suave
    color_cream_bg   = (250, 246, 240)    # #FAF6F0 - Fondo Crema Cálido
    color_white      = (255, 255, 255)    # #FFFFFF - Blanco Puro

    # 2. Generar imagen base del QR (módulos redondeados elegantes en verde oscuro sobre blanco)
    qr_img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(radius_ratio=0.85),
        color_mask=SolidFillColorMask(back_color=color_white, front_color=color_green_dark)
    ).convert("RGBA")

    width, height = qr_img.size

    # 3. Emblema Central: SIN lo redondeado (cuadro recto limpio) y ÚNICAMENTE la palabra "Edén"
    # 3. Emblema Central: SIN lo redondeado (cuadro recto limpio) y ÚNICAMENTE la palabra "Edén" con abundante aire a los lados
    emblem_w = int(width * 0.28)  # Más ancho para dar respiro a los lados
    emblem_h = int(height * 0.17) # Proporción rectangular elegante
    
    # Cuadro blanco limpio, recto con un marco dorado exterior y verde fino interior con buen margen
    emblem = Image.new("RGBA", (emblem_w, emblem_h), color_white)
    draw_emb = ImageDraw.Draw(emblem)

    draw_emb.rectangle([0, 0, emblem_w - 1, emblem_h - 1], outline=color_ochre_gold, width=3)
    draw_emb.rectangle([6, 6, emblem_w - 7, emblem_h - 7], outline=color_green_dark, width=1)

    # Tipografía central "Edén" de lujo (Serif)
    font_serif_names = ["Georgia.ttf", "palab.ttf", "timesbd.ttf", "C:/Windows/Fonts/Georgia.ttf", "C:/Windows/Fonts/palab.ttf"]
    font_sans_names  = ["segoeui.ttf", "arial.ttf", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"]

    # Ajustar tamaño de "Edén" para que tenga holgura y no choque ni aplaste los lados
    title_font_size = int(emblem_h * 0.48)
    font_title = get_font(font_serif_names, title_font_size)

    # Centrar exactamente "Edén" en el recuadro
    text_title = "Edén"
    bbox_title = draw_emb.textbbox((0, 0), text_title, font=font_title)
    w_title = bbox_title[2] - bbox_title[0]
    h_title = bbox_title[3] - bbox_title[1]

    x_title = (emblem_w - w_title) / 2
    y_title = (emblem_h - h_title) / 2 - (emblem_h * 0.05)
    draw_emb.text((x_title, y_title), text_title, fill=color_green_dark, font=font_title)

    # Pegar el recuadro recto justo al centro del QR
    pos_emblem = ((width - emblem_w) // 2, (height - emblem_h) // 2)
    qr_img.paste(emblem, pos_emblem)

    # Guardar versión QR Limpio en alta resolución
    clean_qr_path = os.path.join(output_dir, "eden_qr_ensaladas_clean.png")
    qr_img.save(clean_qr_path, "PNG")
    print(f"✅ QR Limpio guardado en: {clean_qr_path}")

    # 4. Generar Tarjeta/Display Lujoso para Mesa perfeccionada (proporción 2400 x 3400 px, más aire y elegancia)
    card_width = 2400
    card_height = 3400
    card = Image.new("RGBA", (card_width, card_height), color_cream_bg)
    draw_card = ImageDraw.Draw(card)

    # Marco arquitectónico refinado: un borde exterior verde profundo y un filete dorado interno con generoso aire (padding)
    border_outer = 60
    draw_card.rectangle([border_outer, border_outer, card_width - border_outer, card_height - border_outer], outline=color_green_dark, width=6)
    
    border_inner = border_outer + 25
    draw_card.rectangle([border_inner, border_inner, card_width - border_inner, card_height - border_inner], outline=color_ochre_gold, width=3)

    # --- ENCABEZADO ESTÉTICO CON BASTANTE AIRE Y EQUILIBRIO ---
    font_kicker  = get_font(font_sans_names, 42)
    font_main    = get_font(font_serif_names, 130)
    font_sub     = get_font(font_serif_names, 58)
    font_instruct = get_font(font_sans_names, 48)

    # 1. Kicker superior
    text_kicker = "M E N Ú   D I G I T A L"
    bbox_k = draw_card.textbbox((0, 0), text_kicker, font=font_kicker)
    draw_card.text(((card_width - (bbox_k[2] - bbox_k[0])) / 2, 240), text_kicker, fill=color_ochre_gold, font=font_kicker)

    # 2. Título principal "Edén" o "BIENVENIDOS A EDÉN" proporcionado y sin apretujarse
    text_main = "BIENVENIDOS A EDÉN"
    bbox_m = draw_card.textbbox((0, 0), text_main, font=font_main)
    draw_card.text(((card_width - (bbox_m[2] - bbox_m[0])) / 2, 330), text_main, fill=color_green_dark, font=font_main)

    # 3. Línea divisoria elegante dorada
    line_w = 400
    line_y = 510
    draw_card.line([((card_width - line_w) / 2, line_y), ((card_width + line_w) / 2, line_y)], fill=color_ochre_gold, width=4)

    # 4. Instrucción fina y elegante con mayor impacto en QR
    text_inst = "ESCANEA EL CÓDIGO QR PARA VER NUESTRO MENÚ DIGITAL"
    bbox_i = draw_card.textbbox((0, 0), text_inst, font=font_instruct)
    draw_card.text(((card_width - (bbox_i[2] - bbox_i[0])) / 2, 570), text_inst, fill=color_green_dark, font=font_instruct)

    # --- CENTRO: CÓDIGO QR ENMARCADO CON GRAN AIRE ---
    # Colocar el QR a partir de y=720, centrado perfectamente
    qr_display_size = 1750  # Tamaño imponente pero con abundante margen blanco alrededor
    qr_resized = qr_img.resize((qr_display_size, qr_display_size), Image.Resampling.LANCZOS)
    
    # Crear un contenedor blanco suave con un sutil borde dorado para que el QR resalte como una joya
    qr_pad = 50
    qr_card_box_size = qr_display_size + (qr_pad * 2)
    qr_box = Image.new("RGBA", (qr_card_box_size, qr_card_box_size), color_white)
    draw_qr_box = ImageDraw.Draw(qr_box)
    draw_qr_box.rectangle([0, 0, qr_card_box_size - 1, qr_card_box_size - 1], outline=color_ochre_gold, width=3)
    
    qr_box.paste(qr_resized, (qr_pad, qr_pad))

    qr_x = (card_width - qr_card_box_size) // 2
    qr_y = 700
    card.paste(qr_box, (qr_x, qr_y))

    # --- PIE DE PÁGINA ESBELTO Y REFINADO ---
    font_footer_tags = get_font(font_serif_names, 64)
    font_footer_url  = get_font(font_sans_names, 50)

    # Línea decorativa inferior
    line_y2 = qr_y + qr_card_box_size + 110
    draw_card.line([((card_width - line_w) / 2, line_y2), ((card_width + line_w) / 2, line_y2)], fill=color_ochre_gold, width=4)

    # Especialidades
    text_tags = "Ensaladas  •  Bowls  •  Infusiones  •  Smoothies"
    bbox_t = draw_card.textbbox((0, 0), text_tags, font=font_footer_tags)
    draw_card.text(((card_width - (bbox_t[2] - bbox_t[0])) / 2, line_y2 + 60), text_tags, fill=color_green_dark, font=font_footer_tags)

    # URL y ubicación
    text_url = "Otumba, Estado de México   |   eden-ensaladas.com"
    bbox_u = draw_card.textbbox((0, 0), text_url, font=font_footer_url)
    draw_card.text(((card_width - (bbox_u[2] - bbox_u[0])) / 2, line_y2 + 160), text_url, fill=color_ochre_gold, font=font_footer_url)

    # Guardar tarjeta de lujo
    card_path = os.path.join(output_dir, "eden_qr_ensaladas_luxury_display.png")
    card.save(card_path, "PNG")
    print(f"✅ Tarjeta/Display QR de Lujo guardada en: {card_path}")

    try:
        qr_img.save("eden_qr_clean.png", "PNG")
        card.save("eden_qr_luxury_display.png", "PNG")
        print("🎉 Archivos también guardados en la carpeta raíz para rápido acceso.")
    except Exception as e:
        pass

if __name__ == "__main__":
    generate_luxury_qr()
