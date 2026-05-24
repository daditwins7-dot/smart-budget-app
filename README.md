# SMART BUDGET APP

Primera version local basada en el documento `CODEX.docx` y en la estructura del Excel `HOMSMTFIN.015.CHATGPT.xlsx`.

## Como abrirla

Sirvela por HTTP local y abre la URL en el navegador:

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Despues entra a `http://127.0.0.1:5173/`. La app funciona sin instalar dependencias y guarda los datos en `localStorage`.

## Incluye

- Dashboard con ingresos, gastos, flujo de caja, ahorros, tarjetas y deuda/ingreso.
- Budget Setup editable con ingresos, balances, ahorro, conceptos controlados y miscelaneos automaticos.
- Update Transactions para registrar movimientos reales usando solo conceptos creados en Budget Setup.
- Projection Analysis con presupuesto, actual, proyectado, restante y porcentaje pagado.
- Financial Evaluation con score, deuda/ingreso y barras comparativas.
- Settings con idioma, mes y reinicio de datos locales.

## Logica principal implementada

La formula base de miscelaneos sigue el prompt:

```text
MIS = FEI + IR + II - VIV - PTC - GG - GE - AP + GTC - FDF
```

Donde el gasto planeado con tarjeta aumenta disponibilidad de flujo porque retrasa la salida de efectivo, mientras que los pagos de tarjeta reducen flujo como deuda comprometida.

## Estructura

```text
src/
  calculations/
    budgetEngine.js
    budgetEngine.ts
  data/
    defaultState.js
  i18n/
    index.js
  types/
    index.ts
  app.js
  styles.css
```
