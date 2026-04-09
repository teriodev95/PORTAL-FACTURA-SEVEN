# EVO API Notes

Fecha de verificacion: 2026-04-01

## Credenciales probadas

- `EVO_API_USER`: `sevendaysgoldcentrosur`
- `EVO_API_KEY`: valor actualizado el 2026-04-01
- Base URL: `https://evo-integracao.w12app.com.br`

Nota:
- El repo no guarda el valor de `EVO_API_KEY`; en Cloudflare Worker se usa como secreto.
- El Worker publico `https://seven-days-api.clvrt.workers.dev` ya responde correctamente para varios tickets reales con la clave nueva.

## Hallazgos principales

- `GET /api/v1/sales?take=...` funciona y devuelve ventas reales.
- Los tickets reales observados durante la verificacion incluyen `191`, `824`, `825`, `826`, `827`, `828`.
- El Worker publico ya devuelve `200` para `191`, `824`, `825`, `827`.
- `826` fallo en el Worker por un problema puntual de integracion con `members`.
- `sales` trae items, importes, ids internos y datos basicos del miembro.
- `sales` no mostro forma de pago ni RFC util de forma confiable.
- `members` existe, pero el filtro `idMember` se comporto de forma inconsistente en pruebas.
- `invoices/CSV` funciona y es el endpoint mas util encontrado para datos fiscales emitidos.
- `receivables/debtors` funciona y expone datos de deuda/cobro. En los datos probados, `paymentType` vino `null`.

## Endpoints probados

### 1. Ventas

Endpoint:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/sales?take=5' | jq
```

Campos observados en `sales`:

- `idSale`
- `idMember`
- `idBranch`
- `saleDate`
- `saleItens`
- `member`
- `receivables`
- `observations`
- `saleSource`

Campos observados en `saleItens`:

- `description`
- `item`
- `itemValue`
- `saleValue`
- `quantity`
- `discount`
- `tax`
- `idMembership`
- `idService`
- `idProduct`
- `accountingCode`
- `municipalServiceCode`
- `idMemberMembership`

Conclusiones:

- Si preguntas por codigo SAT de producto, no se observo uno util.
- Si preguntas por ids internos de producto/servicio, si existen:
  - `idMembership`
  - `idService`
  - `idProduct`
- En las ventas probadas, `idProduct` venia `null`.
- `receivables` vino `null` o vacio en lo probado.

Ejemplo de consulta para ver campos clave:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/sales?take=5' \
| jq '.[] | {idSale, idMember, idBranch, saleDate, receivables, saleItens}'
```

### 2. Miembros

Endpoint:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/members?take=1&idMember=4' | jq
```

Campos relevantes observados:

- `document`
- `documentId`
- `contacts`
- `branchName`
- `memberships`

Conclusiones:

- `document` a veces viene lleno, pero lo observado parece mas CURP que RFC.
- `documentId` existio en el modelo, pero en los casos probados vino `null` o vacio.
- El filtro `idMember=...` fue inconsistente: algunas consultas devolvieron el mismo miembro aunque cambiara el `idMember`.
- No conviene confiar en `members` como fuente unica de RFC sin validacion extra.

Ejemplos encontrados con `document` poblado:

- `idMember = 5` -> `AAHI830831MQTLRS01`
- `idMember = 6` -> `AOCE961221HVZNVM01`
- `idMember = 7` -> `AOHJ960325MASRRS07`

Esto parece CURP, no RFC.

### 3. Deudas / Cobros

Endpoint funcional:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/receivables/debtors?take=20' | jq
```

Campos observados:

- `memberId`
- `name`
- `receivableId`
- `dueDate`
- `paymentDate`
- `debtAmount`
- `paymentType`
- `idPaymentType`
- `debtStatus`
- `checkoutLink`
- `checkoutLinkFullDebt`
- `paymentOrigin`
- `idMemberMembership`
- `chargeAttemptsCount`
- `lastAcquirerDeclineReason`

Conclusiones:

- Es un endpoint util para saber el estado de cobro.
- En las respuestas probadas, `paymentType` e `idPaymentType` venian `null`.
- Si EVO llena esos campos en otras operaciones, este endpoint parece ser la mejor apuesta para obtener forma/tipo de pago.

Ejemplo para quedarte solo con campos utiles:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/receivables/debtors?take=20' \
| jq '.results[] | {memberId, name, receivableId, paymentType, idPaymentType, paymentDate, debtStatus, debtAmount, checkoutLink}'
```

### 4. Facturas emitidas

CSV funcional:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/invoices/CSV?dtEmissaoInicio=2026-03-01&dtEmissaoFim=2026-04-30'
```

Encabezado real observado:

```text
id;UNIDADE;COD_ALUNO;NOME;CPF;PLANO;LANCAMENTO;OCORRENCIA;VALOR;AUT;TID;NOTA;STATUS;Status Bloqueio;DATA_EMISSAO;MSG;Endereco;Numero;Complemento;Bairro;Cidade;UF;CEP;CHAVE_ACESSO
```

Conclusiones:

- Este es el endpoint mas valioso encontrado para datos fiscales ya emitidos.
- Expone `CPF`, `NOTA`, `STATUS`, `DATA_EMISSAO`, `CHAVE_ACESSO` y direccion.
- Si en el futuro EVO emite notas y queremos conciliarlas o auditarlas, este CSV sirve.

Endpoints relacionados que en pruebas devolvieron `500`:

- `GET /api/v1/invoices?...`
- `GET /api/v1/receivables/summary-excel?...`

## Limitaciones observadas en EVO

- `GET /api/v1/sales/824` devolvio `Sale not found` aunque la venta existe en el listado.
- `GET /api/v1/sales?idSale=824&take=10` no respeto el filtro y devolvio otra venta.
- `GET /api/v1/members?idMember=818&take=1` devolvio un miembro distinto al solicitado.
- Algunos endpoints documentados existen, pero en la cuenta o con ciertos parametros devuelven `500`.

Esto sugiere que hay inconsistencias reales en la API de EVO y no solo en nuestro codigo.

## Implicaciones para el proyecto

- Para items y totales:
  - usar `sales`
- Para posibles datos de cobro:
  - explorar `receivables/debtors`
- Para datos fiscales emitidos:
  - usar `invoices/CSV`
- Para RFC del cliente:
  - no confiar en que EVO lo provea bien; seguir solicitandolo al usuario en facturacion
- Para codigo SAT de producto:
  - no se encontro en EVO; seguir mapeando manualmente en nuestra capa

## cURL utiles

Ver ventas:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/sales?take=5' | jq
```

Ver miembros:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/members?take=1&idMember=4' | jq
```

Ver cobros/deudas:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/receivables/debtors?take=20' | jq
```

Descargar facturas emitidas en CSV:

```bash
curl --http1.1 -u 'sevendaysgoldcentrosur:EVO_API_KEY' \
'https://evo-integracao.w12app.com.br/api/v1/invoices/CSV?dtEmissaoInicio=2026-03-01&dtEmissaoFim=2026-04-30'
```

## Fuentes oficiales revisadas

- `ReceivablesApiViewModel`
  - https://api.abcevo.com/receivablesapiviewmodel-10388317d0
- `Chamadas de exportacao para Excel`
  - https://api.abcevo.com/chamadas-de-exporta%C3%A7%C3%A3o-para-excel-1798030m0

