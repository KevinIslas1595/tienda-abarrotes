// Catálogo inicial: productos típicos de una tienda de abarrotes del Estado de México.
//
// De dónde salen los precios (septiembre 2026):
//  - Refrescos Coca-Cola: lista de precios del aumento del 4 de agosto de 2026.
//  - Lo demás: precio de anaquel en Chedraui en línea (sin ofertas), redondeado
//    a precio de tiendita. Las bolsitas chicas de botana (que no vende el súper)
//    se tomaron de Chedraui Supercito, su tiendita de barrio.
//  - Costo: calculado con la ganancia típica de una tiendita por categoría
//    (en promedio ~20 %, según la Alianza Nacional de Pequeños Comerciantes).
//
// Son precios de referencia: cambia costo y precio por lo que te cobra tu proveedor.
// Los códigos de barras vienen de las fichas de producto de Chedraui; si alguno
// no coincide con el de tu mercancía, la app te deja ligarlo al escanear.
import { redondear } from './util.js';

export const FECHA_PRECIOS = 'septiembre 2026';

// Ganancia sobre el costo que se usó para estimar el costo de cada categoría.
const GANANCIA = {
  'Refrescos y bebidas': 0.18,
  'Lácteos y huevo': 0.12,
  Salchichonería: 0.18,
  'Pan y pastelitos': 0.2,
  Galletas: 0.2,
  Botanas: 0.25,
  'Dulces y chocolates': 0.3,
  Abarrotes: 0.12,
  'Enlatados y salsas': 0.18,
  Limpieza: 0.2,
  'Higiene personal': 0.2,
  Cervezas: 0.15,
  Otros: 0.25,
};

const MINIMO = { 'Refrescos y bebidas': 6, Cervezas: 6 };

const p = (nombre, categoria, precio, codigos = [], extra = {}) => ({
  nombre,
  categoria,
  precio,
  costo: redondear(precio / (1 + GANANCIA[categoria])),
  codigos,
  unidad: 'pza',
  minimo: MINIMO[categoria] ?? 3,
  favorito: false,
  ...extra,
});

const granel = { unidad: 'kg', minimo: 2, favorito: true };

