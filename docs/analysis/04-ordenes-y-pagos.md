# Fase 4 — Pedidos, pagos y estados (núcleo)

> Fecha: 2026-10-25 · Solo lectura (código + consultas GET agregadas a la BD, sin datos personales).
> Scripts nuevos: `scripts/analysis/orders-timeline.mjs` (anomalías por mes).
> Archivos clave: `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/{status,pay-physical,approve-payment,reject-payment,reset-payment,proof,delivery-fee,confirm-receipt}/route.ts`, `src/lib/pricing.ts`, `src/lib/loyverse.ts`, `src/app/page.tsx` (checkout), `src/app/orden/[id]/page.tsx` (cliente), `src/app/admin/page.tsx` + `src/components/admin/KanbanBoard.tsx` (cajero), `src/app/repartidor/page.tsx`.

## 1. El flujo REAL de un pedido (de punta a punta)

```
CLIENTE (/)                      CAJERO (/admin Kanban)                 CLIENTE (/orden/[id])
────────────                     ──────────────────────                 ─────────────────────
Arma carrito, elige
pickup | delivery (| "comer en local" = pickup + nota)
POST /api/orders ───────────────► status=received
                                  payment_status=pending_payment
                                  (aparece en columna "Recibidos")      Ve "Recibiendo orden en cocina…"
                                  Botón "Confirmar ingredientes"
                                  PATCH /status → awaiting_payment ───► Ve "Elige tu método de pago"
                                  (o "Rechazar" → cancelled)
                                                                        A) "Pagar en Físico" → PATCH /pay-physical
                                                                           status=in_preparation
                                                                           payment_status=payment_approved
                                                                           payment_method=efectivo
                                                                           + raffle (≥$200) + recibo Loyverse
                                                                        B) Transferencia + comprobante
                                                                           POST /proof → payment_submitted
                                  "Finanzas": aprobar / rechazar
                                  PATCH /approve-payment ─────────────► status=in_preparation, payment_approved
                                                                           + raffle + recibo Loyverse
                                                                           (rechazar → pending_payment + motivo)
                                  in_preparation → ready → (delivery) in_transit → delivered
                                  PATCH /status  (o el repartidor en /repartidor)
                                                                        pickup: "Confirmar recepción" (confirm-receipt)
```
Atajos y extras del cajero: "Pago recibido → Cocina" en `awaiting_payment` (fuerza `payment_approved` y método `efectivo` si estaba vacío), "Destrabar pago" (`reset-payment`), confirmar/cambiar tarifa de envío, enlace de WhatsApp para avisar de un problema.

### 1.1 Matriz de transiciones permitidas (`VALID_TRANSITIONS` en `status/route.ts`)
| Desde | Hacia |
|---|---|
| received | awaiting_payment, in_preparation, **cancelled** |
| awaiting_payment | in_preparation, **cancelled** |
| in_preparation | ready, **cancelled** |
| ready | in_transit, delivered, **cancelled** |
| in_transit | delivered, **cancelled** |
| delivered / cancelled | (final) |

### 1.2 Ejes de estado de un pedido
- `status` (7 valores): received, awaiting_payment, in_preparation, ready, in_transit, delivered, cancelled.
- `payment_status`: pending_payment, payment_submitted, payment_approved, payment_rejected (**este último nunca se usa**: rechazar vuelve a `pending_payment` con `rejection_reason`).
- `payment_method`: `efectivo` | `transferencia` | NULL (el cliente "Pagar en Físico" cubre efectivo **y** tarjeta, pero todo se guarda como `efectivo`).
- `refund_status`: `none` | `pending` | `completed`.
- `service_type`: `pickup` | `delivery` (**"comer en local" no es un tipo**: se guarda como `pickup` con el texto `[COMER EN LOCAL]` en `notes`).

## 2. Creación del pedido (`POST /api/orders`)
1. Requiere sesión (`customer`+).
2. Valida nombre e ítems; si es `delivery` exige lat/lng y dirección.
3. Lee los productos del carrito de la BD (con variantes y grupos de modificadores) y **recalcula el precio en el servidor** con `calculateOrderTotal`.
4. Delivery: distancia por Google Distance Matrix (fallback Haversine ×1.25), límite duro 5 km, busca la zona en `delivery_zones` y **suma la tarifa al `total`**; `delivery_fee_confirmed = true` automáticamente.
5. Inserta con `status='received'`, `payment_status='pending_payment'`. Devuelve id, total, tarifa.
6. El frontend redirige a `/orden/{id}`.

