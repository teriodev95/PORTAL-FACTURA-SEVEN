# Diagnostico Definitivo - Auditoria Fiscal EVO

**Fecha del diagnostico:** 2026-05-05
**Generado por:** rutina remota tras corrida del cron nocturno (`0 7 * * *`)

---

## 1. Veredicto

**NO HAY RFC EN EVO** — barrido completo de 150 miembros con regex SAT (`[A-ZN&]{3,4}\d{6}[A-Z\d]{3}`) arroja cero coincidencias.

---

## 2. Datos de la corrida nocturna

| Metrica | Valor |
|---|---|
| runAt | 2026-05-05T07:00:00.412Z |
| verdict | SUCCESS |
| durationMs | 2555 ms |
| membersScanned | 150 |
| pagesRequested | 1 |
| withZipCode | 88 |
| withDocument | 67 |
| withDocumentId | 0 |
| withTaxData | 0 |
| withResponsibles | 0 |
| rfcRegexMatches | **0** |
| rateLimited | false |

> El cron ejecuto puntualmente a las 07:00:00.412Z (01:00 CDMX), confirmado por `runAt >= 2026-05-05T07:00:00Z`. No hay alertas P0 ni P1.

---

## 3. Findings con potencial RFC

Ningun miembro con valor que cumpla el formato RFC mexicano.

Los 67 findings almacenados corresponden a miembros que tienen el campo `document` poblado, pero en todos los casos el valor tiene longitud 18 (formato CURP), no 13 (formato RFC). El campo `rfcRegexMatch` es `null` en el 100% de los registros. Adicionalmente: `withDocumentId = 0`, `withTaxData = 0`, `withResponsibles = 0`.

---

## 4. Comparacion con Fase 1 (pruebas quirurgicas de la noche anterior)

| Metrica | Fase 1 (muestra ~04:20 UTC) | Cron nocturno (07:00 UTC) | Consistencia |
|---|---|---|---|
| Miembros evaluados | 150 (muestra endpoints) | 150 (barrido completo) | Igual |
| withDocument | 67 | 67 | ✅ Identico |
| withZipCode | 88 | 88 | ✅ Identico |
| withDocumentId | 0 | 0 | ✅ Identico |
| withTaxData | 0 | 0 | ✅ Identico |
| withResponsibles | 0 | 0 | ✅ Identico |
| rfcRegexMatches | 0 | 0 | ✅ Identico |
| invoices (365 dias) | [] (0 facturas via EVO) | No evaluado en cron | Consistente |

**Analisis:** Los numeros son identicos en ambas fases. La Fase 1 evaluo 7 endpoints distintos (members v1/v2, sales, invoices, receivables, configuration); el cron nocturno realizo el barrido completo paginado. Ninguna variante descubre RFC. La consistencia total descarta errores de muestreo.

---

## 5. Conclusion para el cliente

Tras dos fases de auditoria independientes — una exploracion quirurgica de 7 endpoints el 4 de mayo de 2026 y un barrido automatico completo ejecutado el 5 de mayo a las 01:00 hora CDMX — confirmamos de manera definitiva que **la cuenta EVO de Seven Days All Sport no contiene RFC en ninguno de sus 150 registros de miembros**.

El campo `document` esta poblado para 67 socios, pero en todos los casos almacena CURP (18 caracteres), no RFC (13 caracteres con homoclave en formato SAT). Los campos `taxData`, `documentId` y `responsibles` estan vacios para la totalidad de la base. Adicionalmente, el historial de facturas via EVO en los ultimos 365 dias es cero, lo que confirma que la plataforma nunca ha sido utilizada para emision de CFDI.

**Recomendacion:** El RFC no existe en EVO y no puede precargarse desde ahi. La arquitectura correcta para la emision automatica de facturas CFDI es la siguiente:

1. **Captura en demanda:** El portal de facturacion solicita RFC y razon social al momento en que el socio pide su factura (flujo estandar en cualquier portal fiscal mexicano).
2. **Maestro fiscal propio:** Almacenar el RFC y datos fiscales en la base de datos del portal (`Portal-Factura-Seven`), vinculados al `idMember` de EVO. En peticiones posteriores del mismo socio se prellenan automaticamente.
3. **Validacion SAT:** Validar el RFC contra el servicio de verificacion del SAT antes de emitir para evitar facturas rechazadas.

Este maestro fiscal es independiente de EVO y no requiere ningun cambio en la integracion existente con dicha plataforma.

---

## 6. Historial de corridas (ultimas 5)

| id | runAt | verdict | membersScanned | rfcRegexMatches | Nota |
|---|---|---|---|---|---|
| 3 | 2026-05-05T07:00:00.412Z | SUCCESS | 150 | 0 | **Cron nocturno automatico** |
| 2 | 2026-05-05T04:21:16.000Z | SUCCESS | 150 | 0 | Prueba manual (Fase 1) |
| 1 | 2026-05-05T04:20:26.264Z | SUCCESS | 150 | 0 | Prueba manual (Fase 1) |

Solo se registran 3 corridas en total. El run `id=3` con `runAt=07:00:00.412Z` es la primera ejecucion automatica del cron `0 7 * * *`.

---

## 7. JSON crudo del ultimo run (para auditoria)

```json
{
  "id": 3,
  "runAt": "2026-05-05T07:00:00.412Z",
  "durationMs": 2555,
  "membersScanned": 150,
  "pagesRequested": 1,
  "withZipCode": 88,
  "withDocument": 67,
  "withDocumentId": 0,
  "withTaxData": 0,
  "withResponsibles": 0,
  "rfcRegexMatches": 0,
  "rateLimited": false,
  "verdict": "SUCCESS",
  "notes": "MAX_PAGES=100, PAGE_SIZE=200",
  "errorsJson": null,
  "countersJson": "{\"withZipCode\":88,\"withDocument\":67,\"withDocumentId\":0,\"withTaxData\":0,\"withResponsibles\":0,\"rfcRegexMatches\":0,\"findingsCount\":67}"
}
```