export const CATALOGO = [
  // ---------- Refrescos y bebidas ----------
  p('Coca-Cola Original 600 ml', 'Refrescos y bebidas', 22, ['75007614']),
  p('Coca-Cola Original 3 L', 'Refrescos y bebidas', 60, ['7501055304745']),
  p('Coca-Cola lata 355 ml', 'Refrescos y bebidas', 23, ['7501055300075']),
  p('Coca-Cola Sin Azúcar 600 ml', 'Refrescos y bebidas', 20, ['7501055320639']),
  p('Pepsi 600 ml', 'Refrescos y bebidas', 19, ['7501031310012']),
  p('Pepsi 3 L', 'Refrescos y bebidas', 47, ['7501031310098']),
  p('Sprite 600 ml', 'Refrescos y bebidas', 19, ['7501055303755', '7501055305629']),
  p('Fanta Naranja 600 ml', 'Refrescos y bebidas', 20, ['7501055303779']),
  p('Agua Ciel 600 ml', 'Refrescos y bebidas', 11, ['7501055307906']),
  p('Agua Ciel 1 L', 'Refrescos y bebidas', 14, ['7501055310883']),
  p('Agua Bonafont 1.5 L', 'Refrescos y bebidas', 16, ['0758104000159']),
  p('Topo Chico 600 ml', 'Refrescos y bebidas', 23, ['7501055378487', '0021136010541']),
  p('Boing Mango 354 ml', 'Refrescos y bebidas', 18, ['7501039400067']),
  p('Jumex Néctar Durazno 450 ml', 'Refrescos y bebidas', 19, ['7501013105537', '7501013103359', '7501013174052']),
  p('Gatorade Naranja 600 ml', 'Refrescos y bebidas', 25, ['0036731106018']),
  p('Electrolit Ponche de Frutas 625 ml', 'Refrescos y bebidas', 27, ['7503046131224']),
  p('Vive 100 lata 473 ml', 'Refrescos y bebidas', 17, ['7506192508711']),

  // ---------- Lácteos y huevo ----------
  p('Leche Lala Entera 1 L', 'Lácteos y huevo', 33, ['7501020526066', '7501020520088']),
  p('Leche Alpura Clásica 1 L', 'Lácteos y huevo', 32, ['7501055900022']),
  p('Leche Lala Deslactosada 1 L', 'Lácteos y huevo', 34, ['7501020515398', '7501020565911']),
  p('Crema ácida Lala 426 ml', 'Lácteos y huevo', 36, ['7501020561906']),
  p('Huevo blanco 12 pzas', 'Lácteos y huevo', 32, ['7501476669010']),
  p('Huevo blanco (kilo)', 'Lácteos y huevo', 42, [], granel),

  // ---------- Salchichonería ----------
  p('Salchicha Viena FUD 266 g', 'Salchichonería', 29, ['7501040009754']),
  p('Jamón de pavo FUD Virginia 290 g', 'Salchichonería', 53, ['7501040005831']),

  // ---------- Pan y pastelitos ----------
  p('Pan Bimbo Blanco 620 g', 'Pan y pastelitos', 54, ['7500810029183']),
  p('Pan Bimbo Integral 620 g', 'Pan y pastelitos', 58, ['7500810022061']),
  p('Tortillas de harina Tía Rosa 10 pzas', 'Pan y pastelitos', 36, ['7501030475569']),
  p('Gansito Marinela 50 g', 'Pan y pastelitos', 16, ['7501000153107']),
  p('Pingüinos Marinela 2 pzas', 'Pan y pastelitos', 25, ['7501000153800']),
  p('Mantecadas Bimbo 2 pzas', 'Pan y pastelitos', 15, ['7501000142408']),
  p('Tortilla de maíz (kilo)', 'Pan y pastelitos', 27, [], { ...granel, costo: 24 }),

  // ---------- Galletas ----------
  p('Galletas Marías Gamesa 170 g', 'Galletas', 22, ['7500478010592', '7501000658923']),
  p('Galletas Emperador Chocolate 80 g', 'Galletas', 12, ['7500478043781']),
  p('Galletas Chokis 180 g', 'Galletas', 23, ['7500478013944']),
  p('Galletas Oreo 105 g', 'Galletas', 23),

  // ---------- Botanas ----------
  p('Sabritas Original 45 g', 'Botanas', 19),
  p('Sabritas Original 105 g', 'Botanas', 42, ['7501011167650', '7501011131347']),
  p('Doritos Nacho 76 g', 'Botanas', 19),
  p('Ruffles Queso 67 g', 'Botanas', 19),
  p('Cheetos Torciditos 145 g', 'Botanas', 42, ['7500478044276']),
  p('Takis Fuego 94 g', 'Botanas', 25, ['7500810022375']),
  p('Churrumais 58 g', 'Botanas', 10, ['7500478034376']),
  p('Rancheritos 72 g', 'Botanas', 15, ['7500478034413']),

  // ---------- Dulces y chocolates ----------
  p('Chocolate Carlos V Suizo 18 g', 'Dulces y chocolates', 10, ['7501058638083']),
  p('Mazapán De la Rosa', 'Dulces y chocolates', 10, ['0724869001380']),
  p('Paleta Payaso Ricolino 45 g', 'Dulces y chocolates', 16, ['7622202815836', '7622202277245', '7501000278404']),
  p('Pulparindo De la Rosa', 'Dulces y chocolates', 10, ['0725226001913']),
  p('Chicles Trident Xtracare', 'Dulces y chocolates', 12, ['7622210571342', '7622210464828', '7622210571359']),
  p('Chocolate Snickers 40 g', 'Dulces y chocolates', 24, ['7506174500207', '7502271917405', '7502271917771', '7506174512248']),
  p('Halls Moras', 'Dulces y chocolates', 11, ['7506105604219', '7622210267856', '7622210457509', '7622210267788']),

  // ---------- Abarrotes ----------
  p('Arroz súper extra Italriso 1 kg', 'Abarrotes', 31, ['7501079300815']),
  p('Frijol negro Verde Valle 900 g', 'Abarrotes', 35, ['7501071301353']),
  p('Azúcar estándar (kilo)', 'Abarrotes', 32, [], { unidad: 'kg', minimo: 2 }),
  p('Aceite 1-2-3 1 L', 'Abarrotes', 40, ['75002343']),
  p('Aceite Nutrioli 850 ml', 'Abarrotes', 52, ['7501039126745', '7501039124406', '7501039124390']),
  p('Sal La Fina 1 kg', 'Abarrotes', 28, ['0034587031010']),
  p('Harina de maíz Maseca 1 kg', 'Abarrotes', 20, ['7501077400050']),
  p('Harina de trigo Tres Estrellas 907 g', 'Abarrotes', 19, ['7501069210094']),
  p('Sopa de fideo La Moderna 220 g', 'Abarrotes', 11, ['7501018314545']),
  p('Sopa Maruchan Pollo 64 g', 'Abarrotes', 17, ['0041789001918']),
  p('Puré de tomate Del Fuerte 210 g', 'Abarrotes', 12, ['7501079709984', '7501003101051']),
  p('Consomé Knorr Suiza 100 g', 'Abarrotes', 20, ['7506306325692']),
  p('Café Nescafé Clásico 42 g', 'Abarrotes', 50, ['7501000912803']),
  p('Chocolate Abuelita 180 g', 'Abarrotes', 55, ['7501059289444']),
  p('Leche condensada La Lechera 100 g', 'Abarrotes', 14, ['7501059211209']),

  // ---------- Enlatados y salsas ----------
  p('Atún Dolores en agua 140 g', 'Enlatados y salsas', 38, ['7501045401386']),
  p('Sardinas Guaymex en tomate 425 g', 'Enlatados y salsas', 47, ['0731082001004']),
  p('Chiles jalapeños La Costeña 240 g', 'Enlatados y salsas', 17, ['7501017051328']),
  p('Frijoles refritos Isadora bayos 400 g', 'Enlatados y salsas', 16, ['7501071308598']),
  p('Mayonesa McCormick 210 g', 'Enlatados y salsas', 29, ['7501003334329']),
  p('Salsa Valentina 370 ml', 'Enlatados y salsas', 16, ['0097339024050', '0097339000054']),
  p('Cátsup Del Monte 370 g', 'Enlatados y salsas', 20, ['75053895', '75053901']),

  // ---------- Limpieza ----------
  p('Papel higiénico Pétalo 4 rollos', 'Limpieza', 32),
  p('Detergente Roma 1 kg', 'Limpieza', 36, ['7501026004605']),
  p('Jabón Zote rosa 200 g', 'Limpieza', 15, ['7501026005688']),
  p('Cloralex gel 950 ml', 'Limpieza', 23, ['7501025405151']),
  p('Suavitel 650 ml', 'Limpieza', 28, ['7509546689487']),
  p('Fabuloso Energía Naranja 1 L', 'Limpieza', 29, ['7509546008202']),
  p('Lavatrastes Axion 640 ml', 'Limpieza', 50, ['7509546076218']),

  // ---------- Higiene personal ----------
  p('Pasta dental Colgate Triple Acción 100 ml', 'Higiene personal', 30, ['7509546000343']),
  p('Jabón Escudo antibacterial 150 g', 'Higiene personal', 20, ['7506425606917']),
  p('Toallas femeninas Saba 12 pzas', 'Higiene personal', 48, ['7501019043123']),

  // ---------- Cervezas ----------
  p('Cerveza Tecate lata 473 ml', 'Cervezas', 22, ['0089826001415']),
  p('Cerveza Victoria lata 710 ml', 'Cervezas', 30, ['7501064194146']),
  p('Cerveza Corona Extra 355 ml', 'Cervezas', 22),

  // ---------- Otros ----------
  p('Cerillos Clásicos (cajita)', 'Otros', 5, ['75036553', '7501142811132']),
  p('Encendedor', 'Otros', 15),
];