Observaciones sobre cómo queda el dato:
- `orders.total` = productos + tarifa de envío (el comprobante de la pantalla del cliente así lo muestra).
- `orders.items` conserva el ítem tal como lo mandó el cliente + `calculated_unit_price` y `final_subtotal` calculados por el servidor.
- El cajero puede cambiar la tarifa después (`PATCH /delivery-fee`): reescribe `delivery_fee` **y el `total`** (nuevo = total − tarifa vieja + tarifa nueva). Ya hay, por tanto, precedente de un `total` que cambia tras crearse el pedido.

### 2.1 Cálculo de precios (`src/lib/pricing.ts`)
Precio base o de variante (tamaño) + modificadores por encima del "límite gratis" del grupo. Detalles que importan al modificar un pedido:
- **Piso del precio del frontend**: si el cliente manda un precio *mayor* que el calculado, se usa el del cliente ("modo flexible por lanzamiento"). Es decir, el servidor no es 100 % la fuente de verdad.
- Modificadores desconocidos (no existen en BD) se aceptan **a $0** con un `console.warn`.
- Reglas hardcodeadas: UUID de categoría de ensaladas, nombres de grupos ("Proteínas", "Toppings"…), sándwich/torta, "Smoothie Mixto" ($80/$90). Los ids tipo `'smoothies-clasicos'`, `'sandwich'` del código no coinciden con los ids UUID reales de `products`, por lo que parte de esa lógica probablemente es código muerto.
- Toda esa lógica está en una sola función reutilizable → **el recálculo para una modificación se puede reutilizar tal cual**.

## 3. Pagos
| Acción | Endpoint | Quién | Efecto |
|---|---|---|---|
| Pagar en físico | `PATCH /orders/[id]/pay-physical` | dueño del pedido, solo si `awaiting_payment` | `in_preparation` + `payment_approved` + `efectivo` + rifa + **recibo Loyverse** (síncrono) |
| Subir comprobante | `POST /orders/[id]/proof` | dueño, si `payment_status=pending_payment` | archivo a bucket `payment-proofs`, `payment_submitted`, `transferencia`. **No valida `status`** (se puede subir sobre un pedido cancelado/entregado) |
| Aprobar pago | `PATCH …/approve-payment` | cajero | `payment_approved`; si estaba en `awaiting_payment` → `in_preparation`; rifa; recibo Loyverse |
| Rechazar pago | `PATCH …/reject-payment` | cajero | `pending_payment`, guarda `rejection_reason`, borra `proof_url` (el archivo queda huérfano en Storage) |
| Destrabar pago | `PATCH …/reset-payment` | cajero | pone `awaiting_payment` + `pending_payment` **sin validar el estado actual** |
| Tarifa de envío | `PATCH …/delivery-fee` | cajero | recalcula `total`; no actúa sobre cancelados/entregados |

**Importante para las cuentas:** `payment_approved` en pagos físicos significa "el cliente tocó el botón", **no** "se cobró el dinero". El pedido pasa a cocina y se registra como venta pagada en Loyverse en ese instante, aunque el cliente nunca llegue a pagar.

## 4. Efectos secundarios de cada transición (qué más se mueve)

| Evento | Rifa (`raffle_entries`) | Loyverse | Lealtad | Otros |
|---|---|---|---|---|
| Entrar a `in_preparation` (por cualquiera de las 3 vías) | upsert si `total ≥ 200` (único por `order_id`) | **crea recibo** (si no existe) y guarda `loyverse_receipt_id/number` | los puntos se calculan al consultar: pedidos `≠ cancelled` y (`payment_approved` o `delivered`) | si Loyverse falla: **solo se registra en consola**, el pedido avanza sin recibo y **no se reintenta** |
| `cancelled` desde cajero | **no se borra** la entrada | si hay `loyverse_receipt_id`: `refundLoyverseReceipt` **antes** de actualizar la BD; si falla → error 500 y no cancela | deja de contar (por filtro) | si `payment_approved` ⇒ `refund_status='pending'` |
| `delivered` | — | — | cuenta | puede llegar del cajero, del repartidor o del cliente (`confirm-receipt`) |

- Antes de `in_preparation` (estados `received` / `awaiting_payment`) **no existe recibo en Loyverse, ni boleto de rifa, ni pago aprobado**. Es decir: cancelar o modificar en esa ventana es un cambio **puramente interno de la BD**, sin tocar Loyverse. (Hay 1 pedido `awaiting_payment` con recibo — anomalía, probablemente por un `reset-payment` posterior a la aprobación.)

## 5. Qué ve cada rol hoy

