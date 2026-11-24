/** Dollar ↔ bolívar converter with today's BCV and Binance rates, and manual correction. */
import { hoy } from '../core/fechas';
import { fmtBs, fmtTasa, fmtUSD, parseDecimal, roundHalfAway, toCents } from '../core/money';
import { get, getRepo, recargar } from '../app/store';
import { onClick } from '../ui/eventos';
import { toast } from '../ui/feedback';
import { $, html } from '../ui/html';
import { icon } from '../ui/icons';
import { abrirSheet, sheetMarkup } from '../ui/sheet';
import { t } from '../strings';

let haciaBs = true;

export function botonTasas() {
  const th = get().datos?.tasaHoy;
  return html`<button
    class="btn small secondary num"
    data-on="conversor"
    aria-label="${t.convertir}: BCV ${fmtTasa(th?.bcv)}, Binance ${fmtTasa(th?.binance)}"
  >
    ${icon('intercambio')} BCV ${fmtTasa(th?.bcv)} · Binance ${fmtTasa(th?.binance)}
  </button>`;
}

function abrir() {
  const th = get().datos?.tasaHoy;
  const cuerpo = html` <div class="row">
      <span class="t-foot muted" id="cv-dir">${haciaBs ? t.deDolares : t.deBolivares}</span>
      <button type="button" class="btn small secondary" id="cv-swap">
        ${icon('intercambio')} ${t.invertir}
      </button>
    </div>
    <label class="amount-field" for="cv-monto"
      ><span class="cur" id="cv-cur">${haciaBs ? '$' : 'Bs'}</span>
      <input
        id="cv-monto"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0"
        aria-label="Monto a convertir"
    /></label>
    <div class="list" aria-live="polite">
      <div class="cell">
        <span class="grow"
          ><span class="title">${t.tasaBcv}</span
          ><span class="subtitle num">${fmtTasa(th?.bcv)} Bs/$</span></span
        ><b class="num t-title3" id="cv-bcv">—</b>
      </div>
      <div class="cell">
        <span class="grow"
          ><span class="title">${t.tasaBinance}</span
          ><span class="subtitle num">${fmtTasa(th?.binance)} Bs/$</span></span
        ><b class="num t-title3" id="cv-bin">—</b>
      </div>
    </div>
    <p class="t-foot muted">${th ? t.tasasDel(th.fecha, th.manual) : t.sinTasa}</p>
    <details class="card disclosure" style="padding-block:4px">
      <summary>${t.corregirTasas}</summary>
      <div class="list" style="box-shadow:none;margin:0 -16px">
        <label class="cell"
          ><span class="grow">BCV (Bs por $)</span
          ><input type="text" inputmode="decimal" id="fx-bcv" value="${th?.bcv ? fmtTasa(th.bcv) : ''}"
        /></label>
        <label class="cell"
          ><span class="grow">Binance (Bs por $)</span
          ><input
            type="text"
            inputmode="decimal"
            id="fx-bin"
            value="${th?.binance ? fmtTasa(th.binance) : ''}"
        /></label>
      </div>
      <p class="error-text" id="fx-err" role="alert" hidden></p>
      <button type="button" class="btn wide" id="fx-guardar" style="margin:8px 0 12px">${t.guardar}</button>
    </details>`;
  abrirSheet(sheetMarkup('cv', t.convertir, cuerpo), (dlg) => {
    const q = <T extends HTMLElement>(s: string) => $<T>(s, dlg) as T;
    const calc = () => {
      const n = parseDecimal(q<HTMLInputElement>('#cv-monto').value) ?? 0;
      const uno = (r: number | null | undefined) =>
        !r
          ? t.sinTasa
          : haciaBs
            ? fmtBs(roundHalfAway(toCents(n) * r))
            : fmtUSD(roundHalfAway(toCents(n) / r), 'exact');
      q('#cv-bcv').textContent = uno(th?.bcv);
      q('#cv-bin').textContent = uno(th?.binance);
    };
    dlg.addEventListener('input', calc);
    dlg.addEventListener('click', async (ev) => {
      const id = (ev.target as Element).closest('button')?.id;
      if (id === 'cv-swap') {
        haciaBs = !haciaBs;
        q('#cv-dir').textContent = haciaBs ? t.deDolares : t.deBolivares;
        q('#cv-cur').textContent = haciaBs ? '$' : 'Bs';
        calc();
      }
      if (id === 'fx-guardar') {
        const bcv = parseDecimal(q<HTMLInputElement>('#fx-bcv').value);
        const bin = parseDecimal(q<HTMLInputElement>('#fx-bin').value);
        const err = q('#fx-err');
        if (!bcv || bcv <= 0 || !bin || bin <= 0) {
          err.textContent = t.escribeDosTasas;
          err.hidden = false;
          return;
        }
        try {
          await getRepo().guardarTasaManual(hoy(), bcv, bin);
          await recargar();
          dlg.close();
          toast(t.tasasGuardadas);
        } catch (e) {
          console.error(e);
          err.textContent = t.sinConexion;
          err.hidden = false;
        }
      }
    });
    calc();
    setTimeout(() => q<HTMLInputElement>('#cv-monto').focus(), 60);
  });
}

onClick('conversor', abrir);