**Cliente (`/orden/[id]`, 1 128 líneas):** barra de progreso, mensajes por estado, elección de pago (solo si `awaiting_payment` + `pending_payment`), estado del comprobante, botón de WhatsApp si el pedido está cancelado, "Confirmar recepción" cuando está listo/en camino. **No hay ningún botón de cancelar ni de modificar, ni mensajes sobre ello.** `/` muestra un banner "pedido activo" con enlace al pedido (`/api/me/orders`, estados activos).
**Cajero (Kanban + modal):** columnas Recibidos · Esperando Pago · Preparando · Listas · En Camino; botón de avance, **"Rechazar" (solo en `received`)**, WhatsApp, "Destrabar Pago" (solo en `awaiting_payment`), cotización de envío. `GET /api/orders` solo trae **las últimas 24 h**. Cancelar en estados posteriores a `received` **no tiene botón** en el modal (aunque el backend lo permita) → ese es el verdadero hueco del lado del personal.
**Repartidor (`/repartidor`):** avanza `ready → in_transit → delivered`.

## 6. Datos reales: cómo se comporta el sistema (308 pedidos)

| Mes | Pedidos | Entregados sin pago registrado | Entregados sin recibo Loyverse | Cancelados | `awaiting_payment` abandonados |
|---|---:|---:|---:|---:|---:|
| 2026-06 | 16 | 6 | 4 | 4 | 1 |
| 2026-07 | 54 | **29** | 10 | 19 | 4 |
| 2026-08 | 100 | 6 | 4 | 7 | 14 |
| 2026-09 | 76 | 6 | 6 | 5 | 2 |
| 2026-10 | 62 | 0 | 0 | **13** | 0 |

- **Los 47 `delivered`+`pending_payment` son históricos** (29 en julio, `payment_method` NULL en los 47: eran pedidos de antes de que se guardara el método/estado de pago). **En octubre ya no ocurre.** Corrijo parte del H2.1: no es un problema vigente, sí contamina reportes históricos. Suma de esos 47: $7 160 (31 tienen recibo en Loyverse).
- **24 `delivered` sin recibo** (suma $2 930): 8 con pago aprobado (recibo falló en Loyverse y nunca se reintentó) y 16 sin pago registrado (históricos). Octubre: 0.
- **Cancelaciones en octubre: 13 de 62 pedidos (≈21 %)**, contra ≈5–10 % en meses anteriores. Mediana de tiempo hasta la cancelación: ~11 min (las hace el cajero en `received`). Las 48 cancelaciones históricas fueron antes de pagar (sin reembolsos).
- 2 pedidos `in_preparation` de agosto siguen vivos (nunca se cerraron) y 21 `awaiting_payment` abandonados (la mayoría de agosto): **no existe ninguna limpieza automática ni "caducidad" de pedidos**; el Kanban solo los oculta por la regla de 24 h.

## 7. Hallazgos (solo reportados, NO corregidos)

| ID | Hallazgo | Severidad |
|---|---|---|
| **H4.1** | `PATCH /reset-payment` no valida el estado: un cajero (o un clic equivocado) puede devolver a `awaiting_payment` un pedido `delivered`, `cancelled` o ya en cocina con recibo en Loyverse, dejando pago y recibo inconsistentes (y volviendo a permitir "pagar en físico", lo que intentaría crear otro recibo). | **Alta** |
| **H4.2** | En la cancelación del cajero el reembolso en Loyverse se hace **antes** de guardar en BD; si el guardado falla o hay conflicto (409) el recibo ya quedó anulado pero el pedido sigue activo. Y si Loyverse falla (p. ej. el recibo ya fue reembolsado a mano en la caja) la cancelación queda **bloqueada** (500). | Alta |
| **H4.3** | Al cancelar un pedido con `payment_approved` se marca `refund_status='pending'` aun si fue pago **en efectivo en caja**; el módulo de reembolsos pide CLABE y comprobante bancario. Mezcla "devolver efectivo" con "devolver transferencia". Hoy no se ha disparado nunca (todas las cancelaciones fueron antes de pagar). | Media |
| **H4.4** | No se registra quién cancela, cuándo ni por qué (solo `status` y `updated_at`). Imposible auditar las 48 cancelaciones. | Alta (para "cuentas no cuadran") |
| **H4.5** | Fallo al crear el recibo en Loyverse = el pedido avanza igual y **no hay cola de reintento de recibos** (la cola solo maneja `customer_create`, y ni ella corre). Existe un script manual (`recover-loyverse-orders.mjs`). | **Alta** |
| **H4.6** | "Pagar en físico" marca `payment_approved` + venta en Loyverse sin que haya cobro; sumado a que no hay caducidad, cualquier "no-show" queda como venta pagada y pedido colgado (`in_preparation` desde agosto ×2). | **Alta** (negocio) |
| **H4.7** | Condiciones de carrera: solo `status/route.ts` usa `UPDATE … WHERE status = estado_previo`. `pay-physical`, `approve-payment`, `reset-payment`, `proof`, `delivery-fee` hacen lectura→escritura sin condición; doble clic en `pay-physical`/`approve-payment` puede crear **dos recibos** en Loyverse. | Media-Alta |
| **H4.8** | El servidor acepta un precio de cliente mayor al calculado y modificadores desconocidos a $0; reglas de precios hardcodeadas (UUID de categoría, nombres de grupos). | Media |
| **H4.9** | `proof` no valida `orders.status`; `reject-payment` deja archivos huérfanos; el bucket de limpieza tiene nombre equivocado (H2.8). | Baja |
| **H4.10** | La rifa no se revierte al cancelar un pedido ya en cocina (no ocurre antes de `in_preparation`, pero sí si se cancela después). | Media |
| **H4.11** | "Comer en local" no es un `service_type`; se infiere de un texto en `notes`. Frágil para reportes. | Baja |
| **H4.12** | El Kanban solo muestra 24 h y no hay forma de ver/cerrar pedidos viejos colgados desde el panel. No hay botón de cancelar en el modal para estados posteriores a `received`. | Media |
| **H4.13** | Octubre: cancelaciones ≈21 % (13/62). El motivo no se guarda, así que no se sabe si es "me equivoqué" (lo que reporta el cliente) o faltantes de ingredientes. | Informativo |

## 8. Insumos para diseñar "Cancelar" y "Modificar" (se concreta en Fase 6)

### 8.1 Ventana permitida al cliente (decisión del dueño: antes de preparación)
Estados donde **no hay recibo, ni rifa, ni pago aprobado**: `received` y `awaiting_payment` (con `payment_status` `pending_payment`, y también `payment_submitted`, aunque ahí habría un comprobante subido que avisar al cajero / marcar para reembolso). Esa ventana termina en cuanto el cliente toca "Pagar en físico" o el cajero aprueba la transferencia. Pregunta abierta para el dueño: como "pagar en físico" manda a cocina de inmediato, el cliente que se equivoca *después* de elegir efectivo ya no podrá cancelar; ¿se acepta (el cajero cancela por él) o se prefiere un paso de confirmación en caja?

### 8.2 Cancelar (cliente)
- Endpoint propio `POST /api/orders/[id]/cancel` (rol `customer`, comprobar `user_id`), `UPDATE … SET status='cancelled' WHERE id=? AND status IN ('received','awaiting_payment')` y verificar filas afectadas (evita la carrera con el cajero).
- Registrar actor, momento y motivo → requiere columnas nuevas en `orders` (p. ej. `cancelled_at`, `cancelled_by` `customer|staff`, `cancel_reason`) o tabla de eventos; el `CHECK` de `status` no cambia.
- Sin llamadas a Loyverse en esa ventana (el recibo no existe). Si hay `payment_submitted` con comprobante: dejar `refund_status='pending'` o impedirlo.
- Aviso al cajero: el Kanban ya recarga por polling y filtra `cancelled`; conviene mostrar un aviso/ícono ("cancelado por el cliente").
- UI: botón "Cancelar pedido" + confirmación + motivo opcional en `/orden/[id]`; el estado `cancelled` ya se pinta bien.
- Del lado del personal: añadir botón "Cancelar" para estados posteriores a `received` (el backend ya lo soporta), con motivo.

### 8.3 Modificar
Dos caminos, a decidir en Fase 6:
- **A. Modificar en sitio** (`PATCH /api/orders/[id]/items`): validar ventana y dueño, reutilizar `calculateOrderTotal` con los productos de la BD, conservar/recalcular la tarifa de envío (hoy fija desde la dirección), reescribir `items` + `total`, registrar versión/`modified_at`, y avisar al cajero. Requiere una pantalla para editar el carrito del pedido existente (el carrito vive en estado de cliente en `page.tsx`, 2 330 líneas).
- **B. "Editar" = cancelar y reabrir en el carrito** (cancela el pedido con motivo `modified`, carga sus ítems en el carrito y se reenvía como pedido nuevo). Reutiliza todo (precios, envío, validaciones, UI de carrito) y deja auditoría natural; a cambio cambia el id/ticket y el cajero ve un cancelado + uno nuevo.
- En cualquier caso: bloquear si ya hay comprobante enviado, o resetearlo; el total mostrado para transferir debe ser el nuevo; no hay efectos en Loyverse ni rifa en la ventana permitida.

### 8.4 Plan de pruebas sin tocar Loyverse real
Como la ventana permitida no crea recibos, los dos cambios pueden probarse de punta a punta **sin llamar a Loyverse**, usando un pedido propio en `received`/`awaiting_payment` y cancelándolo (afecta solo la BD de producción, que es la misma que usa el cliente; usar un usuario de prueba y limpiar después). Los estados posteriores (cajero cancelando en cocina) sí tocan Loyverse y se probarán con un pedido de $1 acordado con el cliente al final.
